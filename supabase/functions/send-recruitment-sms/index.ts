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
    const { candidateId, phoneNumber, message, employeeId } = await req.json();

    if (!phoneNumber || !message) {
      return new Response(
        JSON.stringify({ error: 'Phone number and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      console.error('Missing Twilio credentials');
      return new Response(
        JSON.stringify({ error: 'Twilio configuration missing' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format phone number for Denmark if needed
    let formattedPhone = phoneNumber.replace(/\s/g, '');
    if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+45' + formattedPhone;
    }

    console.log(`Sending SMS to ${formattedPhone}`);

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioAuth = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams();
    formData.append('To', formattedPhone);
    formData.append('From', fromNumber);
    formData.append('Body', message);

    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${twilioAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('Twilio error:', twilioResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', details: twilioResult }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('SMS sent successfully:', twilioResult.sid);

    // Log the message in database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: logError } = await supabase.from('messages').insert({
      candidate_id: candidateId || null,
      employee_id: employeeId || null,
      phone_number: formattedPhone,
      content: message,
      direction: 'outbound',
      message_type: 'sms',
      status: twilioResult.status,
      twilio_sid: twilioResult.sid,
    });

    if (logError) {
      console.error('Error logging message:', logError);
    }

    return new Response(
      JSON.stringify({ success: true, messageSid: twilioResult.sid }),
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
