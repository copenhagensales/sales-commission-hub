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
    const { locationType, month, recipients, subject, message, reportId, reportData } = await req.json();

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

    // Build HTML report table
    const locations = reportData || [];
    const tableRows = locations.map((loc: any) => `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;">${loc.locationName || ''}</td>
        <td style="padding:8px;border:1px solid #ddd;">${loc.city || ''}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${loc.days || 0}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${(loc.amount || 0).toLocaleString('da-DK')} kr</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;">${loc.isExcluded ? 'Separat' : `-${loc.discount || 0}%`}</td>
        <td style="padding:8px;border:1px solid #ddd;text-align:right;font-weight:bold;">${(loc.finalAmount || loc.amount || 0).toLocaleString('da-DK')} kr</td>
      </tr>
    `).join('');

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <div style="padding:20px 0;border-bottom:1px solid #eee;">
          <h2 style="margin:0;color:#333;">COPENHAGEN SALES</h2>
          <p style="color:#666;margin:5px 0 0;">Leverandørrapport</p>
        </div>
        <div style="padding:20px 0;">
          <p>${message.replace(/\n/g, '<br/>')}</p>
          <h3>Rapport: ${locationType} – ${month}</h3>
          <table style="width:100%;border-collapse:collapse;margin:15px 0;">
            <thead>
              <tr style="background:#f5f5f5;">
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">Lokation</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:left;">By</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Dage</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Beløb</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Rabat</th>
                <th style="padding:8px;border:1px solid #ddd;text-align:right;">Efter rabat</th>
              </tr>
            </thead>
            <tbody>${tableRows}</tbody>
          </table>
        </div>
        <div style="padding:20px 0;border-top:1px solid #eee;font-size:12px;color:#666;">
          <p>Copenhagen Sales ApS</p>
        </div>
      </div>
    `;

    // Send email
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
          body: { contentType: 'HTML', content: htmlBody },
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
