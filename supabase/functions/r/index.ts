import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const code = url.pathname.split('/').pop();

  if (!code) {
    return new Response('Missing code', { status: 400 });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data, error } = await supabase
      .from('short_links')
      .select('id, target_url, candidate_id, first_clicked_at, click_count')
      .eq('code', code)
      .single();

    if (error || !data) {
      return new Response('Link ikke fundet', { status: 404 });
    }

    // Fire-and-forget click logging (don't block redirect)
    const userAgent = req.headers.get('user-agent') ?? null;
    const forwardedFor = req.headers.get('x-forwarded-for') ?? '';
    const ip = forwardedFor.split(',')[0].trim() || null;
    let ipHash: string | null = null;
    if (ip) {
      try {
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
        ipHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
      } catch (_) { ipHash = null; }
    }

    const now = new Date().toISOString();
    const logPromise = Promise.allSettled([
      supabase.from('short_link_clicks').insert({
        short_link_id: data.id,
        candidate_id: data.candidate_id,
        user_agent: userAgent,
        ip_hash: ipHash,
      }),
      supabase
        .from('short_links')
        .update({
          click_count: (data.click_count ?? 0) + 1,
          last_clicked_at: now,
          ...(data.first_clicked_at ? {} : { first_clicked_at: now }),
        })
        .eq('id', data.id),
    ]);
    // @ts-ignore - EdgeRuntime is provided by Supabase Edge Runtime
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(logPromise);
    }

    return new Response(null, {
      status: 302,
      headers: { 'Location': data.target_url },
    });
  } catch (e) {
    console.error('[r] Error:', e);
    return new Response('Server error', { status: 500 });
  }
});
