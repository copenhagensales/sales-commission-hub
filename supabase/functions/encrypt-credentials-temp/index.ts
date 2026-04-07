import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { integration_id, credentials } = await req.json();

  const { error } = await supabase.rpc("update_dialer_credentials", {
    p_integration_id: integration_id,
    p_credentials: JSON.stringify(credentials),
    p_encryption_key: encryptionKey,
  });

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
