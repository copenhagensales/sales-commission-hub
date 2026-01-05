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

    console.log('[twilio-voice-token] Incoming voice request:', {
      callSid,
      from,
      to,
      callStatus,
      direction,
      timestamp: new Date().toISOString()
    });

    // Generate TwiML response
    // This is a placeholder flow - can be extended for AI voice handling or routing
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK" voice="Polly.Mads">Tak for dit opkald til CPH Sales. Vent venligst, mens vi forbinder dig.</Say>
  <Pause length="2"/>
  <Say language="da-DK" voice="Polly.Mads">Vi kan desværre ikke besvare dit opkald lige nu. Efterlad venligst en besked efter tonen.</Say>
  <Record maxLength="120" transcribe="false" playBeep="true" />
  <Say language="da-DK" voice="Polly.Mads">Tak for din besked. Vi vender tilbage hurtigst muligt. Farvel.</Say>
  <Hangup/>
</Response>`;

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
