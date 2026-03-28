import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeGdprRequest, corsHeaders } from "../_shared/gdpr-auth.ts";

interface FieldDefinition {
  id: string;
  field_key: string;
  retention_days: number;
  is_pii: boolean;
}

interface CampaignRetentionPolicy {
  id: string;
  client_campaign_id: string;
  retention_days: number | null;
  cleanup_mode: string;
  is_active: boolean;
}

interface DataRetentionPolicy {
  id: string;
  data_type: string;
  display_name: string;
  retention_days: number;
  cleanup_mode: string;
  is_active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

    // Auth guard: only owner or cron token allowed
    const authResult = await authorizeGdprRequest(req);
    if (authResult instanceof Response) return authResult;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

  const log = (type: "INFO" | "WARN" | "ERROR", msg: string, data?: unknown) => {
    console.log(JSON.stringify({ type, msg, data, timestamp: new Date().toISOString() }));
  };

  try {
    log("INFO", "Starting GDPR data cleanup job");

    // ===== PART 1: Field retention cleanup (legacy logic — kept as-is) =====
    const { data: fields, error: fieldsError } = await supabase
      .from("data_field_definitions")
      .select("id, field_key, retention_days, is_pii")
      .gt("retention_days", 0);

    if (fieldsError) {
      throw new Error(`Failed to fetch field definitions: ${fieldsError.message}`);
    }

    let totalFieldsCleaned = 0;
    const fieldCleanupResults: { field_key: string; cleaned: number }[] = [];

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
          fieldCleanupResults.push({ field_key: field.field_key, cleaned: fieldCleanedCount });
          totalFieldsCleaned += fieldCleanedCount;
          log("INFO", `Cleaned ${fieldCleanedCount} records for field "${field.field_key}"`);
        }
      }
    } else {
      log("INFO", "No fields with retention policies configured");
    }

    // ===== PART 2: Campaign-based sales cleanup =====
    let campaignSalesAnonymized = 0;
    let campaignSalesDeleted = 0;
    const campaignResults: { campaign_id: string; mode: string; count: number }[] = [];

    try {
      const { data: campaignPolicies, error: cpError } = await supabase
        .from("campaign_retention_policies")
        .select("id, client_campaign_id, retention_days, cleanup_mode, is_active")
        .eq("is_active", true);

      if (cpError) {
        log("WARN", `Error fetching campaign retention policies: ${cpError.message}`);
      } else if (campaignPolicies && campaignPolicies.length > 0) {
        log("INFO", `Found ${campaignPolicies.length} active campaign retention policies`);

        for (const policy of campaignPolicies as CampaignRetentionPolicy[]) {
          if (!policy.retention_days || policy.retention_days <= 0) continue;

          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retention_days);
          const cutoffISO = cutoff.toISOString();

          log("INFO", `Campaign ${policy.client_campaign_id}: mode=${policy.cleanup_mode}, cutoff=${cutoffISO}`);

          if (policy.cleanup_mode === "delete_all") {
            // First delete sale_items, then sales
            const { data: salesToDelete, error: selErr } = await supabase
              .from("sales")
              .select("id")
              .eq("client_campaign_id", policy.client_campaign_id)
              .lt("sale_datetime", cutoffISO);

            if (selErr) {
              log("WARN", `Error selecting sales for deletion (campaign ${policy.client_campaign_id}): ${selErr.message}`);
              continue;
            }

            if (salesToDelete && salesToDelete.length > 0) {
              const saleIds = salesToDelete.map((s: { id: string }) => s.id);

              // Delete sale_items first (foreign key)
              const { error: siDelErr } = await supabase
                .from("sale_items")
                .delete()
                .in("sale_id", saleIds);

              if (siDelErr) {
                log("WARN", `Error deleting sale_items for campaign ${policy.client_campaign_id}: ${siDelErr.message}`);
                continue;
              }

              // Delete cancellation_queue entries referencing these sales
              await supabase
                .from("cancellation_queue")
                .delete()
                .in("sale_id", saleIds);

              // Delete sales
              const { error: sDelErr } = await supabase
                .from("sales")
                .delete()
                .in("id", saleIds);

              if (sDelErr) {
                log("WARN", `Error deleting sales for campaign ${policy.client_campaign_id}: ${sDelErr.message}`);
              } else {
                campaignSalesDeleted += saleIds.length;
                campaignResults.push({ campaign_id: policy.client_campaign_id, mode: "delete_all", count: saleIds.length });
                log("INFO", `Deleted ${saleIds.length} sales for campaign ${policy.client_campaign_id}`);
              }
            }
          } else if (policy.cleanup_mode === "anonymize_customer") {
            const { data: salesToAnon, error: selErr } = await supabase
              .from("sales")
              .select("id")
              .eq("client_campaign_id", policy.client_campaign_id)
              .lt("sale_datetime", cutoffISO)
              .or("customer_phone.neq.null,raw_payload.neq.null");

            if (selErr) {
              log("WARN", `Error selecting sales for anonymization (campaign ${policy.client_campaign_id}): ${selErr.message}`);
              continue;
            }

            if (salesToAnon && salesToAnon.length > 0) {
              let anonCount = 0;
              for (const sale of salesToAnon) {
                const { error: updErr } = await supabase
                  .from("sales")
                  .update({
                    customer_phone: null,
                    customer_company: "Anonymiseret",
                    raw_payload: null,
                  })
                  .eq("id", sale.id);

                if (updErr) {
                  log("WARN", `Failed to anonymize sale ${sale.id}: ${updErr.message}`);
                } else {
                  anonCount++;
                }
              }
              campaignSalesAnonymized += anonCount;
              campaignResults.push({ campaign_id: policy.client_campaign_id, mode: "anonymize_customer", count: anonCount });
              log("INFO", `Anonymized ${anonCount} sales for campaign ${policy.client_campaign_id}`);
            }
          }
        }
      } else {
        log("INFO", "No active campaign retention policies found");
      }
    } catch (cpErr) {
      log("WARN", `Campaign cleanup error: ${cpErr instanceof Error ? cpErr.message : String(cpErr)}`);
    }

    // ===== PART 3: General data type cleanup =====
    let candidatesProcessed = 0;
    let customerInquiriesDeleted = 0;
    let inactiveEmployeesDeleted = 0;

    try {
      const { data: dataPolicies, error: dpError } = await supabase
        .from("data_retention_policies")
        .select("id, data_type, display_name, retention_days, cleanup_mode, is_active")
        .eq("is_active", true);

      if (dpError) {
        log("WARN", `Error fetching data retention policies: ${dpError.message}`);
      } else if (dataPolicies && dataPolicies.length > 0) {
        log("INFO", `Found ${dataPolicies.length} active data retention policies`);

        for (const policy of dataPolicies as DataRetentionPolicy[]) {
          if (!policy.retention_days || policy.retention_days <= 0) continue;

          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retention_days);
          const cutoffISO = cutoff.toISOString();

          log("INFO", `Data type "${policy.data_type}": mode=${policy.cleanup_mode}, cutoff=${cutoffISO}`);

          switch (policy.data_type) {
            case "customer_inquiries": {
              const { error: delErr, count } = await supabase
                .from("customer_inquiries")
                .delete({ count: "exact" })
                .lt("created_at", cutoffISO);

              if (delErr) {
                log("WARN", `Error deleting customer_inquiries: ${delErr.message}`);
              } else {
                customerInquiriesDeleted = count ?? 0;
                log("INFO", `Deleted ${customerInquiriesDeleted} expired customer inquiries`);
              }
              break;
            }

            case "candidates": {
              const { data: expiredCandidates, error: candErr } = await supabase
                .from("candidates")
                .select("id, status, updated_at")
                .in("status", ["rejected", "withdrawn", "no_show"])
                .lt("updated_at", cutoffISO)
                .not("email", "is", null);

              if (candErr) {
                log("WARN", `Error querying expired candidates: ${candErr.message}`);
                break;
              }

              if (expiredCandidates && expiredCandidates.length > 0) {
                log("INFO", `Found ${expiredCandidates.length} candidates for cleanup (mode: ${policy.cleanup_mode})`);

                for (const candidate of expiredCandidates) {
                  if (policy.cleanup_mode === "delete_all") {
                    // Delete applications first (foreign key)
                    await supabase.from("applications").delete().eq("candidate_id", candidate.id);
                    // Delete call_records referencing this candidate
                    await supabase.from("call_records").delete().eq("candidate_id", candidate.id);

                    const { error: delErr } = await supabase
                      .from("candidates")
                      .delete()
                      .eq("id", candidate.id);

                    if (delErr) {
                      log("WARN", `Failed to delete candidate ${candidate.id}: ${delErr.message}`);
                    } else {
                      candidatesProcessed++;
                    }
                  } else {
                    // Default: anonymize
                    const { error: updateError } = await supabase
                      .from("candidates")
                      .update({
                        first_name: "Anonymiseret",
                        last_name: "Kandidat",
                        email: null,
                        phone: null,
                        notes: "GDPR: Automatisk anonymiseret",
                        resume_url: null,
                      })
                      .eq("id", candidate.id);

                    if (updateError) {
                      log("WARN", `Failed to anonymize candidate ${candidate.id}: ${updateError.message}`);
                    } else {
                      candidatesProcessed++;
                    }
                  }
                }
                log("INFO", `Processed ${candidatesProcessed} expired candidates (${policy.cleanup_mode})`);
              } else {
                log("INFO", "No expired candidates found for cleanup");
              }
              break;
            }

            case "inactive_employees": {
              const { data: expiredEmployees, error: empErr } = await supabase
                .from("employee_master_data")
                .select("id, first_name, last_name, employment_end_date")
                .eq("is_active", false)
                .not("employment_end_date", "is", null)
                .lt("employment_end_date", cutoffISO);

              if (empErr) {
                log("WARN", `Error querying inactive employees: ${empErr.message}`);
                break;
              }

              if (expiredEmployees && expiredEmployees.length > 0) {
                log("INFO", `Found ${expiredEmployees.length} inactive employees past retention`);

                for (const emp of expiredEmployees) {
                  const { error: delErr } = await supabase
                    .from("employee_master_data")
                    .delete()
                    .eq("id", emp.id);

                  if (delErr) {
                    log("WARN", `Failed to delete inactive employee ${emp.id}: ${delErr.message}`);
                  } else {
                    inactiveEmployeesDeleted++;
                  }
                }
                log("INFO", `Deleted ${inactiveEmployeesDeleted} inactive employees`);
              } else {
                log("INFO", "No inactive employees past retention found");
              }
              break;
            }

            case "integration_logs": {
              const { error: delErr, count } = await supabase
                .from("integration_logs")
                .delete({ count: "exact" })
                .lt("created_at", cutoffISO);

              if (delErr) {
                log("WARN", `Error deleting integration_logs: ${delErr.message}`);
              } else {
                const deleted = count ?? 0;
                log("INFO", `Deleted ${deleted} expired integration logs`);
              }
              break;
            }

            case "login_events": {
              const { error: delErr, count } = await supabase
                .from("login_events")
                .delete({ count: "exact" })
                .lt("created_at", cutoffISO);

              if (delErr) {
                log("WARN", `Error deleting login_events: ${delErr.message}`);
              } else {
                const deleted = count ?? 0;
                log("INFO", `Deleted ${deleted} expired login events`);
              }
              break;
            }

            case "password_reset_tokens": {
              const { error: delErr, count } = await supabase
                .from("password_reset_tokens")
                .delete({ count: "exact" })
                .lt("created_at", cutoffISO);

              if (delErr) {
                log("WARN", `Error deleting password_reset_tokens: ${delErr.message}`);
              } else {
                const deleted = count ?? 0;
                log("INFO", `Deleted ${deleted} expired password reset tokens`);
              }
              break;
            }

            case "communication_logs": {
              const { error: delErr, count } = await supabase
                .from("communication_logs")
                .delete({ count: "exact" })
                .lt("created_at", cutoffISO);

              if (delErr) {
                log("WARN", `Error deleting communication_logs: ${delErr.message}`);
              } else {
                const deleted = count ?? 0;
                log("INFO", `Deleted ${deleted} expired communication logs`);
              }
              break;
            }

            default:
              log("INFO", `Unknown data_type "${policy.data_type}" — skipping`);
          }
        }
      } else {
        log("INFO", "No active data retention policies found");
      }
    } catch (dpErr) {
      log("WARN", `Data retention cleanup error: ${dpErr instanceof Error ? dpErr.message : String(dpErr)}`);
    }

    // ===== PART 4: Summary and audit log =====
    const totalActions = totalFieldsCleaned + campaignSalesAnonymized + campaignSalesDeleted + candidatesProcessed + customerInquiriesDeleted + inactiveEmployeesDeleted;

    log("INFO", `GDPR cleanup complete. Fields: ${totalFieldsCleaned}, Campaign anon: ${campaignSalesAnonymized}, Campaign del: ${campaignSalesDeleted}, Candidates: ${candidatesProcessed}, Inquiries: ${customerInquiriesDeleted}, Employees: ${inactiveEmployeesDeleted}`);

    if (totalActions > 0) {
      await supabase.from("audit_logs").insert({
        action: "gdpr_data_cleanup",
        details: {
          fields_cleaned: totalFieldsCleaned,
          field_results: fieldCleanupResults,
          campaign_sales_anonymized: campaignSalesAnonymized,
          campaign_sales_deleted: campaignSalesDeleted,
          campaign_results: campaignResults,
          candidates_processed: candidatesProcessed,
          customer_inquiries_deleted: customerInquiriesDeleted,
          inactive_employees_deleted: inactiveEmployeesDeleted,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {
        log("WARN", "Could not write to audit_logs table (table may not exist)");
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        fieldsCleaned: totalFieldsCleaned,
        campaignSalesAnonymized,
        campaignSalesDeleted,
        candidatesProcessed,
        customerInquiriesDeleted,
        inactiveEmployeesDeleted,
        fieldResults: fieldCleanupResults,
        campaignResults,
        message: `GDPR cleanup complete. ${totalActions} total actions performed.`,
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
