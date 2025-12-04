import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting cleanup of inactive employees older than 5 years...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate date 5 years ago
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const cutoffDate = fiveYearsAgo.toISOString().split("T")[0];

    console.log(`Cutoff date for deletion: ${cutoffDate}`);

    // Find inactive employees with employment_end_date older than 5 years
    const { data: employeesToDelete, error: selectError } = await supabase
      .from("employee_master_data")
      .select("id, first_name, last_name, employment_end_date")
      .eq("is_active", false)
      .not("employment_end_date", "is", null)
      .lte("employment_end_date", cutoffDate);

    if (selectError) {
      console.error("Error selecting employees:", selectError);
      throw selectError;
    }

    console.log(`Found ${employeesToDelete?.length || 0} employees to delete`);

    if (employeesToDelete && employeesToDelete.length > 0) {
      // Log which employees will be deleted
      for (const emp of employeesToDelete) {
        console.log(`Deleting: ${emp.first_name} ${emp.last_name} (end date: ${emp.employment_end_date})`);
      }

      // Delete the employees
      const idsToDelete = employeesToDelete.map((e) => e.id);
      const { error: deleteError } = await supabase
        .from("employee_master_data")
        .delete()
        .in("id", idsToDelete);

      if (deleteError) {
        console.error("Error deleting employees:", deleteError);
        throw deleteError;
      }

      console.log(`Successfully deleted ${employeesToDelete.length} inactive employees`);

      return new Response(
        JSON.stringify({
          success: true,
          deleted: employeesToDelete.length,
          employees: employeesToDelete.map((e) => `${e.first_name} ${e.last_name}`),
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    console.log("No employees to delete");

    return new Response(
      JSON.stringify({
        success: true,
        deleted: 0,
        message: "No inactive employees older than 5 years found",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Cleanup error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
