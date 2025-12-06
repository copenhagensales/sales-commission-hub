import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface QuizResultRequest {
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  passed: boolean;
  answers: Record<string, string>;
  gpsAccepted: boolean;
  summaryAccepted: boolean;
  submittedAt: string;
  ipAddress: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("send-car-quiz-result function invoked");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      employeeId,
      employeeName,
      employeeEmail,
      passed,
      answers,
      gpsAccepted,
      summaryAccepted,
      submittedAt,
      ipAddress,
    }: QuizResultRequest = await req.json();

    console.log(`Processing quiz result for employee: ${employeeName} (${employeeEmail})`);
    console.log(`Passed: ${passed}, IP: ${ipAddress}`);

    // Get Microsoft Graph access token
    const clientId = Deno.env.get("M365_CLIENT_ID");
    const clientSecret = Deno.env.get("M365_CLIENT_SECRET");
    const tenantId = Deno.env.get("M365_TENANT_ID");
    const senderEmail = Deno.env.get("M365_SENDER_EMAIL");

    if (!clientId || !clientSecret || !tenantId || !senderEmail) {
      console.error("Missing M365 configuration");
      throw new Error("Email configuration not complete");
    }

    // Get access token from Microsoft
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Failed to get M365 access token:", errorText);
      throw new Error("Failed to authenticate with email service");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Format the date
    const formattedDate = new Date(submittedAt).toLocaleString("da-DK", {
      dateStyle: "long",
      timeStyle: "short",
    });

    // Format answers for email
    const answersHtml = Object.entries(answers)
      .map(([key, value]) => `<li>Spørgsmål ${key}: Svar ${value}</li>`)
      .join("");

    // Create email content
    const statusText = passed ? "BESTÅET" : "IKKE BESTÅET";
    const statusColor = passed ? "#16a34a" : "#dc2626";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1f2937;">COPENHAGEN SALES</h1>
        <h2 style="color: ${statusColor};">Bil-quiz Resultat: ${statusText}</h2>
        
        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Oplysninger</h3>
          <p><strong>Medarbejder:</strong> ${employeeName}</p>
          <p><strong>Email:</strong> ${employeeEmail}</p>
          <p><strong>Tidspunkt:</strong> ${formattedDate}</p>
          <p><strong>IP-adresse:</strong> ${ipAddress}</p>
        </div>

        <div style="margin: 20px 0;">
          <h3>Besvarelser</h3>
          <ul style="line-height: 1.8;">
            ${answersHtml}
          </ul>
          <p><strong>GPS-overvågning accepteret:</strong> ${gpsAccepted ? "Ja" : "Nej"}</p>
          <p><strong>Alle vilkår accepteret:</strong> ${summaryAccepted ? "Ja" : "Nej"}</p>
        </div>

        ${passed ? `
        <div style="background-color: #dcfce7; padding: 20px; border-radius: 8px; border: 2px solid #16a34a;">
          <h3 style="color: #16a34a; margin-top: 0;">✓ Godkendt til brug af firmabiler</h3>
          <p style="margin-bottom: 0;">Denne godkendelse skal fornyes om 6 måneder.</p>
        </div>
        ` : `
        <div style="background-color: #fee2e2; padding: 20px; border-radius: 8px; border: 2px solid #dc2626;">
          <h3 style="color: #dc2626; margin-top: 0;">✗ Ikke bestået</h3>
          <p style="margin-bottom: 0;">Du skal tage quizzen igen for at få godkendelse til brug af firmabiler.</p>
        </div>
        `}

        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
        <p style="color: #6b7280; font-size: 12px;">
          Denne email er sendt automatisk fra Copenhagen Sales' bil-quiz system.<br>
          Tidspunkt: ${formattedDate}<br>
          IP-adresse: ${ipAddress}
        </p>
      </div>
    `;

    // Send email via Microsoft Graph
    const sendEmailResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: `Bil-quiz Resultat: ${statusText} - ${employeeName}`,
            body: {
              contentType: "HTML",
              content: emailHtml,
            },
            toRecipients: [
              {
                emailAddress: {
                  address: employeeEmail,
                },
              },
            ],
          },
          saveToSentItems: true,
        }),
      }
    );

    if (!sendEmailResponse.ok) {
      const errorText = await sendEmailResponse.text();
      console.error("Failed to send email:", errorText);
      throw new Error("Failed to send email");
    }

    console.log(`Quiz result email sent successfully to ${employeeEmail}`);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-car-quiz-result function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
