/**
 * Sessions Processor
 * 
 * Processes StandardSession[] and upserts to dialer_sessions table.
 * Agent matching follows the same pattern as core/calls.ts.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { StandardSession } from "../types.ts";
import { chunk, fetchAllPaginated } from "../utils/batch.ts";

export async function processSessions(
  supabase: SupabaseClient,
  sessions: StandardSession[],
  integrationId: string,
  batchSize: number,
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
) {
  if (sessions.length === 0) {
    return { processed: 0, errors: 0, matched: 0, duplicates: 0 };
  }

  log("INFO", `Processing ${sessions.length} sessions for integration ${integrationId} in batches of ${batchSize}...`);

  // Build agent lookup maps (same pattern as core/calls.ts)
  const agents = await fetchAllPaginated(
    supabase,
    "agents",
    "id, external_adversus_id, external_dialer_id, email",
    (q) => q
  );

  const agentMapByExtId = new Map<string, string>(
    agents.filter((a: any) => a.external_adversus_id && a.id).map((a: any) => [a.external_adversus_id, a.id])
  );
  const agentMapByDialerId = new Map<string, string>(
    agents.filter((a: any) => a.external_dialer_id && a.id).map((a: any) => [a.external_dialer_id, a.id])
  );
  const agentMapByEmail = new Map<string, string>(
    agents.filter((a: any) => a.email && a.id).map((a: any) => [a.email.toLowerCase(), a.id])
  );

  let totalProcessed = 0;
  let totalErrors = 0;
  let totalMatched = 0;
  let totalDuplicates = 0;

  const batches = chunk(sessions, batchSize);

  for (let batchNum = 0; batchNum < batches.length; batchNum++) {
    const batch = batches[batchNum];
    log("INFO", `Processing session batch ${batchNum + 1}/${batches.length} (${batch.length} sessions)...`);

    const rows: any[] = [];
    let batchMatched = 0;

    for (const session of batch) {
      try {
        // Agent matching: try external ID, then dialer ID, then email
        const agentId =
          (session.agentExternalId ? agentMapByExtId.get(session.agentExternalId) : undefined) ||
          (session.agentExternalId ? agentMapByDialerId.get(session.agentExternalId) : undefined) ||
          null;

        if (agentId) batchMatched++;

        rows.push({
          integration_id: integrationId,
          external_id: session.externalId,
          lead_external_id: session.leadExternalId || null,
          agent_external_id: session.agentExternalId || null,
          campaign_external_id: session.campaignExternalId || null,
          status: session.status,
          start_time: session.startTime || null,
          end_time: session.endTime || null,
          session_seconds: session.sessionSeconds || null,
          has_cdr: session.hasCdr || false,
          cdr_duration_seconds: session.cdrDurationSeconds || null,
          cdr_disposition: session.cdrDisposition || null,
          source: session.integrationType || "adversus",
          metadata: {
            ...(session.metadata || {}),
            agent_id: agentId,
            dialer_name: session.dialerName,
          },
          updated_at: new Date().toISOString(),
        });
      } catch (e) {
        totalErrors++;
        const errMsg = e instanceof Error ? e.message : String(e);
        log("ERROR", `Error preparing session ${session.externalId}: ${errMsg}`);
      }
    }

    if (rows.length > 0) {
      try {
        const { error: upsertError, count } = await supabase
          .from("dialer_sessions")
          .upsert(rows, {
            onConflict: "integration_id,external_id",
            ignoreDuplicates: false,
          });

        if (upsertError) throw upsertError;

        totalProcessed += rows.length;
        totalMatched += batchMatched;
        log("INFO", `Session batch ${batchNum + 1} complete: ${rows.length} upserted, ${batchMatched} agent-matched`);
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        log("ERROR", `Error upserting session batch ${batchNum + 1}: ${errMsg}`);
        totalErrors += rows.length;
      }
    }
  }

  // Log status distribution
  const statusCounts = new Map<string, number>();
  for (const s of sessions) {
    statusCounts.set(s.status, (statusCounts.get(s.status) || 0) + 1);
  }
  log("INFO", `Session status distribution: ${JSON.stringify(Object.fromEntries(statusCounts))}`);

  return {
    processed: totalProcessed,
    errors: totalErrors,
    matched: totalMatched,
    duplicates: totalDuplicates,
  };
}
