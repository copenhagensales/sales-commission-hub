import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorizeGdprRequest, corsHeaders } from "../_shared/gdpr-auth.ts";
import {
  employeeAnonymizationPatch,
  EMPLOYEE_ANONYMIZED_FIRST_NAME,
  EMPLOYEE_ANONYMIZED_LAST_NAME,
} from "../_shared/employee-anonymization.ts";
import {
  ADVERSUS_EVENTS_RETENTION_DAYS,
  CANCELLATION_IDENTITY_KEYS,
  cutoffIso,
  FALLBACK_RETENTION_DAYS,

  stripKeys,
} from "../_shared/gdpr-sales-privacy.ts";


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


interface CleanupLogEntry {
  action: string;
  records_affected: number;
  details?: Record<string, unknown>;
}

/**
 * Dry-run wrapper: selects are delegated to the real client, while every write
 * becomes a no-op. Row-count deletes are translated into an equivalent
 * head-count select so the dry run can report exactly what it would remove.
 */
function makeDryRunClient(sb: ReturnType<typeof createClient>) {
  const noopChain = (): any => {
    const chain: any = new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null, count: 0 }).then(resolve);
        }
        return () => chain;
      },
      apply() {
        return chain;
      },
    });
    return chain;
  };

  return {
    from(table: string) {
      return {
        select: (...args: unknown[]) => (sb.from(table) as any).select(...args),
        // Count what would be deleted instead of deleting it.
        delete: () => (sb.from(table) as any).select("id", { count: "exact", head: true }),
        update: () => noopChain(),
        insert: () => Promise.resolve({ data: null, error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
      };
    },
  } as unknown as ReturnType<typeof createClient>;
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

  // Dry run: compute and report everything, write nothing.
  let dryRun = false;
  try {
    if (req.method === "POST") {
      const body = await req.json().catch(() => null);
      dryRun = body?.dry_run === true;
    }
  } catch (_e) {
    dryRun = false;
  }

  // Every mutation in this function goes through `db`.
  const db = dryRun ? makeDryRunClient(supabase) : supabase;
  const cleanupLog: CleanupLogEntry[] = [];
  const addLog = (action: string, records_affected: number, details?: Record<string, unknown>) => {
    if (records_affected > 0) cleanupLog.push({ action, records_affected, details });
  };

  try {
    log("INFO", `Starting GDPR data cleanup job${dryRun ? " (DRY RUN — no writes)" : ""}`);


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

            const { error: updateError } = await db
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
    let campaignSalesSkippedUnmapped = 0;
    let externalRefsCleared = 0;
    let externalSalesIdsCleared = 0;
    let commissionsBackfilled = 0;
    let normalizedKeysStripped = 0;
    const campaignResults: {
      campaign_id: string;
      mode: string;
      count: number;
      skipped_unmapped?: number;
      external_reference_number_cleared?: number;
      external_sales_id_cleared?: number;
      commissions_backfilled?: number;
      normalized_stripped?: number;
    }[] = [];
    // client_id -> retention days, derived from the campaign policies. Used by
    // the system-copy sections below.
    const clientRetentionDays = new Map<string, number>();

    try {
      const { data: campaignPolicies, error: cpError } = await supabase
        .from("campaign_retention_policies")
        .select("id, client_campaign_id, retention_days, cleanup_mode, is_active")
        .eq("is_active", true);

      if (cpError) {
        log("WARN", `Error fetching campaign retention policies: ${cpError.message}`);
      } else if (campaignPolicies && campaignPolicies.length > 0) {
        log("INFO", `Found ${campaignPolicies.length} active campaign retention policies`);

        // Map campaigns to their client so the system-copy sections can reuse
        // the same retention window.
        const campaignIds = (campaignPolicies as CampaignRetentionPolicy[])
          .map((p) => p.client_campaign_id)
          .filter(Boolean);
        if (campaignIds.length > 0) {
          const { data: campaignRows } = await supabase
            .from("client_campaigns")
            .select("id, client_id")
            .in("id", campaignIds);
          const campaignToClient = new Map<string, string>(
            (campaignRows ?? []).map((c: { id: string; client_id: string }) => [c.id, c.client_id])
          );
          for (const policy of campaignPolicies as CampaignRetentionPolicy[]) {
            const clientId = campaignToClient.get(policy.client_campaign_id);
            if (!clientId || !policy.retention_days || policy.retention_days <= 0) continue;
            // Strictest (shortest) window wins per client.
            const current = clientRetentionDays.get(clientId);
            if (current === undefined || policy.retention_days < current) {
              clientRetentionDays.set(clientId, policy.retention_days);
            }
          }
        }

        for (const policy of campaignPolicies as CampaignRetentionPolicy[]) {
          if (!policy.retention_days || policy.retention_days <= 0) continue;

          const cutoffISO = cutoffIso(policy.retention_days);

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

              if (dryRun) {
                campaignSalesDeleted += saleIds.length;
                campaignResults.push({ campaign_id: policy.client_campaign_id, mode: "delete_all", count: saleIds.length });
                log("INFO", `[DRY RUN] Would delete ${saleIds.length} sales for campaign ${policy.client_campaign_id}`);
                continue;
              }

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
            // Owned by the daily pg_cron job `gdpr-campaign-sales-cleanup`, which
            // calls public.gdpr_run_campaign_sales_cleanup() directly in Postgres.
            // Doing it here as well would double-log and exceeded this function's
            // CPU budget on the real sales volume, so it is skipped.
            log(
              "INFO",
              `Campaign ${policy.client_campaign_id}: anonymize_customer handled by pg_cron job gdpr-campaign-sales-cleanup — skipping here`
            );
          }
        }


      } else {
        log("INFO", "No active campaign retention policies found");
      }
    } catch (cpErr) {
      log("WARN", `Campaign cleanup error: ${cpErr instanceof Error ? cpErr.message : String(cpErr)}`);
    }

    addLog("campaign_sales_anonymized", campaignSalesAnonymized, { campaigns: campaignResults });
    addLog("campaign_sales_deleted", campaignSalesDeleted, { campaigns: campaignResults });
    // One log line per field per table.
    addLog("anonymize_sales_external_reference_number", externalRefsCleared);
    addLog("anonymize_sales_external_sales_id", externalSalesIdsCleared);
    addLog("sale_items_commission_backfilled", commissionsBackfilled);
    addLog("sales_normalized_keys_stripped", normalizedKeysStripped);

    // ===== PART 2B: System copies of the same personal data =====
    // Retention window per client comes from the campaign policies; when no
    // policy covers the client we fall back to FALLBACK_RETENTION_DAYS.
    let fmSalesAnonymized = 0;
    let eesyRowsAnonymized = 0;
    let cancellationRowsAnonymized = 0;
    let cancellationOppGroupsCleared = 0;
    let adversusEventsDeleted = 0;
    const systemCopyResults: { table: string; count: number; retention_days: number }[] = [];

    const retentionForClient = (clientId: string | null | undefined): number =>
      (clientId && clientRetentionDays.get(clientId)) || FALLBACK_RETENTION_DAYS;

    // --- a) fieldmarketing_sales.phone_number ---
    // Set-based per client so the PostgREST 1000-row page limit cannot hide rows.
    try {
      const mappedClientIds = [...clientRetentionDays.keys()];
      const fmGroups: { label: string; days: number; clientId: string | null }[] = mappedClientIds.map(
        (clientId) => ({ label: clientId, days: clientRetentionDays.get(clientId)!, clientId })
      );
      fmGroups.push({ label: "fallback", days: FALLBACK_RETENTION_DAYS, clientId: null });

      for (const group of fmGroups) {
        const cutoff = cutoffIso(group.days);

        const applyFilters = (builder: any) => {
          let q = builder.not("phone_number", "is", null).lt("registered_at", cutoff);
          if (group.clientId) {
            q = q.eq("client_id", group.clientId);
          } else if (mappedClientIds.length > 0) {
            q = q.or(`client_id.is.null,client_id.not.in.(${mappedClientIds.join(",")})`);
          }
          return q;
        };

        const { count, error: cntErr } = await applyFilters(
          supabase.from("fieldmarketing_sales").select("id", { count: "exact", head: true })
        );

        if (cntErr) {
          log("WARN", `Error counting fieldmarketing_sales (${group.label}): ${cntErr.message}`);
          continue;
        }
        const affected = count ?? 0;
        if (affected === 0) continue;

        if (!dryRun) {
          const { error: updErr } = await applyFilters(
            supabase.from("fieldmarketing_sales").update({ phone_number: null })
          );
          if (updErr) {
            log("WARN", `Failed to clear fieldmarketing_sales phones (${group.label}): ${updErr.message}`);
            continue;
          }
        }

        fmSalesAnonymized += affected;
        systemCopyResults.push({
          table: "fieldmarketing_sales",
          count: affected,
          retention_days: group.days,
        });
      }
      log("INFO", `fieldmarketing_sales phone numbers cleared: ${fmSalesAnonymized}`);
    } catch (e) {
      log("WARN", `fieldmarketing_sales cleanup error: ${e instanceof Error ? e.message : String(e)}`);
    }


    // --- b) eesy_fm_powerbi_rows phone columns (set-based) ---
    try {
      const eesyCutoffDate = cutoffIso(FALLBACK_RETENTION_DAYS).slice(0, 10);
      const eesyFilters = (builder: any) =>
        builder.lt("sale_date", eesyCutoffDate).or("phone_raw.not.is.null,phone_normalized.not.is.null");

      const { count, error: cntErr } = await eesyFilters(
        supabase.from("eesy_fm_powerbi_rows").select("id", { count: "exact", head: true })
      );

      if (cntErr) {
        log("WARN", `Error counting eesy_fm_powerbi_rows: ${cntErr.message}`);
      } else {
        const affected = count ?? 0;
        if (affected > 0) {
          let ok = true;
          if (!dryRun) {
            const { error: updErr } = await eesyFilters(
              supabase.from("eesy_fm_powerbi_rows").update({ phone_raw: null, phone_normalized: null })
            );
            if (updErr) {
              ok = false;
              log("WARN", `Failed to clear eesy_fm_powerbi_rows phones: ${updErr.message}`);
            }
          }
          if (ok) {
            eesyRowsAnonymized = affected;
            systemCopyResults.push({
              table: "eesy_fm_powerbi_rows",
              count: affected,
              retention_days: FALLBACK_RETENTION_DAYS,
            });
          }
        }
        log("INFO", `eesy_fm_powerbi_rows phone numbers cleared: ${eesyRowsAnonymized}`);
      }
    } catch (e) {
      log("WARN", `eesy_fm_powerbi_rows cleanup error: ${e instanceof Error ? e.message : String(e)}`);
    }

    // --- c) cancellation_queue.uploaded_data identity keys ---
    // Per-row JSON surgery, so the rows are paged through explicitly.
    try {
      const pageSize = 500;
      let offset = 0;
      let done = false;

      while (!done) {
        const { data: cqRows, error: cqErr } = await supabase
          .from("cancellation_queue")
          .select("id, client_id, created_at, uploaded_data, opp_group")
          .or("uploaded_data.not.is.null,opp_group.not.is.null")
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);

        if (cqErr) {
          log("WARN", `Error selecting cancellation_queue: ${cqErr.message}`);
          break;
        }
        if (!cqRows || cqRows.length === 0) break;
        if (cqRows.length < pageSize) done = true;
        offset += cqRows.length;

        for (const row of cqRows) {
          const days = retentionForClient(row.client_id as string | null);
          const cutoff = cutoffIso(days);
          if (!row.created_at || String(row.created_at) >= cutoff) continue;

          const stripped = stripKeys(row.uploaded_data, CANCELLATION_IDENTITY_KEYS);
          // opp_group is a plain copy of the sale's OPP number and is the TDC
          // match key. It is cleared on the same deadline as the OPP number.
          const clearOppGroup = row.opp_group !== null && row.opp_group !== undefined;
          if (!stripped.changed && !clearOppGroup) continue;

          const cqPatch: Record<string, unknown> = {};
          if (stripped.changed) cqPatch.uploaded_data = stripped.result;
          if (clearOppGroup) cqPatch.opp_group = null;

          const { error: updErr } = await db
            .from("cancellation_queue")
            .update(cqPatch)
            .eq("id", row.id);

          if (updErr) {
            log("WARN", `Failed to anonymize cancellation_queue ${row.id}: ${updErr.message}`);
          } else {
            cancellationRowsAnonymized++;
            if (clearOppGroup) cancellationOppGroupsCleared++;
          }
        }
      }

      if (cancellationRowsAnonymized > 0) {
        systemCopyResults.push({
          table: "cancellation_queue",
          count: cancellationRowsAnonymized,
          retention_days: FALLBACK_RETENTION_DAYS,
        });
      }
      log("INFO", `cancellation_queue rows cleaned: ${cancellationRowsAnonymized}`);
    } catch (e) {
      log("WARN", `cancellation_queue cleanup error: ${e instanceof Error ? e.message : String(e)}`);
    }


    // --- d) adversus_events: processing artefacts, deleted after 90 days ---
    try {
      const eventCutoff = cutoffIso(ADVERSUS_EVENTS_RETENTION_DAYS);
      const { error: delErr, count } = await db
        .from("adversus_events")
        .delete({ count: "exact" })
        .lt("received_at", eventCutoff);

      if (delErr) {
        log("WARN", `Error deleting adversus_events: ${delErr.message}`);
      } else {
        adversusEventsDeleted = count ?? 0;
        if (adversusEventsDeleted > 0) {
          systemCopyResults.push({
            table: "adversus_events",
            count: adversusEventsDeleted,
            retention_days: ADVERSUS_EVENTS_RETENTION_DAYS,
          });
        }
        log("INFO", `adversus_events deleted: ${adversusEventsDeleted}`);
      }
    } catch (e) {
      log("WARN", `adversus_events cleanup error: ${e instanceof Error ? e.message : String(e)}`);
    }

    addLog("fieldmarketing_sales_phone_cleared", fmSalesAnonymized);
    addLog("eesy_fm_powerbi_rows_phone_cleared", eesyRowsAnonymized);
    addLog("cancellation_queue_uploaded_data_cleaned", cancellationRowsAnonymized);
    addLog("anonymize_cancellation_queue_opp_group", cancellationOppGroupsCleared);
    addLog("adversus_events_deleted", adversusEventsDeleted);



    // ===== PART 3: General data type cleanup =====
    // cleanup_mode:
    //   "delete_all"  -> rows are removed permanently
    //   "anonymize"   -> personal fields are wiped, statistical fields are kept
    let candidatesProcessed = 0;
    let customerInquiriesDeleted = 0;
    let customerInquiriesAnonymized = 0;
    let communicationLogsAnonymized = 0;
    let loginEventsAnonymized = 0;
    let inactiveEmployeesDeleted = 0;
    let inactiveEmployeesAnonymized = 0;

    const ANON_EMAIL = "anonymiseret@slettet.local";

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
          const anonymize = policy.cleanup_mode === "anonymize";

          log("INFO", `Data type "${policy.data_type}": mode=${policy.cleanup_mode}, cutoff=${cutoffISO}`);

          switch (policy.data_type) {
            case "customer_inquiries": {
              if (anonymize) {
                // Keep created_at / is_read / company for statistics, wipe person data.
                const { data: rows, error: selErr } = await supabase
                  .from("customer_inquiries")
                  .select("id")
                  .lt("created_at", cutoffISO)
                  .neq("name", "Anonymiseret");

                if (selErr) {
                  log("WARN", `Error selecting customer_inquiries for anonymization: ${selErr.message}`);
                  break;
                }

                for (const row of rows ?? []) {
                  const { error: updErr } = await db
                    .from("customer_inquiries")
                    .update({
                      name: "Anonymiseret",
                      email: null,
                      phone: null,
                      message: null,
                      fbclid: null,
                    })
                    .eq("id", row.id);

                  if (updErr) {
                    log("WARN", `Failed to anonymize customer inquiry ${row.id}: ${updErr.message}`);
                  } else {
                    customerInquiriesAnonymized++;
                  }
                }
                log("INFO", `Anonymized ${customerInquiriesAnonymized} expired customer inquiries`);
                break;
              }

              const { error: delErr, count } = await db
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
              const candidateQuery = supabase
                .from("candidates")
                .select("id, status, updated_at")
                .in("status", ["rejected", "withdrawn", "no_show"])
                .lt("updated_at", cutoffISO);

              // Anonymised rows have no email/phone/notes left — skip them so the job
              // is safe to run repeatedly.
              const { data: expiredCandidates, error: candErr } = anonymize
                ? await candidateQuery.neq("first_name", "Anonymiseret")
                : await candidateQuery.not("email", "is", null);

              if (candErr) {
                log("WARN", `Error querying expired candidates: ${candErr.message}`);
                break;
              }

              if (expiredCandidates && expiredCandidates.length > 0) {
                log("INFO", `Found ${expiredCandidates.length} candidates for cleanup (mode: ${policy.cleanup_mode})`);

                for (const candidate of expiredCandidates) {
                  if (policy.cleanup_mode === "delete_all") {
                    // Delete applications first (foreign key)
                    await db.from("applications").delete().eq("candidate_id", candidate.id);
                    // Delete call_records referencing this candidate
                    await db.from("call_records").delete().eq("candidate_id", candidate.id);

                    const { error: delErr } = await db
                      .from("candidates")
                      .delete()
                      .eq("id", candidate.id);

                    if (delErr) {
                      log("WARN", `Failed to delete candidate ${candidate.id}: ${delErr.message}`);
                    } else {
                      candidatesProcessed++;
                    }
                  } else {
                    // Default: anonymize. created_at, status, source, heard_about_us,
                    // applied_position and team_id are kept for recruitment statistics.
                    const { error: updateError } = await db
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
                  if (anonymize) {
                    // Already anonymised? skip (idempotent)
                    if (
                      emp.first_name === EMPLOYEE_ANONYMIZED_FIRST_NAME &&
                      emp.last_name === EMPLOYEE_ANONYMIZED_LAST_NAME
                    ) {
                      continue;
                    }

                    const { error: updErr } = await db
                      .from("employee_master_data")
                      .update(employeeAnonymizationPatch)
                      .eq("id", emp.id);

                    if (updErr) {
                      log("WARN", `Failed to anonymize inactive employee ${emp.id}: ${updErr.message}`);
                    } else {
                      inactiveEmployeesAnonymized++;
                    }
                    continue;
                  }

                  const { error: delErr } = await db
                    .from("employee_master_data")
                    .delete()
                    .eq("id", emp.id);

                  if (delErr) {
                    log("WARN", `Failed to delete inactive employee ${emp.id}: ${delErr.message}`);
                  } else {
                    inactiveEmployeesDeleted++;
                  }
                }
                log("INFO", `Inactive employees — deleted: ${inactiveEmployeesDeleted}, anonymized: ${inactiveEmployeesAnonymized}`);
              } else {
                log("INFO", "No inactive employees past retention found");
              }
              break;
            }

            case "integration_logs": {
              const { error: delErr, count } = await db
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
              if (anonymize) {
                // Keep logged_in_at + user_id so login statistics survive; wipe email,
                // name, IP, user agent and session id.
                const { data: rows, error: selErr } = await supabase
                  .from("login_events")
                  .select("id")
                  .lt("logged_in_at", cutoffISO)
                  .neq("user_email", ANON_EMAIL);

                if (selErr) {
                  log("WARN", `Error selecting login_events for anonymization: ${selErr.message}`);
                  break;
                }

                for (const row of rows ?? []) {
                  const { error: updErr } = await db
                    .from("login_events")
                    .update({
                      user_email: ANON_EMAIL,
                      user_name: null,
                      ip_address: null,
                      user_agent: null,
                      session_id: null,
                    })
                    .eq("id", row.id);

                  if (updErr) {
                    log("WARN", `Failed to anonymize login event ${row.id}: ${updErr.message}`);
                  } else {
                    loginEventsAnonymized++;
                  }
                }
                log("INFO", `Anonymized ${loginEventsAnonymized} expired login events`);
                break;
              }

              const { error: delErr, count } = await db
                .from("login_events")
                .delete({ count: "exact" })
                .lt("logged_in_at", cutoffISO);

              if (delErr) {
                log("WARN", `Error deleting login_events: ${delErr.message}`);
              } else {
                const deleted = count ?? 0;
                log("INFO", `Deleted ${deleted} expired login events`);
              }
              break;
            }

            case "password_reset_tokens": {
              const { error: delErr, count } = await db
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
              if (anonymize) {
                // Keep created_at, type, direction, outcome, delivery_status for statistics.
                const { data: rows, error: selErr } = await supabase
                  .from("communication_logs")
                  .select("id")
                  .lt("created_at", cutoffISO)
                  .or("content.not.is.null,phone_number.not.is.null");

                if (selErr) {
                  log("WARN", `Error selecting communication_logs for anonymization: ${selErr.message}`);
                  break;
                }

                for (const row of rows ?? []) {
                  const { error: updErr } = await db
                    .from("communication_logs")
                    .update({ content: null, phone_number: null })
                    .eq("id", row.id);

                  if (updErr) {
                    log("WARN", `Failed to anonymize communication log ${row.id}: ${updErr.message}`);
                  } else {
                    communicationLogsAnonymized++;
                  }
                }
                log("INFO", `Anonymized ${communicationLogsAnonymized} expired communication logs`);
                break;
              }

              const { error: delErr, count } = await db
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

            case "dialer_calls": {
              // Owned by the daily pg_cron job `gdpr-dialer-calls-cleanup`, which
              // calls public.gdpr_run_dialer_calls_cleanup() directly in Postgres.
              // Doing it here as well would double-log and can exceed this
              // function's CPU budget on large call volumes, so it is skipped.
              log("INFO", `dialer_calls handled by pg_cron job gdpr-dialer-calls-cleanup — skipping here`);
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


    // ===== PART 4: Summary, audit log and gdpr_cleanup_log =====
    addLog("sales_field_retention_cleaned", totalFieldsCleaned, { fields: fieldCleanupResults });
    addLog("candidates_processed", candidatesProcessed);
    addLog("customer_inquiries_deleted", customerInquiriesDeleted);
    addLog("customer_inquiries_anonymized", customerInquiriesAnonymized);
    addLog("communication_logs_anonymized", communicationLogsAnonymized);
    addLog("login_events_anonymized", loginEventsAnonymized);
    addLog("inactive_employees_deleted", inactiveEmployeesDeleted);
    addLog("inactive_employees_anonymized", inactiveEmployeesAnonymized);

    const totalActions =
      totalFieldsCleaned +
      campaignSalesAnonymized +
      campaignSalesDeleted +
      candidatesProcessed +
      customerInquiriesDeleted +
      customerInquiriesAnonymized +
      communicationLogsAnonymized +
      loginEventsAnonymized +
      inactiveEmployeesDeleted +
      inactiveEmployeesAnonymized +
      fmSalesAnonymized +
      eesyRowsAnonymized +
      cancellationRowsAnonymized +
      adversusEventsDeleted;

    log("INFO", `GDPR cleanup complete${dryRun ? " (DRY RUN)" : ""}. Fields: ${totalFieldsCleaned}, Campaign anon: ${campaignSalesAnonymized}, Campaign del: ${campaignSalesDeleted}, Skipped unmapped: ${campaignSalesSkippedUnmapped}, Candidates: ${candidatesProcessed}, Inquiries del/anon: ${customerInquiriesDeleted}/${customerInquiriesAnonymized}, Comm logs anon: ${communicationLogsAnonymized}, Login events anon: ${loginEventsAnonymized}, Employees del/anon: ${inactiveEmployeesDeleted}/${inactiveEmployeesAnonymized}, FM phones: ${fmSalesAnonymized}, Eesy rows: ${eesyRowsAnonymized}, Cancellation rows: ${cancellationRowsAnonymized}, Adversus events: ${adversusEventsDeleted}`);

    const summaryDetails = {
      dry_run: dryRun,
      fields_cleaned: totalFieldsCleaned,
      field_results: fieldCleanupResults,
      campaign_sales_anonymized: campaignSalesAnonymized,
      campaign_sales_deleted: campaignSalesDeleted,
      campaign_sales_skipped_unmapped: campaignSalesSkippedUnmapped,
      campaign_results: campaignResults,
      external_reference_number_cleared: externalRefsCleared,
      external_sales_id_cleared: externalSalesIdsCleared,
      cancellation_queue_opp_group_cleared: cancellationOppGroupsCleared,
      commissions_backfilled: commissionsBackfilled,
      normalized_keys_stripped: normalizedKeysStripped,
      system_copy_results: systemCopyResults,
      fieldmarketing_sales_phone_cleared: fmSalesAnonymized,
      eesy_fm_powerbi_rows_phone_cleared: eesyRowsAnonymized,
      cancellation_queue_uploaded_data_cleaned: cancellationRowsAnonymized,
      adversus_events_deleted: adversusEventsDeleted,
      candidates_processed: candidatesProcessed,
      customer_inquiries_deleted: customerInquiriesDeleted,
      customer_inquiries_anonymized: customerInquiriesAnonymized,
      communication_logs_anonymized: communicationLogsAnonymized,
      login_events_anonymized: loginEventsAnonymized,
      inactive_employees_deleted: inactiveEmployeesDeleted,
      inactive_employees_anonymized: inactiveEmployeesAnonymized,
      timestamp: new Date().toISOString(),
    };

    if (totalActions > 0 && !dryRun) {
      try {
        const { error: auditError } = await supabase.from("audit_logs").insert({
          action: "gdpr_data_cleanup",
          details: summaryDetails,
        });
        if (auditError) {
          log("WARN", "Could not write to audit_logs table", auditError.message);
        }
      } catch (_e) {
        log("WARN", "Could not write to audit_logs table (table may not exist)");
      }

      // One row per performed action. Dry runs are never logged here.
      if (cleanupLog.length > 0) {
        const runAt = new Date().toISOString();
        const { error: logError } = await supabase.from("gdpr_cleanup_log").insert(
          cleanupLog.map((entry) => ({
            run_at: runAt,
            action: entry.action,
            records_affected: entry.records_affected,
            details: entry.details ?? {},
            triggered_by: "gdpr-data-cleanup",
          }))
        );
        if (logError) {
          log("WARN", `Could not write to gdpr_cleanup_log: ${logError.message}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        fieldsCleaned: totalFieldsCleaned,
        campaignSalesAnonymized,
        campaignSalesDeleted,
        campaignSalesSkippedUnmapped,
        externalRefsCleared,
        externalSalesIdsCleared,
        cancellationOppGroupsCleared,
        commissionsBackfilled,
        normalizedKeysStripped,
        fmSalesAnonymized,
        eesyRowsAnonymized,
        cancellationRowsAnonymized,
        adversusEventsDeleted,
        candidatesProcessed,
        customerInquiriesDeleted,
        customerInquiriesAnonymized,
        communicationLogsAnonymized,
        loginEventsAnonymized,
        inactiveEmployeesDeleted,
        inactiveEmployeesAnonymized,
        fieldResults: fieldCleanupResults,
        campaignResults,
        systemCopyResults,
        plannedLogEntries: dryRun ? cleanupLog : undefined,
        message: dryRun
          ? `DRY RUN — ${totalActions} actions would be performed. Nothing was written.`
          : `GDPR cleanup complete. ${totalActions} total actions performed.`,
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
