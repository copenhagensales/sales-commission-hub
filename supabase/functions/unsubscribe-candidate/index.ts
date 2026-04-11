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
    const url = new URL(req.url);
    const candidateId = url.searchParams.get('id');

    if (!candidateId) {
      return new Response(renderHtml("Ugyldigt link", "Dette afmeldingslink er ikke gyldigt."), {
        status: 400,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify candidate exists
    const { data: candidate } = await supabase
      .from('candidates')
      .select('id, first_name')
      .eq('id', candidateId)
      .maybeSingle();

    if (!candidate) {
      return new Response(renderHtml("Ukendt kandidat", "Vi kunne ikke finde din profil."), {
        status: 404,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Cancel all active enrollments
    const { data: activeEnrollments } = await supabase
      .from('booking_flow_enrollments')
      .select('id')
      .eq('candidate_id', candidateId)
      .in('status', ['active', 'pending_approval']);

    for (const enrollment of activeEnrollments || []) {
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
          cancelled_reason: 'Kandidat afmeldte sig via link',
        })
        .eq('id', enrollment.id);
    }

    // Update latest application status
    const { data: latestApp } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestApp) {
      await supabase
        .from('applications')
        .update({ status: 'trukket_ansøgning' })
        .eq('id', latestApp.id);
    }

    console.log(`[unsubscribe-candidate] Candidate ${candidateId} unsubscribed. Cancelled ${activeEnrollments?.length || 0} enrollments.`);

    return new Response(
      renderHtml(
        "Du er afmeldt",
        `Hej ${candidate.first_name || ''}, du er nu afmeldt og vil ikke modtage flere beskeder fra os vedrørende denne ansøgning. Tak for din interesse.`
      ),
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  } catch (error: any) {
    console.error('[unsubscribe-candidate] Error:', error);
    return new Response(renderHtml("Fejl", "Der opstod en fejl. Prøv igen senere."), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
});

function renderHtml(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Copenhagen Sales</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #1f2937; }
    .card { background: white; border-radius: 12px; padding: 48px; max-width: 480px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 24px; margin-bottom: 16px; }
    p { color: #6b7280; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;
}
