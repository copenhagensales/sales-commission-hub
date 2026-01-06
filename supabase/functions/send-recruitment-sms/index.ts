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
    const { applicationId, phoneNumber, message, candidateId } = await req.json();

    if (!phoneNumber || !message) {
      console.error('[send-recruitment-sms] Missing required fields');
      return new Response(
        JSON.stringify({ error: 'Phone number and message are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      console.error('[send-recruitment-sms] Missing Twilio credentials');
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

    console.log('[send-recruitment-sms] Sending SMS:', {
      to: formattedPhone,
      from: fromNumber,
      messageLength: message.length,
      candidateId,
      applicationId
    });

    // Send SMS via Twilio REST API
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
      console.error('[send-recruitment-sms] Twilio error:', twilioResult);
      return new Response(
        JSON.stringify({ error: 'Failed to send SMS', details: twilioResult.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[send-recruitment-sms] SMS sent successfully:', {
      sid: twilioResult.sid,
      status: twilioResult.status,
      to: formattedPhone
    });

    // Log the message in communication_logs for unified tracking
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First, get the application_id from candidate if we have candidateId but no applicationId
    let finalApplicationId = applicationId;
    if (!finalApplicationId && candidateId) {
      const { data: application } = await supabase
        .from('applications')
        .select('id')
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (application) {
        finalApplicationId = application.id;
      }
    }

    const { data: logData, error: logError } = await supabase
      .from('communication_logs')
      .insert({
        application_id: finalApplicationId || null,
        type: 'sms',
        direction: 'outbound',
        content: message,
        phone_number: formattedPhone,
        twilio_sid: twilioResult.sid,
        read: true, // Outbound messages are marked as read by default
      })
      .select('id')
      .single();

    if (logError) {
      console.error('[send-recruitment-sms] Error logging message:', logError);
      // Don't fail the request - SMS was sent successfully
    } else {
      console.log('[send-recruitment-sms] Message logged:', logData?.id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: twilioResult.sid,
        status: twilioResult.status,
        logId: logData?.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[send-recruitment-sms] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
