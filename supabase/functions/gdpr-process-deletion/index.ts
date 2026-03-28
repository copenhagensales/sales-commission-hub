import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeGdprRequest, corsHeaders } from "../_shared/gdpr-auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth guard: only owner or cron token allowed
    const authResult = await authorizeGdprRequest(req);
    if (authResult instanceof Response) return authResult;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find pending deletion requests
    const { data: requests, error: reqError } = await supabase
      .from("gdpr_data_requests")
      .select("*")
      .eq("request_type", "deletion")
      .eq("status", "pending");

    if (reqError) throw reqError;
    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ message: "Ingen ventende sletningsanmodninger", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;

    for (const request of requests) {
      const employeeId = request.employee_id;
      const deletedItems: Record<string, number> = {};

      // 1. Anonymize employee_master_data (keep record but strip PII)
      const { error: anonError } = await supabase
        .from("employee_master_data")
        .update({
          first_name: "Slettet",
          last_name: "Bruger",
          private_email: null,
          work_email: null,
          phone: null,
          cpr_number: null,
          address: null,
          city: null,
          zip_code: null,
          emergency_contact_name: null,
          emergency_contact_phone: null,
          avatar_url: null,
          bank_reg_number: null,
          bank_account_number: null,
          notes: null,
        })
        .eq("id", employeeId);

      if (!anonError) deletedItems.employee_anonymized = 1;

      // 2. Delete login_events
      const { count: loginCount } = await supabase
        .from("login_events")
        .delete({ count: "exact" })
        .eq("employee_id", employeeId);
      deletedItems.login_events_deleted = loginCount || 0;

      // 3. Delete gdpr_consents
      const { count: consentCount } = await supabase
        .from("gdpr_consents")
        .delete({ count: "exact" })
        .eq("employee_id", employeeId);
      deletedItems.consents_deleted = consentCount || 0;

      // 4. Delete communication_logs if they exist
      const { count: commCount } = await supabase
        .from("communication_logs")
        .delete({ count: "exact" })
        .eq("employee_id", employeeId);
      deletedItems.communication_logs_deleted = commCount || 0;

      // 5. Delete password_reset_tokens for this user
      // Get auth_user_id first
      const { data: empData } = await supabase
        .from("employee_master_data")
        .select("auth_user_id")
        .eq("id", employeeId)
        .single();

      if (empData?.auth_user_id) {
        const { count: tokenCount } = await supabase
          .from("password_reset_tokens")
          .delete({ count: "exact" })
          .eq("user_id", empData.auth_user_id);
        deletedItems.reset_tokens_deleted = tokenCount || 0;
      }

      // Note: Sales data is preserved — agent_name stays for reporting purposes.

      // Update request status
      await supabase
        .from("gdpr_data_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", request.id);

      // Log the action
      await supabase.from("gdpr_cleanup_log").insert({
        action: "gdpr_data_deletion",
        records_affected: Object.values(deletedItems).reduce((a, b) => a + b, 0),
        details: {
          request_id: request.id,
          employee_id: employeeId,
          ...deletedItems,
        },
        triggered_by: authResult.caller,
      });

      processed++;
    }

    return new Response(
      JSON.stringify({ message: `Behandlede ${processed} sletningsanmodninger`, processed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
