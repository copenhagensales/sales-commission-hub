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
    const { enrollment_id } = await req.json();
    if (!enrollment_id) {
      return new Response(JSON.stringify({ error: "enrollment_id is required" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch enrollment
    const { data: enrollment, error: enrErr } = await supabase
      .from('booking_flow_enrollments')
      .select('id, status, approved_at, enrolled_at, tier')
      .eq('id', enrollment_id)
      .single();
    if (enrErr || !enrollment) throw new Error('Enrollment not found');

    if (enrollment.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Enrollment is not active', status: enrollment.status }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch active outreach steps
    const { data: flowSteps, error: stepsErr } = await supabase
      .from('booking_flow_steps')
      .select('*')
      .eq('is_active', true)
      .in('phase', ['active', 'reengagement'])
      .order('sort_order', { ascending: true });

    if (stepsErr) throw stepsErr;
    if (!flowSteps?.length) {
      // Mark enrollment as failed
      await supabase
        .from('booking_flow_enrollments')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_reason: 'Ingen flow-trin konfigureret',
        })
        .eq('id', enrollment_id);
      throw new Error('No flow steps configured');
    }

    // Cancel all existing pending touchpoints (clean slate)
    await supabase
      .from('booking_flow_touchpoints')
      .delete()
      .eq('enrollment_id', enrollment_id)
      .eq('status', 'pending');

    // Schedule from approved_at (fallback to now)
    const baseTime = enrollment.approved_at ? new Date(enrollment.approved_at) : new Date();
    const now = new Date();

    const touchpoints = flowSteps.map((step: any) => {
      let scheduledAt: Date;
      if (step.day === 0 && step.offset_hours < 1) {
        scheduledAt = new Date(baseTime.getTime() + step.offset_hours * 3600000);
      } else {
        const dayDate = new Date(baseTime);
        dayDate.setDate(dayDate.getDate() + step.day);
        dayDate.setHours(Math.floor(step.offset_hours), (step.offset_hours % 1) * 60, 0, 0);
        scheduledAt = dayDate;
      }
      // If past, schedule for "now + 1 min" so cron picks it up promptly
      if (scheduledAt < now) {
        scheduledAt = new Date(now.getTime() + 60000);
      }
      return {
        enrollment_id,
        day: step.day,
        channel: step.channel,
        template_key: step.template_key,
        scheduled_at: scheduledAt.toISOString(),
        status: 'pending',
      };
    });

    const { error: insErr } = await supabase
      .from('booking_flow_touchpoints')
      .insert(touchpoints);
    if (insErr) throw insErr;

    return new Response(JSON.stringify({ success: true, count: touchpoints.length }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('[regenerate-flow-touchpoints]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
