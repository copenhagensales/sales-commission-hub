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

    // Find pending export requests
    const { data: requests, error: reqError } = await supabase
      .from("gdpr_data_requests")
      .select("*")
      .eq("request_type", "export")
      .eq("status", "pending");

    if (reqError) throw reqError;
    if (!requests || requests.length === 0) {
      return new Response(
        JSON.stringify({ message: "Ingen ventende eksportanmodninger", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processed = 0;

    for (const request of requests) {
      const employeeId = request.employee_id;

      // Gather all employee data
      const [
        employeeRes,
        consentsRes,
        loginEventsRes,
        absenceRes,
        coachingRes,
      ] = await Promise.all([
        supabase.from("employee_master_data").select("*").eq("id", employeeId).single(),
        supabase.from("gdpr_consents").select("*").eq("employee_id", employeeId),
        supabase.from("login_events").select("*").eq("employee_id", employeeId).order("created_at", { ascending: false }).limit(500),
        supabase.from("absence_request_v2").select("*").eq("employee_id", employeeId),
        supabase.from("onboarding_coaching_tasks").select("*").eq("employee_id", employeeId),
      ]);

      // Get sales data via agent email
      let salesData: any[] = [];
      if (employeeRes.data?.work_email) {
        const { data: sales } = await supabase
          .from("sales")
          .select("id, sale_datetime, agent_name, agent_email, customer_phone, customer_company, validation_status, source")
          .eq("agent_email", employeeRes.data.work_email)
          .order("sale_datetime", { ascending: false })
          .limit(1000);
        salesData = sales || [];
      }

      const exportPayload = {
        exported_at: new Date().toISOString(),
        request_id: request.id,
        employee: employeeRes.data || null,
        consents: consentsRes.data || [],
        login_events: loginEventsRes.data || [],
        absence_requests: absenceRes.data || [],
        coaching_tasks: coachingRes.data || [],
        sales: salesData,
      };

      const fileName = `export_${employeeId}_${Date.now()}.json`;
      const fileContent = JSON.stringify(exportPayload, null, 2);

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("gdpr-exports")
        .upload(fileName, new Blob([fileContent], { type: "application/json" }), {
          contentType: "application/json",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        continue;
      }

      // Update request status
      await supabase
        .from("gdpr_data_requests")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          export_file_url: fileName,
        })
        .eq("id", request.id);

      // Log the action
      await supabase.from("gdpr_cleanup_log").insert({
        action: "gdpr_data_export",
        records_affected: 1,
        details: {
          request_id: request.id,
          employee_id: employeeId,
          file_name: fileName,
          sections: Object.keys(exportPayload).length,
        },
        triggered_by: authResult.caller,
      });

      processed++;
    }

    return new Response(
      JSON.stringify({ message: `Eksporterede ${processed} anmodninger`, processed }),
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
