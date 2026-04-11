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
      .select('target_url')
      .eq('code', code)
      .single();

    if (error || !data) {
      return new Response('Link ikke fundet', { status: 404 });
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
