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
    const url = new URL(req.url);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    // Check if this is a request to dial the candidate (after employee answered)
    const destinationNumber = url.searchParams.get('dialTo');
    const parentCallSid = url.searchParams.get('parentCallSid');
    const callerId = url.searchParams.get('callerId');
    
    if (destinationNumber && parentCallSid && callerId) {
      // This is the second step: employee has answered, now dial the candidate
      console.log('[twilio-voice-token] Employee answered - now dialing candidate:', {
        destinationNumber,
        parentCallSid,
        callerId
      });
      
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK" voice="Polly.Mads">Forbinder dig nu til kandidaten.</Say>
  <Dial callerId="${callerId}" timeout="30" action="${supabaseUrl}/functions/v1/incoming-call">
    <Number statusCallback="${supabaseUrl}/functions/v1/incoming-call?parentCallSid=${encodeURIComponent(parentCallSid)}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
      ${destinationNumber}
    </Number>
  </Dial>
  <Say language="da-DK" voice="Polly.Mads">Kandidaten svarede ikke. Opkaldet afsluttes.</Say>
</Response>`;
      
      return new Response(twiml, {
        headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
      });
    }

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

    // For outbound calls (API-initiated to employee), employee will hear a prompt
    // When they press 1 or just answer, we'll connect them to the candidate
    if (direction === 'outbound-api') {
      // Get the candidate number from query params (passed from initiate-call)
      const candidateNumber = url.searchParams.get('candidateNumber');
      
      if (!candidateNumber) {
        console.error('[twilio-voice-token] Missing candidateNumber for outbound call');
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK" voice="Polly.Mads">Der opstod en fejl. Kandidatnummeret mangler.</Say>
  <Hangup/>
</Response>`;
      } else {
        console.log('[twilio-voice-token] Outbound call to employee - will dial candidate:', {
          candidateNumber,
          callerId: from
        });
        
        // When employee answers, immediately connect to candidate
        // We use a Dial action to connect the employee to the candidate
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK" voice="Polly.Mads">Forbinder dig til kandidaten.</Say>
  <Dial callerId="${from}" timeout="30" action="${supabaseUrl}/functions/v1/incoming-call">
    <Number statusCallback="${supabaseUrl}/functions/v1/incoming-call?parentCallSid=${encodeURIComponent(callSid)}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">
      ${candidateNumber}
    </Number>
  </Dial>
  <Say language="da-DK" voice="Polly.Mads">Kandidaten svarede ikke. Opkaldet afsluttes.</Say>
</Response>`;
      }
      
      console.log('[twilio-voice-token] Generated TwiML for employee-first flow');
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
