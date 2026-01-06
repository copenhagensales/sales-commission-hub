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
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

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

    // Check if this is an outbound call from a browser client (To parameter will be the destination)
    // When a Twilio Device connects with params, the 'To' field contains the custom parameter
    const isOutboundFromClient = from?.startsWith('client:') && to && !to.startsWith('client:');
    
    // For outbound calls (API-initiated or from browser client)
    if (direction === 'outbound-api' || isOutboundFromClient) {
      const url = new URL(req.url);
      const dialToParam = url.searchParams.get('dialTo');
      const destinationNumber = dialToParam || to || called;

      const twilioCallerIdRaw = Deno.env.get('TWILIO_PHONE_NUMBER');
      const twilioCallerId = twilioCallerIdRaw?.replace(/[^\d+]/g, '');
      const callerId = (twilioCallerId && twilioCallerId.startsWith('+')) ? twilioCallerId : undefined;

      console.log('[twilio-voice-token] Outbound call - dialing to:', {
        destinationNumber,
        callerId,
        dialToParam,
        isOutboundFromClient,
      });

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${callerId ? ` callerId="${callerId}"` : ''} timeout="30">
    <Number statusCallback="${supabaseUrl}/functions/v1/incoming-call?parentCallSid=${encodeURIComponent(callSid)}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${destinationNumber}</Number>
  </Dial>
</Response>`;

      console.log('[twilio-voice-token] Generated TwiML for direct dial');
    } else {
      // For inbound calls, try to route to connected browser clients
      console.log('[twilio-voice-token] Inbound call - routing to browser clients');
      
      // Look up all active employees to ring their browser clients
      // In a real implementation, you might want to route to specific agents based on business logic
      const { data: employees } = await supabaseClient
        .from('employee_master_data')
        .select('id')
        .eq('is_active', true)
        .limit(10);

      if (employees && employees.length > 0) {
        // Create Client elements for each potential agent
        const clientElements = employees
          .map(emp => `    <Client>agent_${emp.id}</Client>`)
          .join('\n');

        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="30" action="${supabaseUrl}/functions/v1/incoming-call" method="POST">
${clientElements}
  </Dial>
  <Say language="da-DK" voice="Polly.Mads">Ingen agenter er tilgængelige. Efterlad venligst en besked efter tonen.</Say>
  <Record maxLength="120" transcribe="false" playBeep="true" />
  <Say language="da-DK" voice="Polly.Mads">Tak for din besked. Vi vender tilbage hurtigst muligt.</Say>
</Response>`;
      } else {
        // No agents available, go to voicemail
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK" voice="Polly.Mads">Tak for dit opkald til CPH Sales. Der er ingen agenter tilgængelige lige nu.</Say>
  <Say language="da-DK" voice="Polly.Mads">Efterlad venligst en besked efter tonen.</Say>
  <Record maxLength="120" transcribe="false" playBeep="true" />
  <Say language="da-DK" voice="Polly.Mads">Tak for din besked. Vi vender tilbage hurtigst muligt.</Say>
</Response>`;
      }
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
