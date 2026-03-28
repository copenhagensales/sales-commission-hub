import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sanitizePayload, maskEmailInString } from "../_shared/sanitize.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Received application webhook:', JSON.stringify(sanitizePayload(body)));

    const { first_name, last_name, email, phone, role, notes } = body;
    const fbclid = body.fbclid || body.Fbclid || null;
    console.log("Received fbclid:", fbclid);

    if (!first_name || !last_name || !email || !phone || !role) {
      console.error('Missing required fields:', { first_name: !!first_name, last_name: !!last_name, email: !!email, phone: !!phone, role });
      return new Response(
        JSON.stringify({ error: 'Missing required fields: first_name, last_name, email, phone, role' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validRoles = ['fieldmarketing', 'salgskonsulent'];
    if (!validRoles.includes(role.toLowerCase())) {
      console.error('Invalid role:', role);
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be "fieldmarketing" or "salgskonsulent"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const appliedPosition = role.toLowerCase() === 'fieldmarketing' ? 'Fieldmarketing' : 'Salgskonsulent';
    const normalizedEmail = email.trim().toLowerCase();

    // Check for existing candidate by email
    const { data: existingCandidates, error: lookupError } = await supabase
      .from('candidates')
      .select('id, application_count, notes, applied_position')
      .eq('email', normalizedEmail)
      .limit(1);

    if (lookupError) {
      console.error('Error looking up candidate:', lookupError);
      return new Response(
        JSON.stringify({ error: 'Failed to check for existing candidate', details: lookupError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const existingCandidate = existingCandidates && existingCandidates.length > 0 ? existingCandidates[0] : null;

    if (existingCandidate) {
      // Returning applicant – update existing record
      const now = new Date().toISOString().split('T')[0];
      const newCount = (existingCandidate.application_count || 1) + 1;
      const newNote = `Søgte igen ${now} som ${appliedPosition}.${notes ? ' Note: ' + notes.trim() : ''}`;
      const combinedNotes = existingCandidate.notes
        ? `${newNote}\n---\n${existingCandidate.notes}`
        : newNote;

      const { data: updated, error: updateError } = await supabase
        .from('candidates')
        .update({
          status: 'new',
          application_count: newCount,
          is_returning_applicant: true,
          applied_position: appliedPosition,
          notes: combinedNotes,
          phone: phone.trim(),
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          ...(fbclid ? { fbclid } : {}),
        })
        .eq('id', existingCandidate.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating returning candidate:', updateError);
        return new Response(
          JSON.stringify({ error: 'Failed to update candidate', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Returning candidate updated: ${updated.id} (application #${newCount})`);

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Returning applicant updated successfully',
          candidate_id: updated.id,
          is_returning: true,
          application_count: newCount,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // New candidate
    const { data: candidate, error: insertError } = await supabase
      .from('candidates')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: normalizedEmail,
        phone: phone.trim(),
        applied_position: appliedPosition,
        notes: notes?.trim() || null,
        fbclid: fbclid || null,
        source: 'webhook',
        status: 'new',
        application_count: 1,
        is_returning_applicant: false,
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
        candidate_id: candidate.id,
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
