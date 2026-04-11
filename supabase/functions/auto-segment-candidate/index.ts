import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Top 200 English stop words for language detection
const ENGLISH_WORDS = new Set([
  "the","be","to","of","and","a","in","that","have","i","it","for","not","on","with",
  "he","as","you","do","at","this","but","his","by","from","they","we","her","she","or",
  "an","will","my","one","all","would","there","their","what","so","up","out","if","about",
  "who","get","which","go","me","when","make","can","like","time","no","just","him","know",
  "take","people","into","year","your","good","some","could","them","see","other","than",
  "then","now","look","only","come","its","over","think","also","back","after","use","two",
  "how","our","work","first","well","way","even","new","want","because","any","these","give",
  "day","most","us","am","been","has","had","are","is","was","were","did","does","done",
  "very","much","more","many","should","must","may","might","shall","here","where","why",
  "part","time","full","flexible","hours","experience","years","old","young","apply","job",
  "position","looking","working","interested","available","start","team","sales","customer",
  "service","management","company","business","professional","skills","communication",
]);

// Danish motivation keywords
const MOTIVATION_KEYWORDS = [
  "motiveret", "udvikle mig", "resultater", "bedste", "salg", "konkurrence",
  "energisk", "målrettet", "ambitiøs", "drevet", "passioneret", "entusiastisk",
  "dedikeret", "engageret", "vindermentalitet", "præstere", "vækst", "udfordring",
  "i gang", "gå på", "klar til", "vil gerne", "brænder for", "sulten",
  "går efter", "lyst til", "give den gas", "topmotiveret", "kæmpe for",
];

// Part-time keywords
const PARTTIME_KEYWORDS = ["deltid", "part-time", "part time", "fleksibel", "flexible", "fleksible timer", "flexible hours"];

interface SegmentationSignals {
  detectedAge: number | null;
  ageConfidence: "high" | "medium" | "low" | "none";
  detectedExperienceYears: number | null;
  experienceConfidence: "high" | "medium" | "low" | "none";
  englishWordPct: number;
  isDanish: boolean;
  isPartTime: boolean;
  motivationScore: number;
  motivationKeywordsFound: string[];
  fullTimeIndicators: boolean;
}

function detectAge(text: string): { age: number | null; confidence: "high" | "medium" | "low" | "none" } {
  const lower = text.toLowerCase();

  // Direct age mentions: "jeg er 21 år", "21 år gammel", "er 19 år"
  const directAge = lower.match(/(?:jeg\s+er|er)\s+(\d{1,2})\s+år/);
  if (directAge) {
    const age = parseInt(directAge[1]);
    if (age >= 15 && age <= 70) return { age, confidence: "high" };
  }

  // "X-årig"
  const xAarig = lower.match(/(\d{1,2})-?årig/);
  if (xAarig) {
    const age = parseInt(xAarig[1]);
    if (age >= 15 && age <= 70) return { age, confidence: "high" };
  }

  // Born year: "født i 2003", "årgang 2001"
  const bornYear = lower.match(/(?:født\s+i|årgang)\s+(19\d{2}|20\d{2})/);
  if (bornYear) {
    const year = parseInt(bornYear[1]);
    const age = new Date().getFullYear() - year;
    if (age >= 15 && age <= 70) return { age, confidence: "high" };
  }

  // "XX år gammel" or "XX år og"
  const ageGammelOg = lower.match(/(\d{1,2})\s+år\s+(?:gammel|og)/);
  if (ageGammelOg) {
    const age = parseInt(ageGammelOg[1]);
    if (age >= 15 && age <= 70) return { age, confidence: "medium" };
  }

  // Standalone "XX år" at start of text or after punctuation/comma
  const standaloneAge = lower.match(/(^|[.,]\s*)(\d{1,2})\s+år/);
  if (standaloneAge) {
    const age = parseInt(standaloneAge[2]);
    if (age >= 15 && age <= 70) return { age, confidence: "medium" };
  }

  // Graduation indicators suggesting young age
  const youngIndicators = /(?:færdig med gymnasiet|student|studentereksamen|htx|hhx|stx|hf|lige færdig|nyuddannet|gap\s?year)/;
  if (youngIndicators.test(lower)) {
    return { age: 20, confidence: "medium" };
  }

  return { age: null, confidence: "none" };
}

function detectExperience(text: string): { years: number | null; confidence: "high" | "medium" | "low" | "none" } {
  const lower = text.toLowerCase();

  // "X års erfaring", "X years experience"
  const directExp = lower.match(/(\d{1,2})\s+års?\s+(?:erfaring|experience)/);
  if (directExp) {
    return { years: parseInt(directExp[1]), confidence: "high" };
  }

  // "arbejdet i X år", "worked for X years"
  const workedFor = lower.match(/(?:arbejdet|worked)\s+(?:i|for)\s+(\d{1,2})\s+(?:år|years)/);
  if (workedFor) {
    return { years: parseInt(workedFor[1]), confidence: "high" };
  }

  // "salgskonsulent i X år"
  const roleFor = lower.match(/(?:konsulent|sælger|rådgiver|manager|leder)\s+i\s+(\d{1,2})\s+år/);
  if (roleFor) {
    return { years: parseInt(roleFor[1]), confidence: "high" };
  }

  // "ingen erfaring", "første job"
  const noExp = /(?:ingen erfaring|første job|no experience|first job|aldrig arbejdet)/;
  if (noExp.test(lower)) {
    return { years: 0, confidence: "medium" };
  }

  return { years: null, confidence: "none" };
}

function detectLanguage(text: string): { englishPct: number; isDanish: boolean } {
  const words = text.toLowerCase().replace(/[^a-zA-ZæøåÆØÅ\s]/g, '').split(/\s+/).filter(w => w.length > 2);
  if (words.length === 0) return { englishPct: 0, isDanish: true };

  let englishCount = 0;
  for (const word of words) {
    if (ENGLISH_WORDS.has(word)) englishCount++;
  }

  const pct = (englishCount / words.length) * 100;
  return { englishPct: Math.round(pct), isDanish: pct < 40 };
}

function detectPartTime(text: string): boolean {
  const lower = text.toLowerCase();
  return PARTTIME_KEYWORDS.some(kw => lower.includes(kw));
}

function detectMotivation(text: string): { score: number; found: string[] } {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const kw of MOTIVATION_KEYWORDS) {
    if (lower.includes(kw)) found.push(kw);
  }
  return { score: found.length, found };
}

function detectFullTime(text: string): boolean {
  const lower = text.toLowerCase();
  return /(?:fuldtid|full[- ]?time|fuld tid|37 timer|37timer)/.test(lower);
}

function determineTier(signals: SegmentationSignals): { tier: "A" | "B" | "C"; requiresApproval: boolean; reason: string } {
  // Tier C checks first (disqualifiers)
  if (!signals.isDanish) {
    return { tier: "C", requiresApproval: true, reason: "Ansøgning på engelsk (>40% engelske ord)" };
  }
  if (signals.isPartTime) {
    return { tier: "C", requiresApproval: true, reason: "Kandidat søger deltid/fleksibel" };
  }

  // Tier A checks
  const isYoung = signals.detectedAge !== null && signals.detectedAge >= 18 && signals.detectedAge <= 25;
  const isLowExp = signals.detectedExperienceYears !== null && signals.detectedExperienceYears <= 3;
  const hasHighMotivation = signals.motivationScore >= 2;

  if ((isYoung || isLowExp) && signals.isDanish && hasHighMotivation) {
    return { tier: "A", requiresApproval: false, reason: "Ung profil, dansk, høj motivation — auto-start" };
  }

  // Tier B checks
  const isExperienced = (signals.detectedAge !== null && signals.detectedAge >= 30) ||
    (signals.detectedExperienceYears !== null && signals.detectedExperienceYears >= 5);

  if (isExperienced) {
    return { tier: "B", requiresApproval: true, reason: "Erfaren kandidat — kræver godkendelse" };
  }

  // Fallback: can't determine with confidence → Tier B
  if (signals.detectedAge === null && signals.detectedExperienceYears === null) {
    return { tier: "B", requiresApproval: true, reason: "Utilstrækkelige data — kræver manuel gennemgang" };
  }

  // Young without high motivation → still A but less confident
  if (isYoung || isLowExp) {
    return { tier: "A", requiresApproval: false, reason: "Ung profil, dansk — auto-start" };
  }

  return { tier: "B", requiresApproval: true, reason: "Gennemsnitlig profil — kræver godkendelse" };
}

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidate_id, dry_run } = await req.json();
    if (!candidate_id) {
      return new Response(JSON.stringify({ error: "candidate_id is required" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch candidate + latest application
    const { data: candidate, error: candErr } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', candidate_id)
      .single();
    if (candErr || !candidate) throw new Error('Candidate not found');

    const { data: application } = await supabase
      .from('applications')
      .select('*')
      .eq('candidate_id', candidate_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Combine all text for analysis
    const allText = [
      candidate.notes || '',
      application?.notes || '',
      candidate.applied_position || '',
    ].join(' ').trim();

    // Run analysis
    const ageResult = detectAge(allText);
    const expResult = detectExperience(allText);
    const langResult = detectLanguage(allText);
    const isPartTime = detectPartTime(allText);
    const motivationResult = detectMotivation(allText);
    const fullTimeIndicators = detectFullTime(allText);

    const signals: SegmentationSignals = {
      detectedAge: ageResult.age,
      ageConfidence: ageResult.confidence,
      detectedExperienceYears: expResult.years,
      experienceConfidence: expResult.confidence,
      englishWordPct: langResult.englishPct,
      isDanish: langResult.isDanish,
      isPartTime,
      motivationScore: motivationResult.score,
      motivationKeywordsFound: motivationResult.found,
      fullTimeIndicators,
    };

    const { tier, requiresApproval, reason } = determineTier(signals);

    console.log(`[auto-segment] Candidate ${candidate_id}: Tier ${tier}, approval: ${requiresApproval}, reason: ${reason}`);

    if (dry_run) {
      return new Response(JSON.stringify({ tier, requiresApproval, reason, signals }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create enrollment
    const approvalStatus = requiresApproval ? 'pending_approval' : 'auto_approved';
    const enrollmentStatus = requiresApproval ? 'pending_approval' : 'active';

    const { data: enrollment, error: enrollErr } = await supabase
      .from('booking_flow_enrollments')
      .insert({
        candidate_id,
        application_id: application?.id || null,
        tier,
        criteria_met: [{ reason }],
        status: enrollmentStatus,
        approval_status: approvalStatus,
        segmentation_signals: signals,
      })
      .select('id')
      .single();

    if (enrollErr) throw enrollErr;

    // Update candidate tier
    await supabase.from('candidates').update({ tier }).eq('id', candidate_id);

    // If Tier A (auto-approved): create touchpoints + send immediate SMS
      // Fetch flow steps from DB
      const { data: flowSteps, error: stepsErr } = await supabase
        .from('booking_flow_steps')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      
      if (stepsErr || !flowSteps?.length) {
        console.error('[auto-segment] Failed to fetch flow steps:', stepsErr);
        throw new Error('No flow steps found in database');
      }

      const now = new Date();
      const touchpoints = flowSteps.map((step: any) => {
        let scheduledAt: Date;
        if (step.day === 0 && step.offset_hours < 1) {
          scheduledAt = new Date(now.getTime() + step.offset_hours * 3600000);
        } else {
          const dayDate = new Date(now);
          dayDate.setDate(dayDate.getDate() + step.day);
          dayDate.setHours(Math.floor(step.offset_hours), (step.offset_hours % 1) * 60, 0, 0);
          scheduledAt = dayDate;
        }
        return {
          enrollment_id: enrollment.id,
          day: step.day,
          channel: step.channel,
          template_key: step.template_key,
          scheduled_at: scheduledAt.toISOString(),
          status: "pending",
        };
      });

      await supabase.from('booking_flow_touchpoints').insert(touchpoints);

      // Send immediate SMS for Tier A
      if (candidate.phone) {
        const role = application?.role || candidate.applied_position || 'Salgskonsulent';
        const shortDomain = Deno.env.get('SHORT_LINK_DOMAIN') || 'https://job.cphsales.dk';
        const siteUrl = Deno.env.get('SITE_URL') || 'https://sales-sync-pay.lovable.app';
        const recruitmentPhone = Deno.env.get('RECRUITMENT_PHONE_NUMBER') || '+45 XX XX XX XX';

        // Generate short links
        const fullBookingUrl = `${siteUrl}/book/${candidate.id}`;
        const fullUnsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe-candidate?id=${candidate.id}`;

        const bookingCode = generateShortCode();
        await supabase.from('short_links').insert({ code: bookingCode, target_url: fullBookingUrl, candidate_id: candidate.id, link_type: 'booking' });
        const bookingLink = `${shortDomain}/r/${bookingCode}`;

        const unsubCode = generateShortCode();
        await supabase.from('short_links').insert({ code: unsubCode, target_url: fullUnsubscribeUrl, candidate_id: candidate.id, link_type: 'unsubscribe' });
        const unsubscribeUrl = `${shortDomain}/r/${unsubCode}`;

        // Determine call time based on current hour (Danish time)
        const nowDk = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Copenhagen' }));
        const currentHour = nowDk.getHours();
        const currentDay = nowDk.getDay();
        let ringetidspunkt: string;
        if (currentDay === 5 && currentHour >= 14 || currentDay === 6 || currentDay === 0) {
          ringetidspunkt = 'mandag mellem kl. 11:00 og 12:00';
        } else if (currentHour < 14) {
          ringetidspunkt = 'i dag mellem kl. 15:00 og 16:15';
        } else {
          ringetidspunkt = 'i morgen mellem kl. 11:00 og 12:00';
        }

        const smsMessage = `Hej ${candidate.first_name}, tak for din ansøgning til ${role}! Vi ringer dig ${ringetidspunkt} fra ${recruitmentPhone}. Passer det ikke? Book selv en tid: ${bookingLink} — Afmeld: ${unsubscribeUrl}`;

        try {
          await fetch(`${supabaseUrl}/functions/v1/send-recruitment-sms`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              candidateId: candidate.id,
              phoneNumber: candidate.phone,
              message: smsMessage,
            }),
          });
          console.log(`[auto-segment] Tier A SMS sent to ${candidate.first_name}`);
        } catch (smsErr) {
          console.error('[auto-segment] SMS send error:', smsErr);
        }
      }
    }

    return new Response(JSON.stringify({
      tier,
      requiresApproval,
      reason,
      signals,
      enrollmentId: enrollment.id,
      approvalStatus,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[auto-segment] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
