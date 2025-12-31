import { DialerAdapter } from "./interface.ts"
import { AdversusAdapter } from "./adversus.ts"
import { EnreachAdapter } from "./enreach.ts"

export function getAdapter(
  provider: string | undefined,
  credentials: Record<string, unknown> | string[] | null,
  integrationName: string,
  integrationApiUrl?: string | null,
  integrationConfig?: unknown | null,
  callsOrgCodes?: string[] | null
): DialerAdapter {
  const p = (provider || "").toLowerCase()
  if (p === "adversus") {
    return new AdversusAdapter(credentials as Record<string, string> | null, integrationName)
  }
  if (p === "enreach") {
    const creds = {
      ...(credentials as Record<string, unknown> | null) || {},
      api_url: integrationApiUrl,
    } as Record<string, unknown>
    return new EnreachAdapter(creds as any, integrationName, integrationConfig as any, callsOrgCodes || null)
  }
  throw new Error(`Fuente no soportada: ${provider}`)
}
