import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Received application webhook:', JSON.stringify(body));

    // Validate required fields
    const { first_name, last_name, email, phone, role, notes } = body;

    if (!first_name || !last_name || !email || !phone || !role) {
      console.error('Missing required fields:', { first_name, last_name, email, phone, role });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: first_name, last_name, email, phone, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    const validRoles = ['fieldmarketing', 'salgskonsulent'];
    if (!validRoles.includes(role.toLowerCase())) {
      console.error('Invalid role:', role);
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be "fieldmarketing" or "salgskonsulent"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Map role to applied_position
    const appliedPosition = role.toLowerCase() === 'fieldmarketing' ? 'Fieldmarketing' : 'Salgskonsulent';

    // Create candidate in database
    const { data: candidate, error: insertError } = await supabase
      .from('candidates')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        applied_position: appliedPosition,
        notes: notes?.trim() || null,
        source: 'webhook',
        status: 'new',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting candidate:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create candidate', details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Candidate created successfully:', candidate.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Application received successfully',
        candidate_id: candidate.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Webhook error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
