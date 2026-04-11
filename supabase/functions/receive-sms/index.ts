import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { maskPhone } from "../_shared/sanitize.ts";

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
    
    // Extract SMS metadata from Twilio webhook
    const messageSid = formData.get('MessageSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const body = formData.get('Body') as string;
    const numMedia = formData.get('NumMedia') as string;
    const accountSid = formData.get('AccountSid') as string;
    const fromCity = formData.get('FromCity') as string;
    const fromCountry = formData.get('FromCountry') as string;

    console.log('[receive-sms] Received inbound SMS:', {
      messageSid,
      from: maskPhone(from),
      to: maskPhone(to),
      bodyLength: body?.length ?? 0,
      numMedia,
      fromCity,
      fromCountry,
      timestamp: new Date().toISOString()
    });

    // Idempotency check - skip if we've already processed this MessageSid
    if (messageSid) {
      const { data: existingMessage } = await supabase
        .from('communication_logs')
        .select('id')
        .eq('twilio_sid', messageSid)
        .maybeSingle();

      if (existingMessage) {
        console.log('[receive-sms] Duplicate webhook - MessageSid already processed:', messageSid);
        return new Response(
          `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
          { headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
        );
      }
    }

    // Smart routing: Find the most recent outbound message to this phone number
    // to determine context (candidate vs employee) and sender
    const { data: lastOutbound } = await supabase
      .from('communication_logs')
      .select('sender_employee_id, context_type, target_employee_id, application_id')
      .eq('phone_number', from)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Inherit context from last outbound message
    const contextType = lastOutbound?.context_type || 'candidate';
    const senderEmployeeId = lastOutbound?.sender_employee_id || null;
    const targetEmployeeId = lastOutbound?.target_employee_id || null;
    let applicationId: string | null = lastOutbound?.application_id || null;

    console.log('[receive-sms] Context from last outbound:', {
      contextType,
      senderEmployeeId,
      targetEmployeeId,
      applicationId
    });

    // For candidate context, try to match candidate if no application found
    if (contextType === 'candidate' && !applicationId) {
      const normalizedPhone = from?.replace(/\D/g, '').slice(-8);
      
      if (normalizedPhone) {
        const { data: candidate } = await supabase
          .from('candidates')
          .select('id')
          .or(`phone.ilike.%${normalizedPhone}`)
          .maybeSingle();
        
        if (candidate) {
          console.log('[receive-sms] Matched to candidate:', candidate.id);
          
          const { data: application } = await supabase
            .from('applications')
            .select('id')
            .eq('candidate_id', candidate.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (application) {
            applicationId = application.id;
            console.log('[receive-sms] Linked to application:', applicationId);
          }
        }
      }
    }

    // Store SMS as immutable record in communication_logs with context
    const { data: insertedLog, error: insertError } = await supabase
      .from('communication_logs')
      .insert({
        application_id: applicationId,
        type: 'sms',
        direction: 'inbound',
        content: body,
        phone_number: from,
        twilio_sid: messageSid,
        read: false,
        context_type: contextType,
        sender_employee_id: senderEmployeeId,
        target_employee_id: targetEmployeeId,
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[receive-sms] Error inserting SMS:', insertError);
      throw insertError;
    }

    console.log('[receive-sms] Stored inbound SMS:', {
      logId: insertedLog?.id,
      applicationId: applicationId || 'no match',
      from,
      bodyLength: body?.length
    });

    // Auto-stop booking flow: if candidate has active enrollment, pause it
    const normalizedPhoneForFlow = from?.replace(/\D/g, '').slice(-8);
    if (normalizedPhoneForFlow) {
      const { data: candidateForFlow } = await supabase
        .from('candidates')
        .select('id')
        .or(`phone.ilike.%${normalizedPhoneForFlow}`)
        .maybeSingle();

      if (candidateForFlow) {
        const { data: activeEnrollments } = await supabase
          .from('booking_flow_enrollments')
          .select('id')
          .eq('candidate_id', candidateForFlow.id)
          .eq('status', 'active');

        if (activeEnrollments && activeEnrollments.length > 0) {
          for (const enrollment of activeEnrollments) {
            await supabase
              .from('booking_flow_touchpoints')
              .update({ status: 'cancelled' })
              .eq('enrollment_id', enrollment.id)
              .eq('status', 'pending');

            await supabase
              .from('booking_flow_enrollments')
              .update({
                status: 'cancelled',
                cancelled_at: new Date().toISOString(),
                cancelled_reason: 'Kandidat svarede på SMS',
              })
              .eq('id', enrollment.id);
          }

          console.log('[receive-sms] Auto-stopped booking flow for candidate:', {
            candidateId: candidateForFlow.id,
            enrollmentsCancelled: activeEnrollments.length,
          });
        }
      }
    }

    // Return empty TwiML (no auto-reply)
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
    );

  } catch (error) {
    console.error('[receive-sms] Error:', error);
    
    // Return empty TwiML even on error to acknowledge receipt
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { headers: { ...corsHeaders, 'Content-Type': 'text/xml' } }
    );
  }
});
