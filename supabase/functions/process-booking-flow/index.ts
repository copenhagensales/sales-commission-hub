import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default template content per template_key
const FLOW_TEMPLATES: Record<string, { subject: string; content: string; channel: string }> = {
  // Tier A
  flow_a_dag0_email: {
    subject: "Tak for din ansøgning — vi vil gerne tale med dig!",
    content: "Hej {{fornavn}},\n\nTak for din ansøgning til stillingen som {{rolle}} hos Copenhagen Sales.\n\nVi var begejstrede for din profil og vil meget gerne invitere dig til en kort samtale. Kan du inden for de næste par dage?\n\nSvar gerne på denne mail eller ring til os.\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_a_dag0_sms: {
    subject: "",
    content: "Hej {{fornavn}}! Tak for din ansøgning hos Copenhagen Sales. Vi vil gerne booke en samtale med dig – tjek din mail for detaljer 📩",
    channel: "sms",
  },
  flow_a_dag1_precall_sms: {
    subject: "",
    content: "Hej {{fornavn}}, vi ringer til dig i dag angående din ansøgning hos Copenhagen Sales. Glæder os til at tale med dig! 📞",
    channel: "sms",
  },
  flow_a_dag1_call: {
    subject: "Opkald til kandidat",
    content: "Ring til {{fornavn}} angående ansøgning til {{rolle}}. Dag 1 i booking flow.",
    channel: "call_reminder",
  },
  flow_a_dag1_followup_sms: {
    subject: "",
    content: "Hej {{fornavn}}, vi prøvede at ringe dig i dag. Hvornår passer det dig at tale? Svar gerne her eller ring os på [nummer] 😊",
    channel: "sms",
  },
  flow_a_dag2_reminder_email: {
    subject: "Reminder: Vi vil stadig gerne tale med dig",
    content: "Hej {{fornavn}},\n\nVi sendte dig en invitation til samtale i går – har du haft mulighed for at kigge på den?\n\nVi er stadig meget interesserede i din profil til stillingen som {{rolle}}.\n\nSvar gerne med et par tidspunkter der passer dig.\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_a_dag2_call: {
    subject: "2. opkaldsforsøg",
    content: "Ring til {{fornavn}} igen — 2. forsøg. Ansøgning til {{rolle}}.",
    channel: "call_reminder",
  },
  flow_a_dag3_last_attempt: {
    subject: "Sidste kontaktforsøg",
    content: "Hej {{fornavn}},\n\nVi har forsøgt at kontakte dig et par gange vedrørende din ansøgning til {{rolle}} hos Copenhagen Sales.\n\nHvis du stadig er interesseret, vil vi meget gerne høre fra dig. Ellers lukker vi ansøgningen.\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  // Tier B
  flow_b_dag0_email: {
    subject: "Tak for din ansøgning hos Copenhagen Sales",
    content: "Hej {{fornavn}},\n\nTak for din ansøgning til stillingen som {{rolle}} hos Copenhagen Sales.\n\nVi gennemgår din ansøgning og vender tilbage snarest. Hvis du gerne vil booke en samtale med det samme, er du velkommen til at svare på denne mail.\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_b_dag1_sms: {
    subject: "",
    content: "Hej {{fornavn}}, har du set vores mail om din ansøgning hos Copenhagen Sales? Vi vil gerne tale med dig – svar gerne her 😊",
    channel: "sms",
  },
  flow_b_dag2_call: {
    subject: "Opkald til Tier B kandidat",
    content: "Ring til {{fornavn}} angående ansøgning til {{rolle}}. Tier B follow-up.",
    channel: "call_reminder",
  },
  // Tier C
  flow_c_dag0_email: {
    subject: "Tak for din ansøgning hos Copenhagen Sales",
    content: "Hej {{fornavn}},\n\nTak for din ansøgning til stillingen som {{rolle}} hos Copenhagen Sales.\n\nVi har modtaget din ansøgning og vil gennemgå den. Du hører fra os.\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_c_dag4_afslag: {
    subject: "Vedrørende din ansøgning hos Copenhagen Sales",
    content: "Hej {{fornavn}},\n\nTak for din interesse i Copenhagen Sales.\n\nEfter gennemgang af din ansøgning har vi desværre valgt at gå videre med andre kandidater til stillingen som {{rolle}}.\n\nVi ønsker dig held og lykke videre.\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('[process-booking-flow] Starting processing...');

    // Find pending touchpoints that are due
    const { data: pendingTouchpoints, error: tpError } = await supabase
      .from('booking_flow_touchpoints')
      .select(`
        *,
        booking_flow_enrollments!inner(
          id, candidate_id, tier, status, application_id,
          candidates!inner(id, first_name, last_name, email, phone)
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(50);

    if (tpError) {
      console.error('[process-booking-flow] Error fetching touchpoints:', tpError);
      throw tpError;
    }

    console.log(`[process-booking-flow] Found ${pendingTouchpoints?.length || 0} pending touchpoints`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const tp of pendingTouchpoints || []) {
      const enrollment = tp.booking_flow_enrollments;
      const candidate = enrollment.candidates;

      // Check if enrollment is still active (skip pending_approval)
      if (enrollment.status !== 'active') {
        await supabase
          .from('booking_flow_touchpoints')
          .update({ status: 'skipped', updated_at: new Date().toISOString() })
          .eq('id', tp.id);
        skipped++;
        continue;
      }

      // Check if candidate status changed (already booked/hired/rejected)
      const { data: currentApp } = await supabase
        .from('applications')
        .select('status')
        .eq('candidate_id', enrollment.candidate_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const cancelStatuses = ['interview_scheduled', 'hired', 'rejected', 'ghostet', 'takket_nej'];
      if (currentApp && cancelStatuses.includes(currentApp.status)) {
        // Cancel the entire flow
        await supabase
          .from('booking_flow_enrollments')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString(),
            cancelled_reason: `Kandidat status ændret til: ${currentApp.status}`,
          })
          .eq('id', enrollment.id);

        await supabase
          .from('booking_flow_touchpoints')
          .update({ status: 'cancelled' })
          .eq('enrollment_id', enrollment.id)
          .eq('status', 'pending');

        skipped++;
        continue;
      }

      // Get template content
      const template = FLOW_TEMPLATES[tp.template_key];
      if (!template) {
        console.error(`[process-booking-flow] Unknown template: ${tp.template_key}`);
        await supabase
          .from('booking_flow_touchpoints')
          .update({ status: 'failed', error_message: 'Unknown template key' })
          .eq('id', tp.id);
        failed++;
        continue;
      }

      // Check for custom template in DB
      const { data: customTemplate } = await supabase
        .from('email_templates')
        .select('subject, content')
        .eq('template_key', tp.template_key)
        .maybeSingle();

      const subject = customTemplate?.subject || template.subject;
      const content = customTemplate?.content || template.content;

      // Get role from application
      const { data: app } = await supabase
        .from('applications')
        .select('role')
        .eq('candidate_id', enrollment.candidate_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const role = app?.role || 'Salgskonsulent';

      // Replace merge tags
      const mergedContent = content
        .replace(/\{\{fornavn\}\}/g, candidate.first_name || '')
        .replace(/\{\{rolle\}\}/g, role);
      const mergedSubject = subject
        .replace(/\{\{fornavn\}\}/g, candidate.first_name || '')
        .replace(/\{\{rolle\}\}/g, role);

      try {
        if (tp.channel === 'email' && candidate.email) {
          // Send via existing edge function
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-recruitment-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              candidateId: candidate.id,
              email: candidate.email,
              subject: mergedSubject,
              content: mergedContent,
              templateKey: tp.template_key,
            }),
          });

          if (!emailResponse.ok) {
            const errText = await emailResponse.text();
            throw new Error(`Email send failed: ${errText}`);
          }
        } else if (tp.channel === 'sms' && candidate.phone) {
          // Send via existing edge function
          const smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-recruitment-sms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              candidateId: candidate.id,
              phoneNumber: candidate.phone,
              message: mergedContent,
            }),
          });

          if (!smsResponse.ok) {
            const errText = await smsResponse.text();
            throw new Error(`SMS send failed: ${errText}`);
          }
        } else if (tp.channel === 'call_reminder') {
          // Call reminders are just logged — no actual sending needed
          console.log(`[process-booking-flow] Call reminder for ${candidate.first_name}: ${mergedContent}`);
        } else {
          // No contact info for channel
          await supabase
            .from('booking_flow_touchpoints')
            .update({ status: 'skipped', error_message: 'Manglende kontaktinfo' })
            .eq('id', tp.id);
          skipped++;
          continue;
        }

        // Mark as sent
        await supabase
          .from('booking_flow_touchpoints')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', tp.id);

        // Update enrollment current_day
        await supabase
          .from('booking_flow_enrollments')
          .update({ current_day: tp.day })
          .eq('id', enrollment.id);

        processed++;
      } catch (sendError: any) {
        console.error(`[process-booking-flow] Send error for ${tp.id}:`, sendError.message);
        await supabase
          .from('booking_flow_touchpoints')
          .update({ status: 'failed', error_message: sendError.message })
          .eq('id', tp.id);
        failed++;
      }
    }

    // Check for completed flows (all touchpoints sent/skipped/cancelled)
    const { data: activeEnrollments } = await supabase
      .from('booking_flow_enrollments')
      .select('id')
      .eq('status', 'active');

    for (const enrollment of activeEnrollments || []) {
      const { data: remaining } = await supabase
        .from('booking_flow_touchpoints')
        .select('id')
        .eq('enrollment_id', enrollment.id)
        .eq('status', 'pending');

      if (!remaining?.length) {
        await supabase
          .from('booking_flow_enrollments')
          .update({ status: 'completed', completed_at: new Date().toISOString() })
          .eq('id', enrollment.id);
      }
    }

    console.log(`[process-booking-flow] Done. Processed: ${processed}, Skipped: ${skipped}, Failed: ${failed}`);

    return new Response(
      JSON.stringify({ success: true, processed, skipped, failed }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[process-booking-flow] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
