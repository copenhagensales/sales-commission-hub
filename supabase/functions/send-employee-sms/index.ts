import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth header for user identification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify the user and get their employee ID
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get sender employee ID
    const { data: senderEmployee } = await supabase
      .from('employee_master_data')
      .select('id')
      .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
      .limit(1)
      .maybeSingle();

    if (!senderEmployee) {
      return new Response(JSON.stringify({ error: 'Sender employee not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { targetEmployeeId, message } = await req.json();

    if (!targetEmployeeId || !message) {
      return new Response(JSON.stringify({ error: 'Missing targetEmployeeId or message' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get target employee phone number
    const { data: targetEmployee, error: targetError } = await supabase
      .from('employee_master_data')
      .select('id, first_name, last_name, private_phone')
      .eq('id', targetEmployeeId)
      .single();

    if (targetError || !targetEmployee) {
      console.error('[send-employee-sms] Target employee not found:', targetError);
      return new Response(JSON.stringify({ error: 'Target employee not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!targetEmployee.private_phone) {
      return new Response(JSON.stringify({ error: 'Target employee has no phone number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Format phone number for Twilio
    let toNumber = targetEmployee.private_phone.replace(/\s/g, '');
    if (!toNumber.startsWith('+')) {
      toNumber = '+45' + toNumber.replace(/^0+/, '');
    }

    // Get Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      console.error('[send-employee-sms] Missing Twilio credentials');
      return new Response(JSON.stringify({ error: 'SMS service not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[send-employee-sms] Sending SMS:', {
      from: fromNumber,
      to: toNumber,
      senderEmployeeId: senderEmployee.id,
      targetEmployeeId: targetEmployee.id,
      messageLength: message.length
    });

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: fromNumber,
        To: toNumber,
        Body: message,
      }),
    });

    const twilioResult = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('[send-employee-sms] Twilio error:', twilioResult);
      return new Response(JSON.stringify({ error: 'Failed to send SMS', details: twilioResult }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[send-employee-sms] SMS sent successfully:', twilioResult.sid);

    // Store in communication_logs with employee context
    const { data: logEntry, error: logError } = await supabase
      .from('communication_logs')
      .insert({
        type: 'sms',
        direction: 'outbound',
        content: message,
        phone_number: toNumber,
        twilio_sid: twilioResult.sid,
        context_type: 'employee',
        sender_employee_id: senderEmployee.id,
        target_employee_id: targetEmployee.id,
        application_id: null, // No application for employee messages
        read: true,
      })
      .select('id')
      .single();

    if (logError) {
      console.error('[send-employee-sms] Error logging SMS:', logError);
      // Don't fail - SMS was sent successfully
    }

    return new Response(JSON.stringify({
      success: true,
      messageSid: twilioResult.sid,
      logId: logEntry?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[send-employee-sms] Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
