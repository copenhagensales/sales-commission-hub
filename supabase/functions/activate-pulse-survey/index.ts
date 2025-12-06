import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get current date in Copenhagen timezone
    const now = new Date();
    const copenhagenDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
    
    const year = copenhagenDate.getFullYear();
    const month = copenhagenDate.getMonth() + 1; // 1-indexed

    console.log(`Checking if pulse survey for ${year}-${month} should be activated...`);

    // Check if survey already exists for this month
    const { data: existingSurvey } = await supabase
      .from('pulse_surveys')
      .select('id')
      .eq('year', year)
      .eq('month', month)
      .single();

    if (existingSurvey) {
      console.log(`Survey for ${year}-${month} already exists`);
      return new Response(
        JSON.stringify({ message: 'Survey already exists for this month', surveyId: existingSurvey.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine activation date (15th of month, or next weekday if weekend)
    const targetDate = new Date(year, month - 1, 15, 9, 0, 0);
    const dayOfWeek = targetDate.getDay();
    
    // If Saturday (6), move to Monday (add 2 days)
    // If Sunday (0), move to Monday (add 1 day)
    if (dayOfWeek === 6) {
      targetDate.setDate(targetDate.getDate() + 2);
    } else if (dayOfWeek === 0) {
      targetDate.setDate(targetDate.getDate() + 1);
    }

    // Check if we're past the activation date
    if (copenhagenDate < targetDate) {
      console.log(`Not yet time to activate survey. Target date: ${targetDate.toISOString()}`);
      return new Response(
        JSON.stringify({ message: 'Not yet time to activate survey', targetDate: targetDate.toISOString() }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new survey for this month
    const { data: newSurvey, error } = await supabase
      .from('pulse_surveys')
      .insert({
        year,
        month,
        is_active: true,
        activated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating survey:', error);
      throw error;
    }

    console.log(`Created new pulse survey for ${year}-${month}:`, newSurvey);

    return new Response(
      JSON.stringify({ message: 'Survey activated successfully', survey: newSurvey }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in activate-pulse-survey:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
