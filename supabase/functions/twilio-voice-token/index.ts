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

    // For outbound calls (API-initiated), use a conference bridge
    // This ensures both parties (initiator and recipient) can hear each other
    if (direction === 'outbound-api') {
      const destinationNumber = to || called;
      
      // Create a unique conference room name based on the call SID
      const conferenceRoom = `call-${callSid}`;
      
      console.log('[twilio-voice-token] Outbound call - creating conference bridge:', {
        conferenceRoom,
        destinationNumber,
        callerId: from
      });
      
      // TwiML: Join the initiator to a conference, then dial the destination into the same conference
      // The <Dial> with callerId ensures the recipient sees the correct caller ID
      twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${from}" timeout="30" action="${Deno.env.get('SUPABASE_URL')}/functions/v1/incoming-call">
    <Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" waitUrl="">
      ${conferenceRoom}
    </Conference>
  </Dial>
  <Say language="da-DK" voice="Polly.Mads">Opkaldet blev afsluttet.</Say>
</Response>`;

      // Also need to dial the destination number into the conference
      // This is done by making a second call to the destination
      const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
      
      if (accountSid && authToken) {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        // Pass the parent call SID as a query parameter so we can link status updates
        const statusCallbackUrl = `${supabaseUrl}/functions/v1/incoming-call?parentCallSid=${encodeURIComponent(callSid)}`;
        
        const dialFormData = new URLSearchParams();
        dialFormData.append('To', destinationNumber);
        dialFormData.append('From', from);
        dialFormData.append('Twiml', `<?xml version="1.0" encoding="UTF-8"?><Response><Conference beep="false" startConferenceOnEnter="true" endConferenceOnExit="true" waitUrl="">${conferenceRoom}</Conference></Response>`);
        // Add status callbacks for the destination call leg
        dialFormData.append('StatusCallback', statusCallbackUrl);
        dialFormData.append('StatusCallbackMethod', 'POST');
        dialFormData.append('StatusCallbackEvent', 'initiated');
        dialFormData.append('StatusCallbackEvent', 'ringing');
        dialFormData.append('StatusCallbackEvent', 'answered');
        dialFormData.append('StatusCallbackEvent', 'completed');
        
        console.log('[twilio-voice-token] Dialing destination into conference:', destinationNumber, 'with status callback:', statusCallbackUrl);
        
        try {
          const dialResponse = await fetch(twilioUrl, {
            method: 'POST',
            headers: {
              'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: dialFormData.toString(),
          });
          
          const dialResult = await dialResponse.json();
          
          if (dialResponse.ok) {
            console.log('[twilio-voice-token] Destination call initiated:', dialResult.sid);
          } else {
            console.error('[twilio-voice-token] Failed to dial destination:', dialResult);
          }
        } catch (dialError) {
          console.error('[twilio-voice-token] Error dialing destination:', dialError);
        }
      } else {
        console.warn('[twilio-voice-token] Missing Twilio credentials for conference bridge');
      }
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
