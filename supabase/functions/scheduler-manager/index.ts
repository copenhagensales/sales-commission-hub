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
      const { integration_id, name, provider, credentials, api_url } = body;

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
      // Include api_url in credentials so it's available to the adapter
      const credentialsWithUrl = hasNewCredentials 
        ? { ...credentials, api_url: api_url || credentials.api_url || null }
        : null;
      const credentialsJson = credentialsWithUrl ? JSON.stringify(credentialsWithUrl) : null;

      if (integration_id) {
        // Update existing integration
        const { error: updateError } = await supabase
          .from("dialer_integrations")
          .update({
            name,
            provider,
            api_url: api_url || null,
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
        // Create new integration
        const { data, error } = await supabase.rpc("create_dialer_integration", {
          p_name: name,
          p_provider: provider,
          p_credentials: credentialsJson,
          p_encryption_key: encryptionKey,
        });

        if (error) {
          console.error("RPC error:", error);
          // Fallback to direct insert
          const { data: insertData, error: insertError } = await supabase
            .from("dialer_integrations")
            .insert({
              name,
              provider,
              api_url: api_url || null,
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

        // Update api_url after RPC creation (RPC may not support api_url param)
        if (api_url && data) {
          await supabase
            .from("dialer_integrations")
            .update({ api_url })
            .eq("id", data);
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

      const cronSchedule = schedule || "0 * * * *";
      const jobName = `customer-crm-sync-${client_id}`;
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const functionUrl = `${supabaseUrl}/functions/v1/customer-crm-syncer`;

      // First, try to unschedule any existing job
      try {
        await supabase.rpc("unschedule_integration_sync", { p_job_name: jobName });
        console.log(`[scheduler-manager] Unscheduled existing job: ${jobName}`);
      } catch (e) {
        console.log(`[scheduler-manager] No existing job to unschedule: ${jobName}`);
      }

      // Schedule the cron job using pg_cron
      const { error: cronError } = await supabase.rpc("schedule_integration_sync", {
        p_job_name: jobName,
        p_schedule: cronSchedule,
        p_function_url: functionUrl,
        p_anon_key: anonKey,
        p_client_id: client_id,
      });

      if (cronError) {
        console.error("[scheduler-manager] Failed to schedule cron job:", cronError);
        // Continue anyway, update the database record
      } else {
        console.log(`[scheduler-manager] Scheduled cron job: ${jobName} with schedule: ${cronSchedule}`);
      }

      // Update the database record
      const { error } = await supabase
        .from("customer_integrations")
        .update({
          is_active: true,
          cron_schedule: cronSchedule,
          updated_at: new Date().toISOString(),
        })
        .eq("client_id", client_id);

      if (error) throw error;

      console.log(`[scheduler-manager] Activated customer integration for client: ${client_id}`);
      return new Response(
        JSON.stringify({ success: true, cron_scheduled: !cronError }),
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

      const jobName = `customer-crm-sync-${client_id}`;

      // Unschedule the cron job
      try {
        await supabase.rpc("unschedule_integration_sync", { p_job_name: jobName });
        console.log(`[scheduler-manager] Unscheduled cron job: ${jobName}`);
      } catch (e) {
        console.log(`[scheduler-manager] No job to unschedule: ${jobName}`);
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
