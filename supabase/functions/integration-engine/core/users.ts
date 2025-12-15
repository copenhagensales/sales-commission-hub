import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { StandardUser } from "../types.ts"

export async function processUsers(
  supabase: SupabaseClient,
  users: StandardUser[],
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
) {
  if (users.length === 0) return { processed: 0, errors: 0 }
  log("INFO", `Procesando ${users.length} usuarios...`)

  let processed = 0
  let errors = 0

  for (const user of users) {
    try {
      const { data: existing } = await supabase
        .from("agents")
        .select("id")
        .eq("external_adversus_id", user.externalId)
        .maybeSingle()

      const agentData = {
        external_adversus_id: user.externalId,
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
      log("ERROR", `Error guardando usuario ${user.name}`, errMsg)
    }
  }
  return { processed, errors }
}

