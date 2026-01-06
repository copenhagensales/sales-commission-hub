import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to escape XML special characters
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Helper to generate voicemail TwiML - using plain voice without Polly
function generateVoicemailTwiml(introMessage: string): string {
  const escapedMessage = escapeXml(introMessage);
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK">${escapedMessage}</Say>
  <Pause length="1"/>
  <Say language="da-DK">Efterlad venligst en besked efter tonen.</Say>
  <Record maxLength="120" transcribe="false" playBeep="true"/>
  <Say language="da-DK">Tak for din besked. Vi vender tilbage hurtigst muligt.</Say>
</Response>`;
}

// Helper to return TwiML response
function twimlResponse(twiml: string): Response {
  return new Response(twiml, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/xml',
    },
  });
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Log incoming request details including protocol info
  const requestId = crypto.randomUUID().slice(0, 8);
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'unknown';
  const host = req.headers.get('host') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';
  
  console.log(`[twilio-voice-token][${requestId}] Incoming request:`, {
    method: req.method,
    url: req.url,
    host,
    forwardedProto,
    userAgent: userAgent.substring(0, 100),
    contentType: req.headers.get('content-type'),
    timestamp: new Date().toISOString()
  });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Robust form data parsing with fallbacks
    let callSid = '';
    let from = '';
    let to = '';
    let callStatus = '';
    let direction = '';
    let called = '';

    try {
      const contentType = req.headers.get('content-type') || '';
      console.log(`[twilio-voice-token][${requestId}] Content-Type: ${contentType}`);

      if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await req.formData();
        callSid = (formData.get('CallSid') as string) || '';
        from = (formData.get('From') as string) || '';
        to = (formData.get('To') as string) || '';
        callStatus = (formData.get('CallStatus') as string) || '';
        direction = (formData.get('Direction') as string) || '';
        called = (formData.get('Called') as string) || '';

        console.log(`[twilio-voice-token][${requestId}] Parsed form data:`, {
          callSid,
          from,
          to,
          called,
          callStatus,
          direction
        });
      } else {
        console.warn(`[twilio-voice-token][${requestId}] Unexpected content-type, proceeding with defaults`);
      }
    } catch (parseError) {
      console.warn(`[twilio-voice-token][${requestId}] Failed to parse request body:`, parseError);
      // Continue with empty values - will generate fallback TwiML
    }

    let twiml: string;

    // Check if this is an outbound call from a browser client
    const isOutboundFromClient = from?.startsWith('client:') && to && !to.startsWith('client:');
    
    console.log(`[twilio-voice-token][${requestId}] Call type detection:`, {
      direction,
      isOutboundFromClient,
      fromStartsWithClient: from?.startsWith('client:'),
      toStartsWithClient: to?.startsWith('client:')
    });

    // For outbound calls (API-initiated or from browser client)
    if (direction === 'outbound-api' || isOutboundFromClient) {
      const url = new URL(req.url);
      const dialToParam = url.searchParams.get('dialTo');
      // Clean phone number: remove spaces and ensure proper formatting
      const rawNumber = dialToParam || to || called;
      const destinationNumber = rawNumber.replace(/\s+/g, '');

      const twilioCallerIdRaw = Deno.env.get('TWILIO_PHONE_NUMBER');
      const twilioCallerId = twilioCallerIdRaw?.replace(/[^\d+]/g, '');
      const callerId = (twilioCallerId && twilioCallerId.startsWith('+')) ? twilioCallerId : undefined;

      console.log(`[twilio-voice-token][${requestId}] Outbound call - dialing to:`, {
        destinationNumber,
        callerId,
        dialToParam,
        isOutboundFromClient,
      });

      const escapedDestination = escapeXml(destinationNumber);
      const statusCallbackUrl = `${supabaseUrl}/functions/v1/incoming-call?parentCallSid=${encodeURIComponent(callSid)}`;

      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial${callerId ? ` callerId="${escapeXml(callerId)}"` : ''} timeout="30">
    <Number statusCallback="${escapeXml(statusCallbackUrl)}" statusCallbackEvent="initiated ringing answered completed" statusCallbackMethod="POST">${escapedDestination}</Number>
  </Dial>
</Response>`;

      console.log(`[twilio-voice-token][${requestId}] Generated outbound TwiML`);
    } else {
      // For inbound calls, try to route to connected browser clients
      console.log(`[twilio-voice-token][${requestId}] Inbound call - routing to browser clients`);
      
      // Wrap database query in try/catch to prevent failures from breaking calls
      let employees: { id: string }[] = [];
      try {
        const { data, error } = await supabaseClient
          .from('employee_master_data')
          .select('id')
          .eq('is_active', true)
          .limit(5); // Reduced limit for more reliable dialing

        if (error) {
          console.error(`[twilio-voice-token][${requestId}] DB query error:`, error);
        } else {
          employees = data || [];
        }
      } catch (dbError) {
        console.error(`[twilio-voice-token][${requestId}] DB query exception:`, dbError);
        // Continue with empty employees - will use voicemail fallback
      }

      console.log(`[twilio-voice-token][${requestId}] Found ${employees.length} active employees to dial`);

      if (employees.length > 0) {
        // Create Client elements for each potential agent
        const clientElements = employees
          .map(emp => `    <Client>agent_${emp.id}</Client>`)
          .join('\n');

        const actionUrl = `${supabaseUrl}/functions/v1/incoming-call`;

        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial timeout="20" action="${escapeXml(actionUrl)}" method="POST">
${clientElements}
  </Dial>
  <Say language="da-DK">Ingen agenter er tilgængelige. Efterlad venligst en besked efter tonen.</Say>
  <Record maxLength="120" transcribe="false" playBeep="true"/>
  <Say language="da-DK">Tak for din besked. Vi vender tilbage hurtigst muligt.</Say>
</Response>`;

        console.log(`[twilio-voice-token][${requestId}] Generated inbound TwiML with ${employees.length} client targets`);
      } else {
        // No agents available, go to voicemail
        console.log(`[twilio-voice-token][${requestId}] No active employees, generating voicemail TwiML`);
        twiml = generateVoicemailTwiml('Tak for dit opkald til CPH Sales. Der er ingen agenter tilgængelige lige nu.');
      }
    }

    console.log(`[twilio-voice-token][${requestId}] Returning TwiML response (length: ${twiml.length})`);
    return twimlResponse(twiml);

  } catch (error) {
    console.error(`[twilio-voice-token][${requestId}] Unhandled error:`, error);
    
    // Return graceful error TwiML that keeps call alive with voicemail option
    const errorTwiml = generateVoicemailTwiml('Tak for dit opkald. Der opstod en teknisk fejl.');
    return twimlResponse(errorTwiml);
  }
});
