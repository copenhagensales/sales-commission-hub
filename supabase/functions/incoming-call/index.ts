import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map Twilio status to normalized DB status
// Twilio can send "answered" which should be mapped to "in-progress"
const mapTwilioStatusToDbStatus = (status: string): string => {
  const mapping: Record<string, string> = {
    'initiated': 'initiated',
    'queued': 'initiated',
    'ringing': 'ringing',
    'answered': 'in-progress',  // Twilio sends "answered" when call is picked up
    'in-progress': 'in-progress',
    'completed': 'completed',
    'busy': 'busy',
    'no-answer': 'no-answer',
    'failed': 'failed',
    'canceled': 'canceled'
  };
  return mapping[status?.toLowerCase()] || status;
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

    // Check for parent call SID in query params (passed from twilio-voice-token for destination leg)
    const url = new URL(req.url);
    const parentCallSidFromQuery = url.searchParams.get('parentCallSid');

    // Parse form data from Twilio
    const formData = await req.formData();
    
    // Extract call metadata
    const callSid = formData.get('CallSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const rawCallStatus = formData.get('CallStatus') as string;
    const rawDirection = formData.get('Direction') as string || 'inbound';
    const callDuration = formData.get('CallDuration') as string;
    const recordingUrl = formData.get('RecordingUrl') as string;
    const timestamp = formData.get('Timestamp') as string;

    // Get parent call SID from form data or query params
    const parentCallSidFromForm = formData.get('ParentCallSid') as string;
    const parentCallSid = parentCallSidFromQuery || parentCallSidFromForm;
    const answeredBy = formData.get('AnsweredBy') as string;

    // Normalize status: map Twilio "answered" to "in-progress"
    const callStatus = mapTwilioStatusToDbStatus(rawCallStatus);
    
    // Normalize direction: Twilio sends 'outbound-api' but our DB only allows 'inbound' or 'outbound'
    const direction = rawDirection === 'outbound-api' ? 'outbound' : rawDirection;

    console.log('[incoming-call] Received call event:', {
      callSid,
      parentCallSid,
      from,
      to,
      rawCallStatus,
      callStatus, // normalized
      direction,
      rawDirection,
      callDuration,
      recordingUrl,
      answeredBy,
      timestamp: timestamp || new Date().toISOString()
    });

    // If this is a destination call (has parent), we only want to update the parent's status
    // The key status changes are: ringing -> in-progress (answered) -> completed
    if (parentCallSid) {
      console.log('[incoming-call] Destination call status update for parent:', parentCallSid, 'raw status:', rawCallStatus, 'normalized:', callStatus);
      
      // Find the parent call record
      const { data: parentCall } = await supabase
        .from('call_records')
        .select('id, status, connected_at')
        .eq('twilio_call_sid', parentCallSid)
        .maybeSingle();
      
      if (parentCall) {
        const updateData: Record<string, unknown> = {
          status: callStatus,
        };

        // When call becomes in-progress (answered), set connected_at
        if (callStatus === 'in-progress' && !parentCall.connected_at) {
          updateData.connected_at = new Date().toISOString();
          console.log('[incoming-call] Call answered - setting connected_at');
        }

        if (callDuration) {
          updateData.duration_seconds = parseInt(callDuration, 10);
        }
        if (recordingUrl) {
          updateData.recording_url = recordingUrl;
        }
        if (callStatus === 'completed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'failed' || callStatus === 'canceled') {
          updateData.ended_at = new Date().toISOString();
        }

        const { error: updateError } = await supabase
          .from('call_records')
          .update(updateData)
          .eq('id', parentCall.id);

        if (updateError) {
          console.error('[incoming-call] Error updating parent call:', updateError);
          throw updateError;
        }

        console.log('[incoming-call] Updated parent call record:', parentCall.id, 'with status:', callStatus, 'data:', updateData);
      } else {
        console.log('[incoming-call] Parent call record not found for:', parentCallSid);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // For non-child calls, handle normally
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

    // Check if this call record already exists
    const { data: existingCall } = await supabase
      .from('call_records')
      .select('id, status, twilio_call_sid')
      .eq('twilio_call_sid', callSid)
      .maybeSingle();

    if (existingCall) {
      // Update existing call record
      // IMPORTANT: For parent calls (outbound-api), do NOT set connected_at here!
      // connected_at should ONLY be set by the destination leg callback when the candidate actually answers
      // The parent call goes "in-progress" as soon as TwiML starts executing, not when the candidate answers
      const updateData: Record<string, unknown> = {};
      
      // Only update status for terminal states or if it's an inbound call
      // For outbound-api calls, the destination leg will update the parent's status
      if (rawDirection !== 'outbound-api' || callStatus === 'completed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'failed' || callStatus === 'canceled') {
        updateData.status = callStatus;
      }

      // For inbound calls, set connected_at when answered
      if (rawDirection === 'inbound' && callStatus === 'in-progress') {
        const { data: currentRecord } = await supabase
          .from('call_records')
          .select('connected_at')
          .eq('id', existingCall.id)
          .single();
        
        if (!currentRecord?.connected_at) {
          updateData.connected_at = new Date().toISOString();
          console.log('[incoming-call] Inbound call answered - setting connected_at');
        }
      }

      if (callDuration) {
        updateData.duration_seconds = parseInt(callDuration, 10);
      }
      if (recordingUrl) {
        updateData.recording_url = recordingUrl;
      }
      if (callStatus === 'completed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'failed' || callStatus === 'canceled') {
        updateData.ended_at = new Date().toISOString();
      }

      // Only update if there's something to update
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabase
          .from('call_records')
          .update(updateData)
          .eq('id', existingCall.id);

        if (updateError) {
          console.error('[incoming-call] Error updating call:', updateError);
          throw updateError;
        }

        console.log('[incoming-call] Updated call record:', existingCall.id, 'with data:', updateData);
      } else {
        console.log('[incoming-call] No update needed for parent outbound-api call in-progress state (waiting for destination leg)');
      }
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
