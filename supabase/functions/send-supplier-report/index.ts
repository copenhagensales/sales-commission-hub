import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEEKDAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function renderWeekdaysForEmail(weekdays: Array<{ week: number; days: number[] }> | undefined): string {
  if (!weekdays || weekdays.length === 0) return "-";

  return weekdays
    .sort((a, b) => a.week - b.week)
    .map((w) => {
      const sorted = [...w.days].sort((a, b) => a - b);
      const weekdayOnly = sorted.filter((d) => d <= 4);
      const isFullWeek = [0, 1, 2, 3, 4].every((d) => weekdayOnly.includes(d)) && weekdayOnly.length === 5;

      const badges = isFullWeek
        ? '<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;background:#d1fae5;color:#065f46;">Man–Fre</span>'
        : sorted
            .map(
              (d) =>
                `<span style="display:inline-block;padding:1px 5px;border-radius:3px;font-size:10px;background:#e0e7ff;color:#3730a3;">${WEEKDAY_LABELS[d] || d}</span>`
            )
            .join(" ");

      return `<div style="margin-bottom:2px;"><span style="font-size:10px;color:#6b7280;font-weight:600;">Uge ${w.week}</span> ${badges}</div>`;
    })
    .join("");
}

function buildReportHtml(locationType: string, month: string, locations: any[], showDiscount: boolean): string {
  const tableRows = locations.map((loc: any) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;">${loc.locationName || ''}</td>
      <td style="padding:8px;border:1px solid #ddd;">${loc.externalId || ''}</td>
      <td style="padding:8px;border:1px solid #ddd;">${loc.city || ''}</td>
      <td style="padding:8px;border:1px solid #ddd;">${renderWeekdaysForEmail(loc.weekdays)}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right;">${loc.days || 0}</td>
      <td style="padding:8px;border:1px solid #ddd;text-align:right;">${(loc.amount || 0).toLocaleString('da-DK')} kr</td>
      ${showDiscount ? `
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${loc.isExcluded ? 'Separat' : `-${loc.discount || 0}%`}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;font-weight:bold;">${(loc.finalAmount || loc.amount || 0).toLocaleString('da-DK')} kr</td>
      ` : ''}
    </tr>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>Leverandørrapport – ${locationType} – ${month}</title></head>
    <body style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:20px;">
      <div style="padding:20px 0;border-bottom:2px solid #333;">
        <h1 style="margin:0;color:#333;font-size:22px;">COPENHAGEN SALES</h1>
        <p style="color:#666;margin:5px 0 0;font-size:14px;">Leverandørrapport</p>
      </div>
      <div style="padding:20px 0;">
        <h2 style="font-size:18px;color:#333;">Rapport: ${locationType} – ${month}</h2>
        <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:13px;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Lokation</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">ID</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">By</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Uger & Dage</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:right;">Dage</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:right;">Beløb</th>
              ${showDiscount ? `
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Rabat</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Efter rabat</th>
              ` : ''}
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </div>
      <div style="padding:20px 0;border-top:1px solid #eee;font-size:12px;color:#666;">
        <p>Copenhagen Sales ApS</p>
      </div>
    </body>
    </html>
  `;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { locationType, month, recipients, subject, message, reportId, reportData, hasDiscountRules } = await req.json();

    if (!recipients?.length || !subject) {
      return new Response(
        JSON.stringify({ error: 'Recipients and subject are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = Deno.env.get('M365_TENANT_ID');
    const clientId = Deno.env.get('M365_CLIENT_ID');
    const clientSecret = Deno.env.get('M365_CLIENT_SECRET');
    const senderEmail = Deno.env.get('M365_SENDER_EMAIL');

    if (!tenantId || !clientId || !clientSecret || !senderEmail) {
      console.error('Missing M365 credentials');
      return new Response(
        JSON.stringify({ error: 'Email configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OAuth token
    const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody.toString(),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok) {
      console.error('Token error:', tokenData);
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with email service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const showDiscount = hasDiscountRules !== false;
    const locations = reportData || [];

    // Build the report as a standalone HTML file for attachment
    const reportHtml = buildReportHtml(locationType, month, locations, showDiscount);

    // Email body: just the user's message
    const emailBodyHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="padding:20px 0;border-bottom:1px solid #eee;">
          <h2 style="margin:0;color:#333;">COPENHAGEN SALES</h2>
          <p style="color:#666;margin:5px 0 0;">Leverandørrapport</p>
        </div>
        <div style="padding:20px 0;">
          <p>${message.replace(/\n/g, '<br/>')}</p>
          <p style="color:#888;font-size:13px;margin-top:20px;">Rapporten er vedhæftet som fil.</p>
        </div>
        <div style="padding:20px 0;border-top:1px solid #eee;font-size:12px;color:#666;">
          <p>Copenhagen Sales ApS</p>
        </div>
      </div>
    `;

    // Base64-encode the HTML report for attachment
    const encoder = new TextEncoder();
    const reportBytes = encoder.encode(reportHtml);
    const base64Report = btoa(String.fromCharCode(...reportBytes));

    // Clean filename
    const safeLocationType = locationType.replace(/[^a-zA-Z0-9æøåÆØÅ\- ]/g, '').replace(/\s+/g, '-');
    const safeMonth = month.replace(/[^a-zA-Z0-9æøåÆØÅ\- ]/g, '').replace(/\s+/g, '-');
    const attachmentName = `Rapport-${safeLocationType}-${safeMonth}.html`;

    // Send email with attachment
    const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
    const toRecipients = recipients.map((email: string) => ({
      emailAddress: { address: email },
    }));

    const mailResponse = await fetch(sendMailUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject,
          body: { contentType: 'HTML', content: emailBodyHtml },
          toRecipients,
          attachments: [
            {
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: attachmentName,
              contentType: "text/html",
              contentBytes: base64Report,
            },
          ],
        },
      }),
    });

    if (!mailResponse.ok) {
      const mailError = await mailResponse.text();
      console.error('Send mail error:', mailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update report with sent info
    if (reportId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sb = createClient(supabaseUrl, supabaseKey);

      await sb
        .from('supplier_invoice_reports')
        .update({
          sent_at: new Date().toISOString(),
          sent_to: recipients,
        })
        .eq('id', reportId);
    }

    console.log(`Supplier report sent to ${recipients.length} recipients for ${locationType} - ${month}`);

    return new Response(
      JSON.stringify({ success: true, recipientCount: recipients.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-supplier-report:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
