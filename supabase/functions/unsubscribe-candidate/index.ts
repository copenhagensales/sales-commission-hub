import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Determine candidate ID based on request method
    let candidateId: string | null = null;
    const isPost = req.method === 'POST';

    if (isPost) {
      const body = await req.json();
      candidateId = body.candidateId || null;
    } else {
      const url = new URL(req.url);
      candidateId = url.searchParams.get('id');
    }

    if (!candidateId) {
      if (isPost) {
        return new Response(JSON.stringify({ error: "Missing candidateId" }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(renderHtml("Ugyldigt link", "Dette afmeldingslink er ikke gyldigt."), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify candidate exists
    const { data: candidate } = await supabase
      .from('candidates')
      .select('id, first_name')
      .eq('id', candidateId)
      .maybeSingle();

    if (!candidate) {
      if (isPost) {
        return new Response(JSON.stringify({ error: "Candidate not found" }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(renderHtml("Ukendt kandidat", "Vi kunne ikke finde din profil."), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Cancel all active enrollments
    const { data: activeEnrollments } = await supabase
      .from('booking_flow_enrollments')
      .select('id')
      .eq('candidate_id', candidateId)
      .in('status', ['active', 'pending_approval']);

    for (const enrollment of activeEnrollments || []) {
      await supabase
        .from('booking_flow_touchpoints')
        .update({ status: 'cancelled' })
        .eq('enrollment_id', enrollment.id)
        .eq('status', 'pending');

      await supabase
        .from('booking_flow_enrollments')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_reason: 'Kandidat afmeldte sig via link',
        })
        .eq('id', enrollment.id);
    }

    // Update latest application status
    const { data: latestApp } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestApp) {
      await supabase
        .from('applications')
        .update({ status: 'trukket_ansøgning' })
        .eq('id', latestApp.id);
    }

    console.log(`[unsubscribe-candidate] Candidate ${candidateId} unsubscribed. Cancelled ${activeEnrollments?.length || 0} enrollments.`);

    // Send cancellation notification emails
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      try {
        const { data: notifRecipients } = await supabase
          .from("booking_notification_recipients")
          .select("email")
          .eq("notify_on_cancel", true);

        const recipientEmails = (notifRecipients || []).map(r => r.email);
        if (recipientEmails.length > 0) {
          const candidateName = `${candidate.first_name}`;
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Copenhagen Sales <noreply@copenhagensales.dk>",
              to: recipientEmails,
              subject: `Afmelding: ${candidateName} har afmeldt sig`,
              html: `<h3>Kandidat afmeldt</h3>
<p><strong>${candidateName}</strong> har afmeldt sig via afmeldingslinket.</p>
<p>Alle aktive flows er blevet annulleret, og ansøgningen er markeret som trukket.</p>`,
            }),
          });
          console.log(`[unsubscribe-candidate] Cancel notification sent to ${recipientEmails.join(", ")}`);
        }
      } catch (emailErr) {
        console.error("[unsubscribe-candidate] Email notification error:", emailErr);
      }
    }

    // POST → return JSON
    if (isPost) {
      return new Response(JSON.stringify({ success: true, cancelledEnrollments: activeEnrollments?.length || 0 }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET → return HTML page
    const { data: pageContent } = await supabase
      .from('booking_page_content')
      .select('title, body_lines, tip_text')
      .eq('page_key', 'unsubscribe_success')
      .maybeSingle();

    const firstName = candidate.first_name || '';
    return new Response(
      renderSuccessHtml(firstName, pageContent),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error: any) {
    console.error('[unsubscribe-candidate] Error:', error);
    if (req.method === 'POST') {
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(renderHtml("Fejl", "Der opstod en fejl. Prøv igen senere."), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
});

function renderSuccessHtml(firstName: string, pageContent?: { title: string; body_lines: string[]; tip_text: string | null } | null): string {
  const defaultTitle = firstName ? `Tak for din interesse, ${firstName}!` : 'Tak for din interesse!';
  const title = pageContent?.title
    ? pageContent.title.replace('{{firstName}}', firstName || '')
    : defaultTitle;

  const defaultLines = [
    'Vi har modtaget din afmelding, og du vil ikke modtage flere beskeder fra os.',
    'Vi sætter stor pris på, at du tog dig tid til at søge hos os – <span class="highlight">det betyder meget</span>.',
    'Du er altid velkommen til at søge igen en anden gang. Vi vil med glæde høre fra dig!',
  ];
  const bodyLines = pageContent?.body_lines?.length ? pageContent.body_lines : defaultLines;
  const bodyHtml = bodyLines.map(line => `<p>${line}</p>`).join('\n    ');

  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Afmelding modtaget — Copenhagen Sales</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f0f4f8; color: #1f2937; }
    .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 520px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .icon { width: 64px; height: 64px; background: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .icon svg { width: 32px; height: 32px; color: #10b981; }
    h1 { font-size: 22px; margin: 0 0 16px; color: #111827; }
    p { color: #4b5563; line-height: 1.7; margin: 0 0 12px; font-size: 15px; }
    .highlight { color: #111827; font-weight: 500; }
    .divider { width: 48px; height: 2px; background: #e5e7eb; margin: 24px auto; }
    .brand { font-size: 13px; color: #9ca3af; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
    </div>
    <h1>${title}</h1>
    ${bodyHtml}
    <div class="divider"></div>
    <p class="brand">Venlig hilsen, Copenhagen Sales</p>
  </div>
</body>
</html>`;
}

function renderHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Copenhagen Sales</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f0f4f8; color: #1f2937; }
    .card { background: white; border-radius: 16px; padding: 48px 40px; max-width: 520px; text-align: center; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    h1 { font-size: 22px; margin-bottom: 16px; color: #111827; }
    p { color: #4b5563; line-height: 1.7; font-size: 15px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
