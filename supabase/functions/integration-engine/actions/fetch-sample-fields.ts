import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getAdapter } from "../adapters/registry.ts"
type LogFn = (type: "INFO" | "ERROR" | "WARN", msg: string, data?: unknown) => void

interface SampleField {
  fieldId: string
  label: string
  sampleValue: string
  path: string
}

/**
 * Fetches sample fields from an integration's API to help with field mapping.
 * This function retrieves recent sales/leads data and extracts all available fields.
 */
export async function fetchSampleFields(
  supabase: SupabaseClient,
  integrationId: string | undefined,
  log: LogFn
): Promise<{
  success: boolean
  fields: SampleField[]
  leadCount: number
  message?: string
}> {
  if (!integrationId) {
    return { success: false, fields: [], leadCount: 0, message: "No integration ID provided" }
  }

  log("INFO", `Fetching sample fields for integration: ${integrationId}`)

  // Get the integration details
  const { data: integration, error: intError } = await supabase
    .from("dialer_integrations")
    .select("*")
    .eq("id", integrationId)
    .single()

  if (intError || !integration) {
    log("ERROR", `Integration not found: ${integrationId}`, { error: intError?.message })
    return { success: false, fields: [], leadCount: 0, message: "Integration not found" }
  }

  log("INFO", `Found integration: ${integration.name} (${integration.provider})`)

  // Get decrypted credentials
  const encryptionKey = Deno.env.get("DB_ENCRYPTION_KEY")
  const { data: credentials, error: credError } = await supabase.rpc("get_dialer_credentials", {
    p_integration_id: integration.id,
    p_encryption_key: encryptionKey,
  })

  if (credError) {
    log("ERROR", `Failed to get credentials: ${credError.message}`)
    return { success: false, fields: [], leadCount: 0, message: "Failed to get credentials" }
  }

  try {
    // Get the adapter for this integration
    const adapter = await getAdapter(
      integration.provider,
      credentials,
      integration.name,
      integration.api_url,
      integration.config
    )

    // Use lightweight fetchSalesRaw if available (fast path - ~2-3 seconds)
    // Otherwise fall back to fetchSales (slow path - ~30 seconds)
    let rawPayloads: Record<string, unknown>[] = []
    let leadCount = 0

    if (adapter.fetchSalesRaw) {
      log("INFO", `Using fast fetchSalesRaw from ${integration.provider} API...`)
      rawPayloads = await adapter.fetchSalesRaw(20)
      leadCount = rawPayloads.length
      log("INFO", `Fast path: Retrieved ${leadCount} raw records`)
    } else {
      log("INFO", `Fallback: Fetching full sales data from ${integration.provider} API...`)
      const sales = await adapter.fetchSales(7)
      leadCount = sales.length
      rawPayloads = sales.slice(0, 10).map(s => s.rawPayload as Record<string, unknown>).filter(Boolean)
      log("INFO", `Slow path: Retrieved ${leadCount} sales, using ${rawPayloads.length} for field extraction`)
    }

    if (rawPayloads.length === 0) {
      log("INFO", "No data found in the last 7 days")
      return {
        success: true,
        fields: [],
        leadCount: 0,
        message: `No data found in the last 7 days for ${integration.name}`,
      }
    }

    log("INFO", `Extracting field structure from ${rawPayloads.length} records...`)

    // Extract all unique fields from the raw payloads
    const fieldsMap = new Map<string, SampleField>()

    for (const rawPayload of rawPayloads.slice(0, 10)) {
      if (!rawPayload) continue
      // Extract fields recursively
      extractFields(rawPayload, "", fieldsMap)
    }

    // Convert to array and sort
    const fields = Array.from(fieldsMap.values())
      .sort((a, b) => a.path.localeCompare(b.path))

    log("INFO", `Extracted ${fields.length} unique fields`)

    return {
      success: true,
      fields,
      leadCount,
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    log("ERROR", `Failed to fetch sample fields: ${errMsg}`)
    return { success: false, fields: [], leadCount: 0, message: errMsg }
  }
}

/**
 * Recursively extracts fields from a nested object
 */
function extractFields(
  obj: Record<string, unknown>,
  parentPath: string,
  fieldsMap: Map<string, SampleField>
): void {
  for (const [key, value] of Object.entries(obj)) {
    const path = parentPath ? `${parentPath}.${key}` : key

    if (value === null || value === undefined) {
      // Still add the field but with empty value
      if (!fieldsMap.has(path)) {
        fieldsMap.set(path, {
          fieldId: path,
          label: formatLabel(key),
          sampleValue: "(empty)",
          path,
        })
      }
    } else if (Array.isArray(value)) {
      // For arrays, check if it's an array of objects (like resultData)
      if (value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
        // Check if it's a label/value array structure (common in Adversus)
        const firstItem = value[0] as Record<string, unknown>
        if ("label" in firstItem && "value" in firstItem) {
          // Handle Adversus-style resultData: [{id, label, value}, ...]
          for (const item of value) {
            const typedItem = item as { id?: number; label?: string; value?: unknown }
            if (typedItem.label) {
              const itemPath = `${path}[${typedItem.label}]`
              if (!fieldsMap.has(itemPath)) {
                fieldsMap.set(itemPath, {
                  fieldId: itemPath,
                  label: String(typedItem.label),
                  sampleValue: formatValue(typedItem.value),
                  path: itemPath,
                })
              }
            }
          }
        } else {
          // Regular array of objects - recurse into first item
          extractFields(firstItem as Record<string, unknown>, `${path}[0]`, fieldsMap)
        }
      } else if (value.length > 0) {
        // Array of primitives
        if (!fieldsMap.has(path)) {
          fieldsMap.set(path, {
            fieldId: path,
            label: formatLabel(key),
            sampleValue: formatValue(value[0]),
            path,
          })
        }
      }
    } else if (typeof value === "object") {
      // Recurse into nested objects
      extractFields(value as Record<string, unknown>, path, fieldsMap)
    } else {
      // Primitive value
      if (!fieldsMap.has(path)) {
        fieldsMap.set(path, {
          fieldId: path,
          label: formatLabel(key),
          sampleValue: formatValue(value),
          path,
        })
      }
    }
  }
}

/**
 * Format a field key into a readable label
 */
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1") // Add space before capitals
    .replace(/[_-]/g, " ") // Replace underscores/hyphens with spaces
    .replace(/\s+/g, " ") // Normalize spaces
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase()) // Capitalize first letter
}

/**
 * Format a value for display
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(empty)"
  if (typeof value === "string") return value.slice(0, 100) // Truncate long strings
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (value instanceof Date) return value.toISOString()
  return JSON.stringify(value).slice(0, 100)
}
