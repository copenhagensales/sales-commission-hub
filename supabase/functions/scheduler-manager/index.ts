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

    // ============ DIALER INTEGRATIONS ============
    if (action === "save_dialer") {
      const { integration_id, name, provider, credentials } = body;

      if (!integration_id && (!name || !provider || !credentials?.username || !credentials?.password)) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: name, provider, credentials" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (integration_id && (!name || !provider)) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: name, provider" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const hasNewCredentials = credentials?.username && credentials?.password;
      const credentialsJson = hasNewCredentials ? JSON.stringify(credentials) : null;

      if (integration_id) {
        const { error: updateError } = await supabase
          .from("dialer_integrations")
          .update({
            name,
            provider,
            updated_at: new Date().toISOString(),
          })
          .eq("id", integration_id);

        if (updateError) throw updateError;

        if (hasNewCredentials) {
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
        const { data, error } = await supabase.rpc("create_dialer_integration", {
          p_name: name,
          p_provider: provider,
          p_credentials: credentialsJson,
          p_encryption_key: encryptionKey,
        });

        if (error) {
          console.error("RPC error:", error);
          const { data: insertData, error: insertError } = await supabase
            .from("dialer_integrations")
            .insert({
              name,
              provider,
              encrypted_credentials: credentialsJson || "{}",
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

    // ============ CUSTOMER CRM INTEGRATIONS ============
    if (action === "save_config") {
      const { client_id, crm_type, api_url, credentials, config } = body;

      if (!client_id || !crm_type) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: client_id, crm_type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const credentialsJson = JSON.stringify(credentials || {});
      const configJson = config || {};

      // Use RPC to create/update with encrypted credentials
      const { data, error } = await supabase.rpc("create_customer_integration", {
        p_client_id: client_id,
        p_crm_type: crm_type,
        p_api_url: api_url || null,
        p_credentials: credentialsJson,
        p_config: configJson,
        p_cron_schedule: body.cron_schedule || "0 * * * *",
        p_encryption_key: encryptionKey,
      });

      if (error) {
        console.error("[scheduler-manager] save_config RPC error:", error);
        throw error;
      }

      console.log(`[scheduler-manager] Saved customer integration for client: ${client_id}, id: ${data}`);
      return new Response(
        JSON.stringify({ success: true, id: data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "activate") {
      const { client_id, schedule } = body;

      if (!client_id) {
        return new Response(
          JSON.stringify({ error: "Missing client_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("customer_integrations")
        .update({
          is_active: true,
          cron_schedule: schedule || "0 * * * *",
          updated_at: new Date().toISOString(),
        })
        .eq("client_id", client_id);

      if (error) throw error;

      console.log(`[scheduler-manager] Activated customer integration for client: ${client_id}`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "deactivate") {
      const { client_id } = body;

      if (!client_id) {
        return new Response(
          JSON.stringify({ error: "Missing client_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("customer_integrations")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("client_id", client_id);

      if (error) throw error;

      console.log(`[scheduler-manager] Deactivated customer integration for client: ${client_id}`);
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
