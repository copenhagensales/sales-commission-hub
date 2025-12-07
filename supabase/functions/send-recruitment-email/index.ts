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
    const { candidateId, email, subject, content, employeeId, templateKey } = await req.json();

    if (!email || !subject || !content) {
      return new Response(
        JSON.stringify({ error: 'Email, subject and content are required' }),
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

    console.log(`Sending email to ${email}`);

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

    // Send email via Microsoft Graph
    const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;

    const emailPayload = {
      message: {
        subject: subject,
        body: {
          contentType: 'HTML',
          content: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="padding: 20px 0; border-bottom: 1px solid #eee;">
                <h2 style="margin: 0; color: #333;">COPENHAGEN SALES</h2>
              </div>
              <div style="padding: 20px 0;">
                ${content}
              </div>
              <div style="padding: 20px 0; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                <p>Med venlig hilsen,<br>Copenhagen Sales</p>
              </div>
            </div>
          `,
        },
        toRecipients: [{ emailAddress: { address: email } }],
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
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Email sent successfully');

    // Log the message in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: logError } = await supabase.from('messages').insert({
      candidate_id: candidateId || null,
      employee_id: employeeId || null,
      content: `Subject: ${subject}\n\n${content}`,
      direction: 'outbound',
      message_type: 'email',
      status: 'sent',
    });

    if (logError) {
      console.error('Error logging message:', logError);
    }

    return new Response(
      JSON.stringify({ success: true }),
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
