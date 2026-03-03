import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEEKDAY_LABELS = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function renderWeekdayBadges(weekdays: Array<{ week: number; days: number[] }> | undefined): string {
  if (!weekdays || weekdays.length === 0) return '<span style="color:#94a3b8;">—</span>';

  return weekdays
    .sort((a, b) => a.week - b.week)
    .map((w) => {
      const sorted = [...w.days].sort((a, b) => a - b);
      const weekdayOnly = sorted.filter((d) => d <= 4);
      const isFullWeek = [0, 1, 2, 3, 4].every((d) => weekdayOnly.includes(d)) && weekdayOnly.length === 5;

      const badges = isFullWeek
        ? '<span style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;background:linear-gradient(135deg,#d1fae5,#a7f3d0);color:#065f46;letter-spacing:0.3px;">Man–Fre</span>'
        : sorted
            .map(
              (d) =>
                `<span style="display:inline-block;padding:2px 7px;border-radius:20px;font-size:11px;font-weight:500;background:linear-gradient(135deg,#e0e7ff,#c7d2fe);color:#3730a3;">${WEEKDAY_LABELS[d] || d}</span>`
            )
            .join(" ");

      return `<div style="margin-bottom:3px;"><span style="font-size:10px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Uge ${w.week}</span> ${badges}</div>`;
    })
    .join("");
}

function fmtDKK(value: number): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(value) + " kr";
}

function buildReportHtml(locationType: string, month: string, locations: any[], showDiscount: boolean, userMessage: string): string {
  const totalDays = locations.reduce((sum: number, loc: any) => sum + (Number(loc.days) || 0), 0);
  const totalAmount = locations.reduce((sum: number, loc: any) => sum + (Number(loc.amount) || 0), 0);
  const totalFinal = locations.reduce((sum: number, loc: any) => sum + (Number(loc.finalAmount) || Number(loc.amount) || 0), 0);

  const tableRows = locations.map((loc: any, i: number) => {
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f8fafc';
    return `
    <tr style="background:${bgColor};">
      <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;font-weight:500;color:#1e293b;">${loc.locationName || ''}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#475569;font-family:'Courier New',monospace;font-size:12px;">${loc.externalId || ''}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;color:#475569;">${loc.city || ''}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;">${renderWeekdayBadges(loc.weekdays)}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;text-align:right;color:#334155;font-weight:600;">${loc.days || 0}</td>
      <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;text-align:right;color:#334155;font-weight:500;">${fmtDKK(loc.amount || 0)}</td>
      ${showDiscount ? `
        <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;text-align:right;color:${loc.isExcluded ? '#b45309' : '#059669'};font-weight:600;">${loc.isExcluded ? 'Separat' : `-${loc.discount || 0}%`}</td>
        <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;text-align:right;color:#0f172a;font-weight:700;">${fmtDKK(loc.finalAmount || loc.amount || 0)}</td>
      ` : ''}
    </tr>`;
  }).join('');

  const discountHeaders = showDiscount ? `
    <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;border-bottom:2px solid #e2e8f0;">Rabat</th>
    <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;border-bottom:2px solid #e2e8f0;">Netto</th>
  ` : '';

  const colSpan = showDiscount ? 5 : 4;
  const subtotalRow = `
    <tr style="background:linear-gradient(135deg,#f1f5f9,#e2e8f0);">
      <td colspan="${colSpan}" style="padding:14px;font-weight:700;color:#1e293b;font-size:14px;border-top:2px solid #cbd5e1;">Subtotal</td>
      <td style="padding:14px;text-align:right;font-weight:700;color:#1e293b;font-size:14px;border-top:2px solid #cbd5e1;">${totalDays}</td>
      <td style="padding:14px;text-align:right;font-weight:700;color:#1e293b;font-size:14px;border-top:2px solid #cbd5e1;">${fmtDKK(totalAmount)}</td>
      ${showDiscount ? `
        <td style="padding:14px;border-top:2px solid #cbd5e1;"></td>
        <td style="padding:14px;text-align:right;font-weight:800;color:#0f172a;font-size:15px;border-top:2px solid #cbd5e1;">${fmtDKK(totalFinal)}</td>
      ` : ''}
    </tr>`;

  const escapedMessage = userMessage ? userMessage.replace(/\n/g, '<br/>') : '';

  return `
<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Leverandørrapport – ${locationType} – ${month}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="700" cellpadding="0" cellspacing="0" style="max-width:700px;width:100%;">

        <!-- HEADER -->
        <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 50%,#334155 100%);padding:40px 36px;border-radius:16px 16px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:3px;color:#94a3b8;margin-bottom:8px;">Leverandørrapport</div>
                <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">COPENHAGEN SALES</div>
              </td>
              <td align="right" valign="top">
                <div style="background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.15);border-radius:12px;padding:12px 18px;display:inline-block;">
                  <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#94a3b8;margin-bottom:2px;">Periode</div>
                  <div style="font-size:16px;font-weight:700;color:#ffffff;">${month}</div>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- TYPE BANNER -->
        <tr><td style="background:linear-gradient(135deg,#3b82f6,#2563eb);padding:14px 36px;">
          <div style="font-size:13px;font-weight:700;color:#ffffff;text-transform:uppercase;letter-spacing:1.5px;">📍 ${locationType}</div>
        </td></tr>

        <!-- BODY -->
        <tr><td style="background:#ffffff;padding:36px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          ${escapedMessage ? `
          <!-- USER MESSAGE -->
          <div style="background:#fefce8;border-left:4px solid #eab308;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;">
            <p style="margin:0;color:#713f12;font-size:14px;line-height:1.6;">${escapedMessage}</p>
          </div>
          ` : ''}

          <!-- TABLE -->
          <div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;border-bottom:2px solid #e2e8f0;">Lokation</th>
                  <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;border-bottom:2px solid #e2e8f0;">ID</th>
                  <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;border-bottom:2px solid #e2e8f0;">By</th>
                  <th style="padding:12px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;border-bottom:2px solid #e2e8f0;">Uger & Dage</th>
                  <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;border-bottom:2px solid #e2e8f0;">Dage</th>
                  <th style="padding:12px 14px;text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;border-bottom:2px solid #e2e8f0;">Beløb</th>
                  ${discountHeaders}
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
              <tfoot>${subtotalRow}</tfoot>
            </table>
          </div>

          <!-- SUMMARY CARDS -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
            <tr>
              <td width="33%" style="padding:0 6px 0 0;">
                <div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);border-radius:10px;padding:16px;text-align:center;">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#0284c7;margin-bottom:4px;">Lokationer</div>
                  <div style="font-size:22px;font-weight:800;color:#0c4a6e;">${locations.length}</div>
                </div>
              </td>
              <td width="33%" style="padding:0 3px;">
                <div style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:10px;padding:16px;text-align:center;">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#16a34a;margin-bottom:4px;">Dage i alt</div>
                  <div style="font-size:22px;font-weight:800;color:#14532d;">${totalDays}</div>
                </div>
              </td>
              <td width="33%" style="padding:0 0 0 6px;">
                <div style="background:linear-gradient(135deg,#fefce8,#fef9c3);border-radius:10px;padding:16px;text-align:center;">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#ca8a04;margin-bottom:4px;">${showDiscount ? 'Netto total' : 'Total'}</div>
                  <div style="font-size:22px;font-weight:800;color:#713f12;">${fmtDKK(showDiscount ? totalFinal : totalAmount)}</div>
                </div>
              </td>
            </tr>
          </table>

        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:28px 36px;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;line-height:1.6;">
            <strong style="color:#64748b;">Copenhagen Sales ApS</strong><br/>
            Rapport genereret ${new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
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

    // Build the full inline report HTML
    const emailBodyHtml = buildReportHtml(locationType, month, locations, showDiscount, message || '');

    // Send email — inline body, no attachments
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
