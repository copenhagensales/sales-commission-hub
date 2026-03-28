import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FieldDefinition {
  id: string;
  field_key: string;
  retention_days: number;
  is_pii: boolean;
}

Deno.serve(async (req) => {
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

    // ===== PART 1: Field retention cleanup (existing logic) =====
    const { data: fields, error: fieldsError } = await supabase
      .from("data_field_definitions")
      .select("id, field_key, retention_days, is_pii")
      .gt("retention_days", 0);

    if (fieldsError) {
      throw new Error(`Failed to fetch field definitions: ${fieldsError.message}`);
    }

    let totalCleaned = 0;
    const cleanupResults: { field_key: string; cleaned: number }[] = [];

    if (fields && fields.length > 0) {
      log("INFO", `Found ${fields.length} fields with retention policies`);

      for (const field of fields as FieldDefinition[]) {
        const retentionDate = new Date();
        retentionDate.setDate(retentionDate.getDate() - field.retention_days);
        const cutoffDate = retentionDate.toISOString();

        log("INFO", `Processing field "${field.field_key}" (retention: ${field.retention_days} days, cutoff: ${cutoffDate})`);

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

        let fieldCleanedCount = 0;

        for (const sale of expiredSales) {
          const normalizedData = sale.normalized_data as Record<string, unknown> | null;

          if (normalizedData && field.field_key in normalizedData) {
            const updatedNormalized = { ...normalizedData };
            delete updatedNormalized[field.field_key];
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
    } else {
      log("INFO", "No fields with retention policies configured");
    }

    // ===== PART 2: Candidate data anonymization (6 months after rejection) =====
    let candidatesAnonymized = 0;
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const cutoff = sixMonthsAgo.toISOString();

      const { data: expiredCandidates, error: candError } = await supabase
        .from("candidates")
        .select("id, status, updated_at")
        .in("status", ["rejected", "withdrawn", "no_show"])
        .lt("updated_at", cutoff)
        .not("email", "is", null);

      if (candError) {
        log("WARN", `Error querying expired candidates: ${candError.message}`);
      } else if (expiredCandidates && expiredCandidates.length > 0) {
        log("INFO", `Found ${expiredCandidates.length} candidates for anonymization`);

        for (const candidate of expiredCandidates) {
          const { error: updateError } = await supabase
            .from("candidates")
            .update({
              first_name: "Anonymiseret",
              last_name: "Kandidat",
              email: null,
              phone: null,
              notes: "GDPR: Automatisk anonymiseret efter 6 måneder",
              resume_url: null,
            })
            .eq("id", candidate.id);

          if (updateError) {
            log("WARN", `Failed to anonymize candidate ${candidate.id}: ${updateError.message}`);
          } else {
            candidatesAnonymized++;
          }
        }

        log("INFO", `Anonymized ${candidatesAnonymized} expired candidates`);
      } else {
        log("INFO", "No expired candidates found for anonymization");
      }
    } catch (candErr) {
      log("WARN", `Candidate cleanup error: ${candErr instanceof Error ? candErr.message : String(candErr)}`);
    }

    // ===== PART 3: Summary and audit log =====
    log("INFO", `GDPR cleanup complete. Sales cleaned: ${totalCleaned}, Candidates anonymized: ${candidatesAnonymized}`, cleanupResults);

    if (totalCleaned > 0 || candidatesAnonymized > 0) {
      await supabase.from("audit_logs").insert({
        action: "gdpr_data_cleanup",
        details: {
          total_cleaned: totalCleaned,
          candidates_anonymized: candidatesAnonymized,
          fields_processed: cleanupResults,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {
        log("WARN", "Could not write to audit_logs table (table may not exist)");
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalCleaned,
        candidatesAnonymized,
        fields: cleanupResults,
        message: `GDPR cleanup complete. Cleaned ${totalCleaned} records, anonymized ${candidatesAnonymized} candidates.`,
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
