import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const WEEKDAY_SHORT = ["M", "Ti", "O", "To", "F", "L", "S"];

function renderWeekdayBadges(weekdays: Array<{ week: number; days: number[] }> | undefined): string {
  if (!weekdays || weekdays.length === 0) return '<span style="color:#94a3b8;">–</span>';

  return weekdays
    .sort((a, b) => a.week - b.week)
    .map((w) => {
      const sorted = [...w.days].sort((a, b) => a - b);
      const weekdayOnly = sorted.filter((d) => d <= 4);
      const isFullWeek = [0, 1, 2, 3, 4].every((d) => weekdayOnly.includes(d)) && weekdayOnly.length === 5;

      const weekLabel = `<span style="display:inline-block;background:#e2e8f0;color:#334155;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:0.3px;">Uge ${w.week}</span>`;

      const badges = isFullWeek
        ? '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;background:#dcfce7;color:#166534;">M–F</span>'
        : sorted
            .map(
              (d) =>
                `<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:500;background:#f1f5f9;color:#475569;margin:0 1px;">${WEEKDAY_SHORT[d] || d}</span>`
            )
            .join("");

      return `<div style="margin-bottom:5px;">${weekLabel} ${badges}</div>`;
    })
    .join("");
}

function fmtDKK(value: number): string {
  return new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(value) + " kr";
}

function buildReportHtml(locationType: string, month: string, locations: any[], showDiscount: boolean, userMessage: string, supplierName?: string): string {
  const totalDays = locations.reduce((sum: number, loc: any) => sum + (Number(loc.days) || 0), 0);
  const totalAmount = locations.reduce((sum: number, loc: any) => sum + (Number(loc.amount) || 0), 0);
  const totalFinal = locations.reduce((sum: number, loc: any) => sum + (Number(loc.finalAmount) || Number(loc.amount) || 0), 0);

  const tableRows = locations.map((loc: any, i: number) => {
    const bgColor = i % 2 === 0 ? '#ffffff' : '#f1f5f9';
    return `
    <tr style="background:${bgColor};">
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;font-weight:600;color:#0f172a;">${loc.locationName || ''}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:11px;font-family:monospace;">${loc.externalId || ''}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;color:#475569;">${loc.city || ''}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;">${renderWeekdayBadges(loc.weekdays)}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:#334155;font-weight:600;">${loc.days || 0}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:#0f172a;font-weight:700;font-size:14px;">${fmtDKK(loc.amount || 0)}</td>
      ${showDiscount ? `
        <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:${loc.isExcluded ? '#b45309' : '#059669'};font-weight:600;">${loc.isExcluded ? 'Separat' : `-${loc.discount || 0}%`}</td>
        <td style="padding:14px 16px;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:#0f172a;font-weight:700;font-size:14px;">${fmtDKK(loc.finalAmount || loc.amount || 0)}</td>
      ` : ''}
    </tr>`;
  }).join('');

  const discountHeaders = showDiscount ? `
    <th style="padding:12px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;border-bottom:2px solid #cbd5e1;">Rabat</th>
    <th style="padding:12px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;border-bottom:2px solid #cbd5e1;">Netto</th>
  ` : '';

  const colSpan = showDiscount ? 5 : 4;

  const subtotalRow = `
    <tr style="background:#0f172a;">
      <td colspan="${colSpan}" style="padding:18px 16px;font-weight:700;color:#ffffff;font-size:14px;">Total</td>
      <td style="padding:18px 16px;text-align:right;white-space:nowrap;font-weight:800;color:#ffffff;font-size:15px;">${totalDays}</td>
      <td style="padding:18px 16px;text-align:right;white-space:nowrap;font-weight:800;color:#ffffff;font-size:16px;">${fmtDKK(totalAmount)}</td>
      ${showDiscount ? `
        <td style="padding:18px 16px;"></td>
        <td style="padding:18px 16px;text-align:right;white-space:nowrap;font-weight:800;color:#ffffff;font-size:16px;">${fmtDKK(totalFinal)}</td>
      ` : ''}
    </tr>`;

  const escapedMessage = userMessage ? userMessage.replace(/\n/g, '<br/>') : '';
  const displaySupplier = supplierName || locationType;

  return `
<!DOCTYPE html>
<html lang="da">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Rapport – ${displaySupplier} – ${month}</title></head>
<body style="margin:0;padding:0;background:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#e2e8f0;padding:40px 16px;">
    <tr><td align="center">
      <table width="680" cellpadding="0" cellspacing="0" style="max-width:680px;width:100%;">

        <!-- HEADER -->
        <tr><td style="background:#0f172a;padding:36px 40px 32px;border-radius:12px 12px 0 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:2px;color:#64748b;margin-bottom:16px;">Leverandørrapport</div>
                <div style="font-size:28px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;margin-bottom:6px;">${displaySupplier}</div>
                <div style="font-size:13px;color:#94a3b8;">Copenhagen Sales · ${locationType}</div>
              </td>
              <td align="right" valign="top">
                <div style="background:#1e293b;border-radius:8px;padding:14px 20px;display:inline-block;">
                  <div style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1px;color:#64748b;margin-bottom:4px;">Periode</div>
                  <div style="font-size:20px;font-weight:800;color:#ffffff;">${month}</div>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- BODY -->
        <tr><td style="background:#ffffff;padding:32px 40px 40px;border-radius:0 0 12px 12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          ${escapedMessage ? `
          <!-- USER MESSAGE -->
          <div style="background:#f8fafc;border-radius:8px;padding:16px 20px;margin-bottom:28px;border:1px solid #e2e8f0;">
            <p style="margin:0;color:#334155;font-size:14px;line-height:1.7;">${escapedMessage}</p>
          </div>
          ` : ''}

          <!-- TABLE -->
          <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;border-bottom:2px solid #cbd5e1;">Lokation</th>
                  <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;border-bottom:2px solid #cbd5e1;">Ref</th>
                  <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;border-bottom:2px solid #cbd5e1;">By</th>
                  <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;border-bottom:2px solid #cbd5e1;">Uger & Dage</th>
                  <th style="padding:12px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;border-bottom:2px solid #cbd5e1;">Dage</th>
                  <th style="padding:12px 16px;text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#94a3b8;border-bottom:2px solid #cbd5e1;">Beløb</th>
                  ${discountHeaders}
                </tr>
              </thead>
              <tbody>${tableRows}</tbody>
              <tfoot>${subtotalRow}</tfoot>
            </table>
          </div>

        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:28px 40px;text-align:center;">
          <div style="font-size:12px;color:#94a3b8;line-height:1.8;">
            <strong style="color:#64748b;">Copenhagen Sales ApS</strong><br/>
            Genereret ${new Date().toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}<br/>
            <span style="font-size:11px;">Ved spørgsmål kontakt venligst jeres kontaktperson hos Copenhagen Sales</span>
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
    const { locationType, month, recipients, subject, message, reportId, reportData, hasDiscountRules, supplierName } = await req.json();

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

    const emailBodyHtml = buildReportHtml(locationType, month, locations, showDiscount, message || '', supplierName);

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
