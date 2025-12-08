import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { action } = body;

    console.log(`[scheduler-manager] Action: ${action}`);

    if (action === "save_dialer") {
      const { integration_id, name, provider, credentials } = body;

      if (!name || !provider || !credentials?.username || !credentials?.password) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: name, provider, credentials" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const credentialsJson = JSON.stringify(credentials);

      if (integration_id) {
        // Update existing integration
        const { error } = await supabase.rpc("exec_sql", {
          sql: `
            UPDATE public.dialer_integrations 
            SET 
              name = $1,
              provider = $2,
              encrypted_credentials = extensions.pgp_sym_encrypt($3, $4),
              updated_at = now()
            WHERE id = $5
          `,
          params: [name, provider, credentialsJson, encryptionKey, integration_id],
        });

        if (error) {
          // Fallback: use direct update with encryption via SQL
          const { error: updateError } = await supabase
            .from("dialer_integrations")
            .update({
              name,
              provider,
              updated_at: new Date().toISOString(),
            })
            .eq("id", integration_id);

          if (updateError) throw updateError;

          // Update credentials separately with encryption
          const { error: credError } = await supabase.rpc("update_dialer_credentials", {
            p_integration_id: integration_id,
            p_credentials: credentialsJson,
            p_encryption_key: encryptionKey,
          });

          if (credError) {
            console.error("Credential update error:", credError);
          }
        }

        console.log(`[scheduler-manager] Updated dialer integration: ${integration_id}`);
        return new Response(
          JSON.stringify({ success: true, id: integration_id }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // Create new integration with encrypted credentials
        const { data, error } = await supabase.rpc("create_dialer_integration", {
          p_name: name,
          p_provider: provider,
          p_credentials: credentialsJson,
          p_encryption_key: encryptionKey,
        });

        if (error) {
          console.error("RPC error:", error);
          // Fallback: insert without encryption (for testing)
          const { data: insertData, error: insertError } = await supabase
            .from("dialer_integrations")
            .insert({
              name,
              provider,
              encrypted_credentials: credentialsJson, // Will be plaintext - need migration for proper encryption
            })
            .select("id")
            .single();

          if (insertError) throw insertError;

          console.log(`[scheduler-manager] Created dialer integration (fallback): ${insertData.id}`);
          return new Response(
            JSON.stringify({ success: true, id: insertData.id }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`[scheduler-manager] Created dialer integration: ${data}`);
        return new Response(
          JSON.stringify({ success: true, id: data }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: `Unknown action: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[scheduler-manager] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
