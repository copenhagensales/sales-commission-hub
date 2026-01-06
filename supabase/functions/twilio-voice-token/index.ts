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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const twilioCallerIdRaw = Deno.env.get('TWILIO_PHONE_NUMBER');
    const twilioCallerId = twilioCallerIdRaw?.replace(/[^\d+]/g, '');
    const callerId = (twilioCallerId && twilioCallerId.startsWith('+')) ? twilioCallerId : undefined;

    // Parse form data from Twilio (this is called by Twilio when a call is made via TwiML App)
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string; // This is the "To" parameter from the Twilio Device connect
    const callStatus = formData.get('CallStatus') as string;
    const direction = formData.get('Direction') as string;
    const called = formData.get('Called') as string;
    
    // Get custom parameters passed from the browser
    const candidateId = formData.get('candidateId') as string;

    console.log('[twilio-voice-token] Incoming voice request:', {
      callSid,
      from,
      to,
      called,
      callStatus,
      direction,
      candidateId,
      timestamp: new Date().toISOString()
    });

    // Normalize the destination number
    const destinationNumber = to?.replace(/[^\d+]/g, '') || '';

    if (!destinationNumber || !destinationNumber.startsWith('+')) {
      console.error('[twilio-voice-token] Invalid destination number:', to);
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK">Ugyldigt telefonnummer. Prøv venligst igen.</Say>
  <Hangup/>
</Response>`;
      return new Response(errorTwiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

    // Create a call record for tracking
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    
    const { error: insertError } = await supabaseAdmin
      .from('call_records')
      .insert({
        twilio_call_sid: callSid,
        from_number: callerId || from,
        to_number: destinationNumber,
        direction: 'outbound',
        status: 'initiated',
        started_at: new Date().toISOString(),
        candidate_id: candidateId || null,
      });

    if (insertError) {
      console.error('[twilio-voice-token] Error creating call record:', insertError);
    }

    console.log('[twilio-voice-token] Dialing:', destinationNumber, 'with callerId:', callerId);

    // Generate TwiML to dial the destination number
    // The browser is already connected via WebRTC, this TwiML bridges to the destination
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${callerId ? ` callerId="${callerId}"` : ''} timeout="30" answerOnBridge="true">
    <Number statusCallback="${supabaseUrl}/functions/v1/incoming-call?parentCallSid=${encodeURIComponent(callSid)}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${destinationNumber}</Number>
  </Dial>
</Response>`;

    console.log('[twilio-voice-token] Returning TwiML for outbound dial');

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });

  } catch (error) {
    console.error('[twilio-voice-token] Error:', error);
    
    // Return a basic TwiML error response
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK">Der opstod en fejl. Prøv venligst igen senere.</Say>
  <Hangup/>
</Response>`;

    return new Response(errorTwiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });
  }
});