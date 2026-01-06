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
      from,
      to,
      bodyPreview: body?.substring(0, 50),
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

    // Normalize phone number for matching (last 8 digits for Danish numbers)
    const normalizedPhone = from?.replace(/\D/g, '').slice(-8);
    
    let applicationId: string | null = null;
    
    if (normalizedPhone) {
      // Try to find matching candidate by phone number
      const { data: candidate } = await supabase
        .from('candidates')
        .select('id')
        .or(`phone.ilike.%${normalizedPhone}`)
        .maybeSingle();
      
      if (candidate) {
        console.log('[receive-sms] Matched to candidate:', candidate.id);
        
        // Find most recent application for this candidate
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
      } else {
        console.log('[receive-sms] No candidate match found for phone:', normalizedPhone);
      }
    }

    // Store SMS as immutable record in communication_logs
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
