import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      error: 'Method not allowed. Use POST with JSON body: { toNumber, candidateId, employeeId }' 
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    // Debug logging (masked for security)
    console.log('[initiate-call] TWILIO_ACCOUNT_SID:', accountSid ? `${accountSid.substring(0, 6)}...${accountSid.slice(-4)}` : 'NOT SET');
    console.log('[initiate-call] TWILIO_AUTH_TOKEN:', authToken ? `${authToken.substring(0, 4)}...${authToken.slice(-4)} (length: ${authToken.length})` : 'NOT SET');
    console.log('[initiate-call] TWILIO_PHONE_NUMBER:', twilioNumber || 'NOT SET');

    if (!accountSid || !authToken || !twilioNumber) {
      console.error('[initiate-call] Missing credentials - accountSid:', !!accountSid, 'authToken:', !!authToken, 'twilioNumber:', !!twilioNumber);
      throw new Error('Missing Twilio credentials');
    }

    // NOTE: We intentionally do NOT use ApplicationSid here.
    // When both Url and ApplicationSid are provided, Twilio's ApplicationSid 
    // takes precedence, and if its Voice URL is misconfigured, the call fails.
    // By using only the Url parameter, we have direct control over the TwiML.

    const { toNumber, candidateId, employeeId, employeePhone } = await req.json();

    if (!toNumber) {
      throw new Error('toNumber is required');
    }

    // Get the employee's phone number to call first
    // If not provided in request, try to fetch from employee_master_data
    let callerPhone = employeePhone;
    
    if (!callerPhone && employeeId) {
      const { data: employee } = await supabase
        .from('employee_master_data')
        .select('private_phone')
        .eq('id', employeeId)
        .single();
      
      if (employee?.private_phone) {
        callerPhone = employee.private_phone;
      }
    }
    
    if (!callerPhone) {
      throw new Error('Employee phone number is required. Please add your phone number to your profile.');
    }

    console.log('[initiate-call] Starting two-leg call:', {
      employeePhone: callerPhone,
      candidatePhone: toNumber,
      candidateId
    });

    // Build TwiML URL for the call - pass candidateNumber so we know who to dial after employee answers
    const twimlUrl = `${supabaseUrl}/functions/v1/twilio-voice-token?candidateNumber=${encodeURIComponent(toNumber)}`;

    // Initiate call to EMPLOYEE first (not candidate)
    // When employee answers, TwiML will dial the candidate
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    
    const formData = new URLSearchParams();
    formData.append('To', callerPhone);  // Call the employee first!
    formData.append('From', twilioNumber);
    formData.append('Url', twimlUrl);
    formData.append('Method', 'POST');
    formData.append('StatusCallback', `${supabaseUrl}/functions/v1/incoming-call`);
    formData.append('StatusCallbackMethod', 'POST');
    formData.append('StatusCallbackEvent', 'initiated');
    formData.append('StatusCallbackEvent', 'ringing');
    formData.append('StatusCallbackEvent', 'answered');
    formData.append('StatusCallbackEvent', 'completed');

    // NOTE: We no longer include ApplicationSid - see comment above
    const twilioResponse = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const twilioData = await twilioResponse.json();

    if (!twilioResponse.ok) {
      console.error('[initiate-call] Twilio error:', twilioData);
      throw new Error(twilioData.message || 'Failed to initiate call');
    }

    console.log('[initiate-call] Call initiated:', twilioData.sid);

    // Store call record - note: to_number is the candidate (final destination)
    const { error: insertError } = await supabase
      .from('call_records')
      .insert({
        twilio_call_sid: twilioData.sid,
        from_number: twilioNumber,
        to_number: toNumber,  // Candidate number (final destination)
        direction: 'outbound',
        status: twilioData.status || 'initiated',
        started_at: new Date().toISOString(),
        candidate_id: candidateId || null,
        employee_id: employeeId || null,
        notes: `Two-leg call: Employee ${callerPhone} -> Candidate ${toNumber}`,
      });

    if (insertError) {
      console.error('[initiate-call] Error storing call record:', insertError);
      // Don't throw - call was initiated successfully
    }

    return new Response(JSON.stringify({ 
      success: true, 
      callSid: twilioData.sid,
      status: twilioData.status 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[initiate-call] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
