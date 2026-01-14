import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { StandardCall } from "../types.ts"
import { chunk } from "../utils/batch.ts"

/**
 * List of email domains that should be excluded from syncing.
 * These are internal/partner accounts that shouldn't be visible to users.
 */
const EXCLUDED_EMAIL_DOMAINS = [
  "@relatel.dk",
  "@ps-marketing.dk",
  "@finansforbundet.dk",
  "@straightlineagency.dk",
  "@staightlineagency.dk",
  "@tele-part.dk",
  "@aogtil.dk",
  "@ase.dk",
];

function isExcludedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();
  return EXCLUDED_EMAIL_DOMAINS.some(domain => emailLower.endsWith(domain));
}


async function processCallsBatch(
  supabase: SupabaseClient,
  calls: StandardCall[],
  agentMapByExtId: Map<string, string>,
  agentMapByEmail: Map<string, string>,
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void,
  agentMapByDialerId: Map<string, string>
) {
  let processed = 0
  let errors = 0
  let matched = 0
  const allCallsData: any[] = []
  for (const call of calls) {
    try {
      let agentId = agentMapByExtId.get(call.agentExternalId) ||
        agentMapByDialerId.get(call.agentExternalId) ||
        null
      if (!agentId && call.metadata) {
        const agentEmail = (call.metadata as any).agentEmail?.toLowerCase()
        if (agentEmail) {
          agentId = agentMapByEmail.get(agentEmail) || null
        }
      }
      if (agentId) matched++
      const callData = {
        external_id: call.externalId,
        integration_type: call.integrationType,
        dialer_name: call.dialerName,
        start_time: call.startTime,
        end_time: call.endTime,
        duration_seconds: call.durationSeconds,
        total_duration_seconds: call.totalDurationSeconds,
        status: call.status,
        agent_external_id: call.agentExternalId,
        campaign_external_id: call.campaignExternalId,
        lead_external_id: call.leadExternalId,
        agent_id: agentId,
        recording_url: call.recordingUrl || null,
        metadata: call.metadata || null,
        updated_at: new Date().toISOString(),
      }
      allCallsData.push(callData)
      processed++
    } catch (e) {
      errors++
      const errMsg = e instanceof Error ? e.message : String(e)
      log("ERROR", `Error preparando llamada ${call.externalId}`, errMsg)
    }
  }
  try {
    if (allCallsData.length > 0) {
      const { error: upsertError } = await supabase
        .from("dialer_calls")
        .upsert(allCallsData, {
          onConflict: "external_id,integration_type,dialer_name",
          ignoreDuplicates: false,
        })
      if (upsertError) throw upsertError
    }
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    log("ERROR", `Error en upsert bulk de llamadas`, errMsg)
    errors += calls.length
    processed = 0
    matched = 0
  }
  return { processed, errors, matched }
}

export async function processCalls(
  supabase: SupabaseClient,
  calls: StandardCall[],
  batchSize: number,
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
) {
  if (calls.length === 0) return { processed: 0, errors: 0, matched: 0 }
  
  // Filter out calls from excluded email domains
  const filteredCalls = calls.filter(call => {
    const agentEmail = (call.metadata as any)?.agentEmail
    return !isExcludedEmail(agentEmail)
  })
  const skippedByDomain = calls.length - filteredCalls.length
  
  if (skippedByDomain > 0) {
    log("INFO", `Skipped ${skippedByDomain} calls from excluded email domains`)
  }
  
  if (filteredCalls.length === 0) return { processed: 0, errors: 0, matched: 0 }
  
  const sampleCall = filteredCalls[0]
  log(
    "INFO",
    `Procesando ${filteredCalls.length} llamadas de ${sampleCall.dialerName} (${sampleCall.integrationType}) en lotes de ${batchSize}...`
  )
  const { data: agents } = await supabase.from("agents").select("id, external_adversus_id, external_dialer_id, email")
  const agentMapByExtId = new Map<string, string>(
    agents?.filter((a: any) => a.external_adversus_id && a.id).map((a: any) => [a.external_adversus_id, a.id]) || []
  )
  const agentMapByDialerId = new Map<string, string>(
    agents?.filter((a: any) => a.external_dialer_id && a.id).map((a: any) => [a.external_dialer_id, a.id]) || []
  )
  const agentMapByEmail = new Map<string, string>(
    agents?.filter((a: any) => a.email && a.id).map((a: any) => [a.email.toLowerCase(), a.id]) || []
  )
  let totalProcessed = 0
  let totalErrors = 0
  let totalMatched = 0
  const batches = chunk(filteredCalls, batchSize)
  const totalBatches = batches.length
  for (let batchNum = 0; batchNum < totalBatches; batchNum++) {
    const batch = batches[batchNum]
    log("INFO", `Procesando lote de llamadas ${batchNum + 1}/${totalBatches} (${batch.length} llamadas)...`)
    const { processed, errors, matched } = await processCallsBatch(
      supabase,
      batch,
      agentMapByExtId,
      agentMapByEmail,
      log,
      agentMapByDialerId
    )
    totalProcessed += processed
    totalErrors += errors
    totalMatched += matched
    log("INFO", `Lote ${batchNum + 1} completado: ${processed} procesadas, ${matched} matched, ${errors} errores`)
  }
  return { processed: totalProcessed, errors: totalErrors, matched: totalMatched }
}
