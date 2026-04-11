import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default template content per template_key
const FLOW_TEMPLATES: Record<string, { subject: string; content: string; channel: string }> = {
  flow_a_dag0_email: {
    subject: "Book en tid til en snak om din ansøgning",
    content: "Hej {{fornavn}},\n\nTak for din ansøgning til stillingen som {{rolle}} hos Copenhagen Sales.\n\nVi vil gerne invitere dig til en uforpligtende snak på 5–10 minutter over telefonen med Oscar, som er ansvarlig for rekruttering.\n\nBook selv den tid der passer dig bedst her:\n{{booking_link}}\n\nIkke interesseret længere? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_a_dag0_sms: {
    subject: "",
    content: "Hej {{fornavn}}! Tak for din ansøgning til {{rolle}}. Vi vil gerne tage en uforpligtende snak på 5–10 min over telefonen. Book selv en tid med Oscar her: {{booking_link}} – Afmeld: {{afmeld_link}}",
    channel: "sms",
  },
  flow_a_dag1_sms: {
    subject: "",
    content: "Hej {{fornavn}} 👋 Har du set vores besked? Vi vil stadig gerne snakke med dig om {{rolle}}. Book en tid her: {{booking_link}} – Afmeld: {{afmeld_link}}",
    channel: "sms",
  },
  flow_a_dag3_email: {
    subject: "Lidt mere om stillingen som {{rolle}}",
    content: "Hej {{fornavn}},\n\nVi ville lige følge op på din ansøgning til {{rolle}} hos Copenhagen Sales.\n\nHos os får du:\n• Grundig oplæring og sparring fra dag ét\n• Et ungt, ambitiøst team\n• Mulighed for at udvikle dig hurtigt\n\nBook en kort snak med Oscar her – det tager kun 5–10 min:\n{{booking_link}}\n\nIkke interesseret længere? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_a_dag6_sms: {
    subject: "",
    content: "Hej {{fornavn}}, vi har stadig en plads åben til {{rolle}} 🙌 Book en tid inden fredag: {{booking_link}} – Afmeld: {{afmeld_link}}",
    channel: "sms",
  },
  flow_a_dag6_email: {
    subject: "Pladsen er stadig åben – book inden fredag",
    content: "Hej {{fornavn}},\n\nVi har stadig en plads åben til stillingen som {{rolle}}, og vi vil rigtig gerne høre fra dig.\n\nBook en tid til en kort snak her – det tager kun 5–10 min:\n{{booking_link}}\n\nVi holder pladsen åben til fredag.\n\nIkke interesseret længere? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_a_dag10_email: {
    subject: "Vi lukker din ansøgning – men døren er åben",
    content: "Hej {{fornavn}},\n\nVi har forsøgt at nå dig angående din ansøgning til {{rolle}} hos Copenhagen Sales, men har desværre ikke hørt fra dig.\n\nVi lukker derfor din ansøgning for nu – men døren er altid åben, hvis du får lyst til at tage en snak på et senere tidspunkt.\n\nDu er velkommen til at booke en tid her:\n{{booking_link}}\n\nVi ønsker dig alt det bedste!\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
  flow_a_dag45_sms: {
    subject: "",
    content: "Hej {{fornavn}} 😊 Det er et stykke tid siden du søgte {{rolle}} hos Copenhagen Sales. Vi leder stadig – har du lyst til en uforpligtende snak? Book her: {{booking_link}} – Afmeld: {{afmeld_link}}",
    channel: "sms",
  },
  flow_a_dag120_email: {
    subject: "Vi har en ny mulighed til dig",
    content: "Hej {{fornavn}},\n\nDet er et stykke tid siden, men vi tænkte på dig – vi søger lige nu en {{rolle}} hos Copenhagen Sales, og din profil passer godt.\n\nHar du lyst til en helt uforpligtende snak? Det tager kun 5–10 min:\n{{booking_link}}\n\nIngen pres – vi vil bare gerne høre, om det kunne have interesse.\n\nIkke interesseret? Klik her – det er helt okay:\n{{afmeld_link}}\n\nMed venlig hilsen\nCopenhagen Sales",
    channel: "email",
  },
};

function generateShortCode(length = 6): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    code += chars[arr[i] % chars.length];
  }
  return code;
}

async function createShortLink(
  supabase: any,
  targetUrl: string,
  candidateId: string,
  linkType: string,
  shortDomain: string
): Promise<string> {
  const code = generateShortCode();
  await supabase.from('short_links').insert({
    code,
    target_url: targetUrl,
    candidate_id: candidateId,
    link_type: linkType,
  });
  return `${shortDomain}/r/${code}`;
}

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
      const shortDomain = Deno.env.get('SHORT_LINK_DOMAIN') || 'https://job.cphsales.dk';
      const siteUrl = Deno.env.get('SITE_URL') || 'https://sales-sync-pay.lovable.app';
      const recruitmentPhone = Deno.env.get('RECRUITMENT_PHONE_NUMBER') || '+45 XX XX XX XX';

      // Generate short links
      const fullBookingUrl = `${siteUrl}/book/${enrollment.candidate_id}`;
      const fullUnsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe-candidate?id=${enrollment.candidate_id}`;
      const bookingLink = await createShortLink(supabase, fullBookingUrl, enrollment.candidate_id, 'booking', shortDomain);
      const unsubscribeUrl = await createShortLink(supabase, fullUnsubscribeUrl, enrollment.candidate_id, 'unsubscribe', shortDomain);

      // Calculate call time based on scheduled_at
      const scheduledDate = new Date(tp.scheduled_at);
      const hour = scheduledDate.getHours();
      const dayOfWeek = scheduledDate.getDay();
      let ringetidspunkt: string;
      if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
        // Friday after 14, Saturday, Sunday → Monday 11-12
        ringetidspunkt = 'mandag mellem kl. 11:00 og 12:00';
      } else if (hour < 14) {
        ringetidspunkt = 'i dag mellem kl. 15:00 og 16:15';
      } else {
        ringetidspunkt = 'i morgen mellem kl. 11:00 og 12:00';
      }

      const mergedContent = content
        .replace(/\{\{fornavn\}\}/g, candidate.first_name || '')
        .replace(/\{\{rolle\}\}/g, role)
        .replace(/\{\{afmeld_link\}\}/g, unsubscribeUrl)
        .replace(/\{\{booking_link\}\}/g, bookingLink)
        .replace(/\{\{ringetidspunkt\}\}/g, ringetidspunkt)
        .replace(/\{\{telefonnummer\}\}/g, recruitmentPhone);
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
