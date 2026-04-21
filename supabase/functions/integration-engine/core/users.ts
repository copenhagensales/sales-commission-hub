import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { StandardUser } from "../types.ts"

/**
 * Default whitelist of email domains that SHOULD be synced when no
 * per-integration override is provided (preserves existing behaviour).
 */
const DEFAULT_VALID_EMAIL_DOMAINS = [
  "@copenhagensales.dk",
  "@cph-relatel.dk",
  "@cph-sales.dk",
];

const WHITELISTED_EMAILS = [
  "kongtelling@gmail.com",
  "rasmusventura700@gmail.com",
];

/**
 * Patterns for emails that should be excluded (pseudo-emails from integrations)
 */
const EXCLUDED_EMAIL_PATTERNS = [
  /^agent-\d+@adversus\.local$/i,
];

function isValidSyncEmail(email: string | null | undefined, allowedDomains?: string[]): boolean {
  if (!email) return false;
  const emailLower = email.toLowerCase();

  if (WHITELISTED_EMAILS.includes(emailLower)) return true;

  if (EXCLUDED_EMAIL_PATTERNS.some(pattern => pattern.test(emailLower))) {
    return false;
  }

  const domains = allowedDomains && allowedDomains.length > 0
    ? allowedDomains
    : DEFAULT_VALID_EMAIL_DOMAINS;
  return domains.some(domain => emailLower.endsWith(domain.toLowerCase()));
}

/**
 * For Enreach users, try to match with employee_master_data by email
 * to get real names instead of email prefixes
 */
async function enrichEnreachUserName(
  supabase: SupabaseClient,
  user: StandardUser,
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void
): Promise<string> {
  try {
    // Try to find employee by work_email
    const { data: employee } = await supabase
      .from("employee_master_data")
      .select("first_name, last_name")
      .ilike("work_email", user.email)
      .maybeSingle()

    if (employee?.first_name) {
      const fullName = [employee.first_name, employee.last_name].filter(Boolean).join(" ").trim()
      if (fullName) {
        log("INFO", `Matched Enreach user ${user.email} to employee: ${fullName}`)
        return fullName
      }
    }
  } catch (e) {
    // Silently fail - just use original name
    log("WARN", `Failed to lookup employee for ${user.email}`, e)
  }
  return user.name
}

export async function processUsers(
  supabase: SupabaseClient,
  users: StandardUser[],
  log: (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void,
  source: "adversus" | "enreach" = "adversus",
  allowedDomains?: string[]
) {
  if (users.length === 0) return { processed: 0, errors: 0, skipped: 0 }
  log("INFO", `Processing ${users.length} users from ${source}...`)

  let processed = 0
  let errors = 0
  let skipped = 0

  for (const user of users) {
    try {
      // Skip users with invalid email domains (whitelist approach)
      if (!isValidSyncEmail(user.email, allowedDomains)) {
        log("INFO", `Skipping invalid sync email: ${user.email}`)
        skipped++
        continue
      }
      // For Enreach users, try to enrich name from employee_master_data
      let userName = user.name
      if (source === "enreach") {
        userName = await enrichEnreachUserName(supabase, user, log)
      }

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
        name: userName,
        email: user.email,
        is_active: user.isActive,
      }

      if (existing) {
        await supabase.from("agents").update(agentData).eq("id", existing.id)
      } else {
        // Use upsert with email conflict to prevent duplicate key errors
        const { error } = await supabase.from("agents").upsert(agentData, { onConflict: "email" })
        if (error) {
          log("WARN", `Upsert conflict for ${user.email}: ${error.message}`)
        }
      }
      processed++
    } catch (e) {
      errors++
      const errMsg = e instanceof Error ? e.message : String(e)
      log("ERROR", `Error saving user ${user.name}`, errMsg)
    }
  }
  
  if (skipped > 0) {
    log("INFO", `Skipped ${skipped} users with excluded email domains`)
  }
  
  return { processed, errors, skipped }
}

