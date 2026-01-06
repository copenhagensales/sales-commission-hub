import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    // Parse form data from Twilio
    const formData = await req.formData();
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callStatus = formData.get('CallStatus') as string;
    const direction = formData.get('Direction') as string;
    const called = formData.get('Called') as string;

    console.log('[twilio-voice-token] Incoming voice request:', {
      callSid,
      from,
      to,
      called,
      callStatus,
      direction,
      timestamp: new Date().toISOString()
    });

    let twiml: string;

    // For outbound calls (API-initiated), dial directly to the destination number
    // The Twilio API call already connects, this TwiML tells Twilio what to do when answered
    if (direction === 'outbound-api') {
      const destinationNumber = to || called;
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const twilioCallerIdRaw = Deno.env.get('TWILIO_PHONE_NUMBER');
      const twilioCallerId = twilioCallerIdRaw?.replace(/[^\d+]/g, '');
      const fromNormalized = from?.replace(/[^\d+]/g, '');
      const callerId = (twilioCallerId && twilioCallerId.startsWith('+'))
        ? twilioCallerId
        : (fromNormalized?.startsWith('+') ? fromNormalized : undefined);

      console.log('[twilio-voice-token] Outbound call - dialing directly to:', {
        destinationNumber,
        from,
        callerId,
      });

      // Keep TwiML minimal: <Dial><Number/></Dial>
      // Avoid <Dial action="..."> because that endpoint returns JSON (not TwiML).
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${callerId ? ` callerId="${callerId}"` : ''} timeout="30">
    <Number statusCallback="${supabaseUrl}/functions/v1/incoming-call?parentCallSid=${encodeURIComponent(callSid)}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
      ${destinationNumber}
    </Number>
  </Dial>
  <Hangup/>
</Response>`;

      console.log('[twilio-voice-token] Generated TwiML for direct dial');
    } else {
      // For inbound calls, show the welcome message
      console.log('[twilio-voice-token] Inbound call - playing welcome message');
      
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK" voice="Polly.Mads">Tak for dit opkald til CPH Sales. Vent venligst, mens vi forbinder dig.</Say>
  <Pause length="2"/>
  <Say language="da-DK" voice="Polly.Mads">Vi kan desværre ikke besvare dit opkald lige nu. Efterlad venligst en besked efter tonen.</Say>
  <Record maxLength="120" transcribe="false" playBeep="true" />
  <Say language="da-DK" voice="Polly.Mads">Tak for din besked. Vi vender tilbage hurtigst muligt. Farvel.</Say>
  <Hangup/>
</Response>`;
    }

    console.log('[twilio-voice-token] Returning TwiML response');

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
