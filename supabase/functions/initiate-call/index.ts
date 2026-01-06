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
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY');

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const normalizePhone = (value: unknown) =>
      String(value ?? '')
        .trim()
        .replace(/[^\d+]/g, '');

    // Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioNumberRaw = Deno.env.get('TWILIO_PHONE_NUMBER');
    const twilioNumber = normalizePhone(twilioNumberRaw);

    // Debug logging (masked for security)
    console.log('[initiate-call] TWILIO_ACCOUNT_SID:', accountSid ? `${accountSid.substring(0, 6)}...${accountSid.slice(-4)}` : 'NOT SET');
    console.log('[initiate-call] TWILIO_AUTH_TOKEN:', authToken ? `${authToken.substring(0, 4)}...${authToken.slice(-4)} (length: ${authToken.length})` : 'NOT SET');
    console.log('[initiate-call] TWILIO_PHONE_NUMBER:', twilioNumber || 'NOT SET');

    if (!accountSid || !authToken || !twilioNumber) {
      console.error('[initiate-call] Missing credentials - accountSid:', !!accountSid, 'authToken:', !!authToken, 'twilioNumber:', !!twilioNumber);
      throw new Error('Missing Twilio credentials');
    }

    if (!twilioNumber.startsWith('+')) {
      throw new Error('TWILIO_PHONE_NUMBER must be in E.164 format (e.g. +15551234567)');
    }

    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : '';
    if (!token || !publishableKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const authClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const authUserId = claimsData?.claims?.sub;
    if (claimsError || !authUserId) {
      console.error('[initiate-call] Auth failed', { claimsError });
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { toNumber: toNumberRaw, candidateId, employeeId } = await req.json();

    const toNumber = normalizePhone(toNumberRaw);
    if (!toNumber) throw new Error('toNumber is required');
    if (!toNumber.startsWith('+')) throw new Error('toNumber must be in E.164 format (e.g. +15551234567)');

    // Lookup the employee phone (prefer explicit employeeId, fallback to logged-in user)
    const employeeLookup = employeeId
      ? supabaseAdmin.from('employee_master_data').select('id, private_phone, work_email').eq('id', employeeId).maybeSingle()
      : supabaseAdmin.from('employee_master_data').select('id, private_phone, work_email').eq('auth_user_id', authUserId).maybeSingle();

    const { data: employee, error: employeeErr } = await employeeLookup;
    if (employeeErr) {
      console.error('[initiate-call] Failed to load employee', employeeErr);
      throw new Error('Could not load employee');
    }

    const employeePhone = normalizePhone(employee?.private_phone);
    if (!employeePhone || !employeePhone.startsWith('+')) {
      throw new Error('Your employee phone (private_phone) must be set in E.164 format (e.g. +15551234567)');
    }

    console.log('[initiate-call] Starting click-to-call:', { employeePhone, toNumber, candidateId });

    // TwiML URL tells Twilio: when employee answers, dial the candidate
    const twimlUrl = `${supabaseUrl}/functions/v1/twilio-voice-token?dialTo=${encodeURIComponent(toNumber)}`;

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;

    const formData = new URLSearchParams();
    formData.append('To', employeePhone);
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

    // Store call record
    const { error: insertError } = await supabaseAdmin
      .from('call_records')
      .insert({
        twilio_call_sid: twilioData.sid,
        from_number: twilioNumber,
        to_number: toNumber,
        direction: 'outbound',
        status: twilioData.status || 'initiated',
        started_at: new Date().toISOString(),
        candidate_id: candidateId || null,
        employee_id: employee?.id || employeeId || null,
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
