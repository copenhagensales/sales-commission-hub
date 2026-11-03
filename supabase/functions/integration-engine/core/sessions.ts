/**
 * Sessions Processor – tynd indgang til den fælles sink i _shared/sessions-sink.ts (B1).
 * Porten (sletteregel pr. kampagne), »kun egne medarbejdere«, kataloget og sælger-alias ligger i sinken, så polling (her) og push (enreach-hook) skriver ens.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { StandardSession } from "../types.ts";
import { processSessionsSink } from "../../_shared/sessions-sink.ts";

export async function processSessions(
  supabase: SupabaseClient,
  sessions: StandardSession[],
  integrationId: string,
  batchSize: number,
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
) {
  return await processSessionsSink(supabase, sessions, integrationId, batchSize, log);
}
