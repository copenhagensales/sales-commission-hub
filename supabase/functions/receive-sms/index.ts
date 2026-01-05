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
    
    // Extract SMS metadata
    const messageSid = formData.get('MessageSid') as string;
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const body = formData.get('Body') as string;
    const numMedia = formData.get('NumMedia') as string;
    const accountSid = formData.get('AccountSid') as string;

    console.log('[receive-sms] Received SMS:', {
      messageSid,
      from,
      to,
      bodyPreview: body?.substring(0, 50),
      numMedia,
      timestamp: new Date().toISOString()
    });

    // Try to find matching candidate by phone number
    const normalizedPhone = from?.replace(/\D/g, '').slice(-8);
    
    let candidateId: string | null = null;
    let applicationId: string | null = null;
    
    if (normalizedPhone) {
      const { data: candidate } = await supabase
        .from('candidates')
        .select('id')
        .or(`phone.ilike.%${normalizedPhone}`)
        .maybeSingle();
      
      if (candidate) {
        candidateId = candidate.id;
        console.log('[receive-sms] Matched to candidate:', candidateId);
        
        // Find most recent application for this candidate
        const { data: application } = await supabase
          .from('applications')
          .select('id')
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (application) {
          applicationId = application.id;
        }
      }
    }

    // Store SMS as immutable record in communication_logs
    const { error: insertError } = await supabase
      .from('communication_logs')
      .insert({
        application_id: applicationId,
        type: 'sms',
        direction: 'inbound',
        content: body,
        twilio_sid: messageSid,
        read: false,
      });

    if (insertError) {
      console.error('[receive-sms] Error inserting SMS:', insertError);
      throw insertError;
    }

    console.log('[receive-sms] Stored SMS for application:', applicationId || 'no match');

    // Return empty TwiML (no auto-reply)
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });

  } catch (error) {
    console.error('[receive-sms] Error:', error);
    
    // Return empty TwiML even on error
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });
  }
});
