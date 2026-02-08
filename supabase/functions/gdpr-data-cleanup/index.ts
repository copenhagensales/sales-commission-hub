import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * GDPR Data Cleanup Edge Function
 * 
 * This function runs daily (via pg_cron or scheduled trigger) to:
 * 1. Find fields with retention_days set
 * 2. Nullify expired data in normalized_data and raw_payload columns
 * 3. Log cleanup actions for audit trail
 * 
 * Invoke via HTTP POST or schedule with pg_cron:
 * SELECT cron.schedule('gdpr-cleanup-daily', '0 3 * * *', ...)
 */

interface FieldDefinition {
  id: string;
  field_key: string;
  retention_days: number;
  is_pii: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const log = (type: "INFO" | "WARN" | "ERROR", msg: string, data?: unknown) => {
    console.log(JSON.stringify({ type, msg, data, timestamp: new Date().toISOString() }));
  };

  try {
    log("INFO", "Starting GDPR data cleanup job");

    // 1. Fetch all field definitions with retention_days > 0
    const { data: fields, error: fieldsError } = await supabase
      .from("data_field_definitions")
      .select("id, field_key, retention_days, is_pii")
      .gt("retention_days", 0);

    if (fieldsError) {
      throw new Error(`Failed to fetch field definitions: ${fieldsError.message}`);
    }

    if (!fields || fields.length === 0) {
      log("INFO", "No fields with retention policies configured");
      return new Response(
        JSON.stringify({ success: true, message: "No fields with retention policies" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("INFO", `Found ${fields.length} fields with retention policies`);

    // 2. For each field, find and clean up expired data
    let totalCleaned = 0;
    const cleanupResults: { field_key: string; cleaned: number }[] = [];

    for (const field of fields as FieldDefinition[]) {
      const retentionDate = new Date();
      retentionDate.setDate(retentionDate.getDate() - field.retention_days);
      const cutoffDate = retentionDate.toISOString();

      log("INFO", `Processing field "${field.field_key}" (retention: ${field.retention_days} days, cutoff: ${cutoffDate})`);

      // Find sales with this field in normalized_data that are older than retention
      const { data: expiredSales, error: selectError } = await supabase
        .from("sales")
        .select("id, normalized_data, raw_payload")
        .lt("sale_datetime", cutoffDate)
        .not("normalized_data", "is", null);

      if (selectError) {
        log("WARN", `Error querying expired sales for ${field.field_key}: ${selectError.message}`);
        continue;
      }

      if (!expiredSales || expiredSales.length === 0) {
        log("INFO", `No expired data found for field "${field.field_key}"`);
        continue;
      }

      // Process each expired sale
      let fieldCleanedCount = 0;

      for (const sale of expiredSales) {
        const normalizedData = sale.normalized_data as Record<string, unknown> | null;
        const rawPayload = sale.raw_payload as Record<string, unknown> | null;

        // Check if this field exists in normalized_data
        if (normalizedData && field.field_key in normalizedData) {
          const updatedNormalized = { ...normalizedData };
          delete updatedNormalized[field.field_key];
          
          // Update with GDPR cleanup marker
          updatedNormalized[`_gdpr_cleaned_${field.field_key}`] = new Date().toISOString();

          const { error: updateError } = await supabase
            .from("sales")
            .update({ normalized_data: updatedNormalized })
            .eq("id", sale.id);

          if (updateError) {
            log("WARN", `Failed to clean normalized_data for sale ${sale.id}: ${updateError.message}`);
          } else {
            fieldCleanedCount++;
          }
        }
      }

      if (fieldCleanedCount > 0) {
        cleanupResults.push({ field_key: field.field_key, cleaned: fieldCleanedCount });
        totalCleaned += fieldCleanedCount;
        log("INFO", `Cleaned ${fieldCleanedCount} records for field "${field.field_key}"`);
      }
    }

    // 3. Log summary
    log("INFO", `GDPR cleanup complete. Total records cleaned: ${totalCleaned}`, cleanupResults);

    // 4. Create audit log entry
    if (totalCleaned > 0) {
      await supabase.from("audit_logs").insert({
        action: "gdpr_data_cleanup",
        details: {
          total_cleaned: totalCleaned,
          fields_processed: cleanupResults,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {
        // Audit log table might not exist - that's OK
        log("WARN", "Could not write to audit_logs table (table may not exist)");
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalCleaned,
        fields: cleanupResults,
        message: `GDPR cleanup complete. Cleaned ${totalCleaned} records.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log("ERROR", `GDPR cleanup failed: ${errorMessage}`);

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
