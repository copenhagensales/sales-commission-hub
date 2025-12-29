import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { StandardUser } from "../types.ts"

export async function processUsers(
  supabase: SupabaseClient,
  users: StandardUser[],
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void,
  source: "adversus" | "enreach" = "adversus"
) {
  if (users.length === 0) return { processed: 0, errors: 0 }
  log("INFO", `Processing ${users.length} users from ${source}...`)

  let processed = 0
  let errors = 0

  for (const user of users) {
    try {
      // Check if agent exists by source + external_dialer_id (new method)
      // or by external_adversus_id (legacy for backwards compatibility)
      const { data: existing } = await supabase
        .from("agents")
        .select("id")
        .or(`and(source.eq.${source},external_dialer_id.eq.${user.externalId}),external_adversus_id.eq.${user.externalId}`)
        .maybeSingle()

      const agentData = {
        external_adversus_id: source === "adversus" ? user.externalId : null,
        external_dialer_id: user.externalId,
        source: source,
        name: user.name,
        email: user.email,
        is_active: user.isActive,
      }

      if (existing) {
        await supabase.from("agents").update(agentData).eq("id", existing.id)
      } else {
        await supabase.from("agents").insert(agentData)
      }
      processed++
    } catch (e) {
      errors++
      const errMsg = e instanceof Error ? e.message : String(e)
      log("ERROR", `Error saving user ${user.name}`, errMsg)
    }
  }
  return { processed, errors }
}

