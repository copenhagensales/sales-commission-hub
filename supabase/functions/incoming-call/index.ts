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
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse form data from Twilio
    const formData = await req.formData();
    
    // Extract call metadata
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const callStatus = formData.get('CallStatus') as string;
    const direction = formData.get('Direction') as string || 'inbound';
    const callDuration = formData.get('CallDuration') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const timestamp = formData.get('Timestamp') as string;

    console.log('[incoming-call] Received call event:', {
      callSid,
      from,
      to,
      callStatus,
      direction,
      callDuration,
      recordingUrl,
      timestamp: timestamp || new Date().toISOString()
    });

    // Try to find matching candidate by phone number
    const searchPhone = direction === 'inbound' ? from : to;
    const normalizedPhone = searchPhone?.replace(/\D/g, '').slice(-8);
    
    let candidateId: string | null = null;
    
    if (normalizedPhone) {
      const { data: candidate } = await supabase
        .from('candidates')
        .select('id')
        .or(`phone.ilike.%${normalizedPhone}`)
        .maybeSingle();
      
      if (candidate) {
        candidateId = candidate.id;
        console.log('[incoming-call] Matched to candidate:', candidateId);
      }
    }

    // Determine if this is a new call or status update
    const { data: existingCall } = await supabase
      .from('call_records')
      .select('id, status')
      .eq('twilio_call_sid', callSid)
      .maybeSingle();

    if (existingCall) {
      // Update existing call record
      const updateData: Record<string, unknown> = {
        status: callStatus,
      };

      if (callDuration) {
        updateData.duration_seconds = parseInt(callDuration, 10);
      }
      if (recordingUrl) {
        updateData.recording_url = recordingUrl;
      }
      if (callStatus === 'completed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'failed') {
        updateData.ended_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('call_records')
        .update(updateData)
        .eq('id', existingCall.id);

      if (updateError) {
        console.error('[incoming-call] Error updating call:', updateError);
        throw updateError;
      }

      console.log('[incoming-call] Updated call record:', existingCall.id);
    } else {
      // Create new call record
      const { error: insertError } = await supabase
        .from('call_records')
        .insert({
          twilio_call_sid: callSid,
          from_number: from,
          to_number: to,
          direction: direction,
          status: callStatus,
          started_at: timestamp || new Date().toISOString(),
          candidate_id: candidateId,
          recording_url: recordingUrl,
          duration_seconds: callDuration ? parseInt(callDuration, 10) : null,
        });

      if (insertError) {
        console.error('[incoming-call] Error inserting call:', insertError);
        throw insertError;
      }

      console.log('[incoming-call] Created new call record for:', callSid);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[incoming-call] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
