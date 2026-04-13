import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidateId, date, startTime, endTime } = await req.json();

    if (!candidateId || !date || !startTime || !endTime) {
      return new Response(
        JSON.stringify({ error: "candidateId, date, startTime, endTime required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate candidate
    const { data: candidate } = await supabase
      .from("candidates")
      .select("id, first_name, last_name, email, phone")
      .eq("id", candidateId)
      .maybeSingle();

    if (!candidate) {
      return new Response(
        JSON.stringify({ error: "Candidate not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get application
    let { data: application } = await supabase
      .from("applications")
      .select("id, role, status")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // If no application exists, create one
    if (!application) {
      const { data: newApp } = await supabase
        .from("applications")
        .insert({
          candidate_id: candidateId,
          role: "Salgskonsulent",
          status: "interview_scheduled",
        })
        .select("id, role, status")
        .single();
      application = newApp;
      console.log(`[public-book-candidate] Created new application for candidate ${candidateId}`);
    }

    const role = application?.role || "Salgskonsulent";

    // Create Outlook event if M365 is configured
    const clientId = Deno.env.get("AZURE_CLIENT_ID");
    const clientSecret = Deno.env.get("AZURE_CLIENT_SECRET");
    const tenantId = Deno.env.get("AZURE_TENANT_ID");
    const msUserEmail = Deno.env.get("MS_USER_EMAIL");

    let outlookEventCreated = false;

    if (clientId && clientSecret && tenantId && msUserEmail) {
      try {
        const tokenResponse = await fetch(
          `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              scope: "https://graph.microsoft.com/.default",
              grant_type: "client_credentials",
            }),
          }
        );

        if (tokenResponse.ok) {
          const { access_token } = await tokenResponse.json();

          const eventPayload = {
            subject: `Samtale: ${candidate.first_name} ${candidate.last_name} — ${role}`,
            body: {
              contentType: "Text",
              content: `Kandidatsamtale med ${candidate.first_name} ${candidate.last_name} for stillingen ${role}.\n\nKandidaten har selv booket denne tid.\n\nTelefon: ${candidate.phone || "Ikke oplyst"}\nEmail: ${candidate.email || "Ikke oplyst"}`,
            },
            start: {
              dateTime: `${date}T${startTime}:00`,
              timeZone: "Europe/Copenhagen",
            },
            end: {
              dateTime: `${date}T${endTime}:00`,
              timeZone: "Europe/Copenhagen",
            },
            attendees: candidate.email
              ? [
                  {
                    emailAddress: { address: candidate.email, name: `${candidate.first_name} ${candidate.last_name}` },
                    type: "required",
                  },
                ]
              : [],
          };

          const eventResponse = await fetch(
            `https://graph.microsoft.com/v1.0/users/${msUserEmail}/events`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${access_token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(eventPayload),
            }
          );

          if (eventResponse.ok) {
            outlookEventCreated = true;
            console.log(`[public-book-candidate] Outlook event created for ${candidate.first_name}`);
          } else {
            console.error("[public-book-candidate] Outlook error:", await eventResponse.text());
          }
        }
      } catch (outlookErr) {
        console.error("[public-book-candidate] Outlook error:", outlookErr);
      }
    }

    // Send calendar invite email to recruiter
    if (clientId && clientSecret && tenantId && msUserEmail) {
      try {
        // Get access token (reuse if Outlook event was created, otherwise fetch new)
        let notifyToken: string | null = null;
        const notifyTokenRes = await fetch(
          `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret: clientSecret,
              scope: "https://graph.microsoft.com/.default",
              grant_type: "client_credentials",
            }),
          }
        );
        if (notifyTokenRes.ok) {
          const tokenData = await notifyTokenRes.json();
          notifyToken = tokenData.access_token;
        }

        if (notifyToken) {
          const candidateName = `${candidate.first_name} ${candidate.last_name}`;
          const uid = crypto.randomUUID();
          const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
          const dtStart = `${date.replace(/-/g, "")}T${startTime.replace(":", "")}00`;
          const dtEnd = `${date.replace(/-/g, "")}T${endTime.replace(":", "")}00`;

          const icsContent = [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//Copenhagen Sales//Booking//DA",
            "METHOD:REQUEST",
            "BEGIN:VEVENT",
            `UID:${uid}`,
            `DTSTAMP:${now}`,
            `DTSTART;TZID=Europe/Copenhagen:${dtStart}`,
            `DTEND;TZID=Europe/Copenhagen:${dtEnd}`,
            `SUMMARY:Samtale: ${candidateName} — ${role}`,
            `DESCRIPTION:Kandidatsamtale med ${candidateName}\\nStilling: ${role}\\nTelefon: ${candidate.phone || "Ikke oplyst"}\\nEmail: ${candidate.email || "Ikke oplyst"}`,
            `ORGANIZER;CN=Copenhagen Sales:mailto:${msUserEmail}`,
            `ATTENDEE;CN=Oscar;RSVP=TRUE:mailto:oscar@copenhagensales.dk`,
            "STATUS:CONFIRMED",
            "END:VEVENT",
            "END:VCALENDAR",
          ].join("\r\n");

          // Base64 encode for Graph API attachment
          const encoder = new TextEncoder();
          const icsBytes = encoder.encode(icsContent);
          let binary = "";
          for (const byte of icsBytes) {
            binary += String.fromCharCode(byte);
          }
          const icsBase64 = btoa(binary);

          // Format date for subject
          const dateObj = new Date(date + "T12:00:00");
          const dayNum = dateObj.getDate();
          const monthNum = dateObj.getMonth() + 1;
          const dateShort = `${dayNum}/${monthNum}`;

          const emailPayload = {
            message: {
              subject: `Ny booking: ${candidateName} — ${dateShort} kl. ${startTime}`,
              body: {
                contentType: "HTML",
                content: `<h3>Ny kandidatbooking</h3>
<p><strong>Kandidat:</strong> ${candidateName}</p>
<p><strong>Stilling:</strong> ${role}</p>
<p><strong>Dato:</strong> ${date}</p>
<p><strong>Tid:</strong> ${startTime} – ${endTime}</p>
<p><strong>Telefon:</strong> ${candidate.phone || "Ikke oplyst"}</p>
<p><strong>Email:</strong> ${candidate.email || "Ikke oplyst"}</p>
<p><em>Acceptér den vedhæftede kalenderinvitation for at tilføje samtalen til din kalender.</em></p>`,
              },
              toRecipients: [
                { emailAddress: { address: "oscar@copenhagensales.dk", name: "Oscar" } },
              ],
              attachments: [
                {
                  "@odata.type": "#microsoft.graph.fileAttachment",
                  name: "interview.ics",
                  contentType: "text/calendar; method=REQUEST",
                  contentBytes: icsBase64,
                },
              ],
            },
            saveToSentItems: false,
          };

          const sendRes = await fetch(
            `https://graph.microsoft.com/v1.0/users/${msUserEmail}/sendMail`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${notifyToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(emailPayload),
            }
          );

          if (sendRes.ok || sendRes.status === 202) {
            console.log(`[public-book-candidate] Calendar invite sent to oscar@copenhagensales.dk for ${candidateName}`);
          } else {
            console.error("[public-book-candidate] Send invite error:", await sendRes.text());
          }
        }
      } catch (notifyErr) {
        console.error("[public-book-candidate] Notify email error:", notifyErr);
      }
    }

    // Update application status
    if (application) {
      await supabase
        .from("applications")
        .update({ status: "interview_scheduled", updated_at: new Date().toISOString() })
        .eq("id", application.id);
    }

    // Update candidate status and interview_date
    const interviewDatetime = `${date}T${startTime}:00+02:00`;
    await supabase
      .from("candidates")
      .update({
        status: "interview_scheduled",
        interview_date: interviewDatetime,
      })
      .eq("id", candidateId);
    console.log(`[public-book-candidate] Updated candidate ${candidateId} with interview_date ${interviewDatetime}`);

    // Cancel active booking flow enrollments
    const { data: enrollments } = await supabase
      .from("booking_flow_enrollments")
      .select("id")
      .eq("candidate_id", candidateId)
      .eq("status", "active");

    for (const enrollment of enrollments || []) {
      await supabase
        .from("booking_flow_enrollments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          cancelled_reason: "Kandidat bookede selv en tid",
        })
        .eq("id", enrollment.id);

      await supabase
        .from("booking_flow_touchpoints")
        .update({ status: "cancelled" })
        .eq("enrollment_id", enrollment.id)
        .eq("status", "pending");
    }

    // Send confirmation SMS
    if (candidate.phone) {
      try {
        // Format date nicely
        const dateObj = new Date(date + "T12:00:00");
        const dayNames = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
        const monthNames = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
        const dayName = dayNames[dateObj.getDay()];
        const monthName = monthNames[dateObj.getMonth()];
        const dateFormatted = `${dayName} d. ${dateObj.getDate()}. ${monthName}`;

        // Fetch template from DB
        const { data: smsTemplate } = await supabase
          .from("booking_flow_steps")
          .select("content")
          .eq("template_key", "booking_confirmation_sms")
          .eq("is_active", true)
          .maybeSingle();

        const fallback = `Hej {{fornavn}}! Din samtale er booket til {{dato}} kl. {{tidspunkt}}. Vi ringer dig op. Glæder os! 📞 — Copenhagen Sales`;
        const smsMessage = (smsTemplate?.content || fallback)
          .replace(/\{\{fornavn\}\}/g, candidate.first_name)
          .replace(/\{\{dato\}\}/g, dateFormatted)
          .replace(/\{\{tidspunkt\}\}/g, startTime);

        await fetch(`${supabaseUrl}/functions/v1/send-recruitment-sms`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({
            candidateId: candidate.id,
            phoneNumber: candidate.phone,
            message: smsMessage,
          }),
        });
        console.log(`[public-book-candidate] Confirmation SMS sent to ${candidate.first_name}`);
      } catch (smsErr) {
        console.error("[public-book-candidate] SMS error:", smsErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        outlookEventCreated,
        date,
        startTime,
        endTime,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[public-book-candidate] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
