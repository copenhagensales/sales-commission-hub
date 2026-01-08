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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch pending emails that are due
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('scheduled_emails')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error('Error fetching scheduled emails:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingEmails?.length || 0} pending emails to process`);

    if (!pendingEmails || pendingEmails.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, message: 'No pending emails to process' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get M365 credentials
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
      // Mark all as failed
      for (const email of pendingEmails) {
        await supabase
          .from('scheduled_emails')
          .update({ 
            status: 'failed', 
            error_message: 'Failed to authenticate with email service' 
          })
          .eq('id', email.id);
      }
      return new Response(
        JSON.stringify({ error: 'Failed to authenticate with email service' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let processed = 0;
    let failed = 0;

    for (const email of pendingEmails) {
      try {
        console.log(`Processing email ${email.id} to ${email.recipient_email}`);

        // Determine if rejection email (simple format)
        const isRejection = email.template_key === 'afslag';
        
        const emailContent = isRejection
          ? `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; line-height: 1.6; color: #333;">
              ${email.content}
            </div>`
          : `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="padding: 20px 0; border-bottom: 1px solid #eee;">
                <h2 style="margin: 0; color: #333;">COPENHAGEN SALES</h2>
              </div>
              <div style="padding: 20px 0;">
                ${email.content}
              </div>
              <div style="padding: 20px 0; border-top: 1px solid #eee; font-size: 12px; color: #666;">
                <p>Med venlig hilsen,<br>Copenhagen Sales</p>
              </div>
            </div>`;

        const emailPayload = {
          message: {
            subject: email.subject,
            body: {
              contentType: 'HTML',
              content: emailContent,
            },
            toRecipients: [{ emailAddress: { address: email.recipient_email } }],
          },
          saveToSentItems: true,
        };

        const sendMailUrl = `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`;
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
          console.error(`Email send error for ${email.id}:`, errorText);
          
          await supabase
            .from('scheduled_emails')
            .update({ 
              status: 'failed', 
              error_message: `Failed to send: ${errorText.substring(0, 500)}` 
            })
            .eq('id', email.id);
          
          failed++;
          continue;
        }

        // Mark as sent
        await supabase
          .from('scheduled_emails')
          .update({ 
            status: 'sent', 
            sent_at: new Date().toISOString() 
          })
          .eq('id', email.id);

        // Log to messages table
        await supabase.from('messages').insert({
          candidate_id: email.candidate_id,
          employee_id: email.employee_id,
          content: `Subject: ${email.subject}\n\n${email.content}`,
          direction: 'outbound',
          message_type: 'email',
          status: 'sent',
        });

        console.log(`Email ${email.id} sent successfully`);
        processed++;

      } catch (emailError) {
        console.error(`Error processing email ${email.id}:`, emailError);
        
        await supabase
          .from('scheduled_emails')
          .update({ 
            status: 'failed', 
            error_message: emailError instanceof Error ? emailError.message : 'Unknown error' 
          })
          .eq('id', email.id);
        
        failed++;
      }
    }

    console.log(`Processed: ${processed}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ processed, failed, total: pendingEmails.length }),
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
