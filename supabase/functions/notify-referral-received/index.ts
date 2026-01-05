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
    const { 
      referralId,
      candidateFirstName, 
      candidateLastName, 
      candidateEmail, 
      candidatePhone,
      referrerName,
      referrerEmployeeName,
      message
    } = await req.json();

    console.log(`Processing referral notification for ${candidateFirstName} ${candidateLastName}`);

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

    // Get recruitment team emails from database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find employees with job_title containing 'Rekruttering'
    const { data: recruiters, error: recruitersError } = await supabase
      .from('employee_master_data')
      .select('private_email, first_name, last_name')
      .ilike('job_title', '%rekruttering%')
      .eq('is_active', true);

    if (recruitersError) {
      console.error('Error fetching recruiters:', recruitersError);
    }

    const recipientEmails = recruiters?.map(r => r.private_email).filter(Boolean) || [];
    
    if (recipientEmails.length === 0) {
      console.warn('No recruitment emails found, using fallback');
      // Fallback - you might want to configure a default email
    }

    console.log(`Sending notification to ${recipientEmails.length} recruiters`);

    // Send email via Microsoft Graph
    const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

    const emailPayload = {
      message: {
        subject: `🎉 Ny anbefaling modtaget: ${candidateFirstName} ${candidateLastName}`,
        body: {
          contentType: 'HTML',
          content: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
                <h1 style="margin: 0; color: #fff; font-size: 24px;">🎉 Ny anbefaling modtaget!</h1>
              </div>
              
              <div style="background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px;">
                <h2 style="color: #333; margin-top: 0;">Kandidatoplysninger</h2>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666; width: 150px;">Navn:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">${candidateFirstName} ${candidateLastName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Email:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
                      <a href="mailto:${candidateEmail}" style="color: #667eea;">${candidateEmail}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Telefon:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee;">
                      <a href="tel:${candidatePhone}" style="color: #667eea;">${candidatePhone || 'Ikke angivet'}</a>
                    </td>
                  </tr>
                </table>
                
                <h3 style="color: #333; margin-top: 25px;">Henviser</h3>
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666; width: 150px;">Anbefalet af:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; font-weight: bold;">${referrerEmployeeName}</td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee; color: #666;">Kandidat angav:</td>
                    <td style="padding: 10px 0; border-bottom: 1px solid #eee;">${referrerName}</td>
                  </tr>
                </table>
                
                ${message ? `
                <h3 style="color: #333; margin-top: 25px;">Besked fra kandidat</h3>
                <p style="background: #fff; padding: 15px; border-radius: 5px; border-left: 4px solid #667eea; margin: 0;">
                  ${message}
                </p>
                ` : ''}
                
                <div style="margin-top: 30px; padding: 15px; background: #fff3cd; border-radius: 5px;">
                  <p style="margin: 0; color: #856404;">
                    <strong>💡 Husk:</strong> Hvis denne kandidat ansættes, skal der udbetales 3.000 kr. i bonus til ${referrerEmployeeName} efter 2 måneders ansættelse.
                  </p>
                </div>
              </div>
              
              <div style="padding: 20px 0; text-align: center; color: #666; font-size: 12px;">
                <p>Copenhagen Sales - Anbefal en Ven Program</p>
              </div>
            </div>
          `,
        },
        toRecipients: recipientEmails.map(email => ({ emailAddress: { address: email } })),
      },
      saveToSentItems: true,
    };

    const emailResponse = await fetch(sendMailUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('Email send error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Referral notification email sent successfully');

    return new Response(
      JSON.stringify({ success: true, recipientCount: recipientEmails.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
