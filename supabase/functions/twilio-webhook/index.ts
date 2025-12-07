import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get('content-type') || '';
    let data: Record<string, string> = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await req.formData();
      formData.forEach((value, key) => {
        data[key] = value.toString();
      });
    } else {
      data = await req.json();
    }

    console.log('Twilio webhook received:', JSON.stringify(data));

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle incoming SMS
    if (data.MessageSid) {
      console.log('Processing incoming SMS');
      
      const fromNumber = data.From || '';
      const body = data.Body || '';
      const messageSid = data.MessageSid;

      // Try to find candidate by phone number
      const { data: candidates } = await supabase
        .from('candidates')
        .select('id')
        .eq('phone', fromNumber.replace('+45', ''))
        .limit(1);

      const candidateId = candidates?.[0]?.id || null;

      // Log incoming message
      const { error: logError } = await supabase.from('messages').insert({
        candidate_id: candidateId,
        phone_number: fromNumber,
        content: body,
        direction: 'inbound',
        message_type: 'sms',
        status: 'received',
        twilio_sid: messageSid,
      });

      if (logError) {
        console.error('Error logging incoming message:', logError);
      }

      // Return TwiML response (empty - no auto-reply)
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/xml' } 
        }
      );
    }

    // Handle call status updates
    if (data.CallSid) {
      console.log('Processing call status update');
      
      const callSid = data.CallSid;
      const callStatus = data.CallStatus;
      const fromNumber = data.From || '';
      const toNumber = data.To || '';
      const duration = data.CallDuration ? parseInt(data.CallDuration) : null;

      // Update or create call record
      const { data: existingCall } = await supabase
        .from('call_records')
        .select('id')
        .eq('twilio_call_sid', callSid)
        .limit(1);

      if (existingCall && existingCall.length > 0) {
        // Update existing call record
        await supabase
          .from('call_records')
          .update({
            status: callStatus,
            duration_seconds: duration,
            ended_at: callStatus === 'completed' ? new Date().toISOString() : null,
          })
          .eq('twilio_call_sid', callSid);
      } else {
        // Try to find candidate by phone number
        const phoneToSearch = toNumber.replace('+45', '');
        const { data: candidates } = await supabase
          .from('candidates')
          .select('id')
          .eq('phone', phoneToSearch)
          .limit(1);

        const candidateId = candidates?.[0]?.id || null;

        // Create new call record
        await supabase.from('call_records').insert({
          candidate_id: candidateId,
          twilio_call_sid: callSid,
          from_number: fromNumber,
          to_number: toNumber,
          direction: 'outbound',
          status: callStatus,
          duration_seconds: duration,
          started_at: new Date().toISOString(),
        });
      }

      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/xml' } 
        }
      );
    }

    // Unknown webhook type
    console.log('Unknown webhook type received');
    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
