/**
 * Shared OPP extraction utility for cancellation module.
 * 
 * Priority order (first non-empty wins):
 *   1. leadResultFields (fuzzy key match)
 *   2. leadResultData array (fuzzy label match)
 *   3. Top-level OPP keys (opp_nr, OPP nr, etc.)
 *   4. legacy_opp_number (last resort — may be truncated)
 */

function getCaseInsensitive(obj: Record<string, unknown> | undefined, key: string): unknown {
  if (!obj) return undefined;
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return obj[k];
  }
  const normalize = (s: string) => s.toLowerCase().replace(/[-\s.]/g, "");
  const normKey = normalize(key);
  for (const k of Object.keys(obj)) {
    if (normalize(k) === normKey) return obj[k];
  }
  return undefined;
}

const OPP_NORMALIZE = (s: string) => s.toLowerCase().replace(/[-\s.]/g, "");
const OPP_TARGET = OPP_NORMALIZE("OPP nr");

export function extractOpp(rawPayload: unknown): string {
  if (!rawPayload || typeof rawPayload !== "object") return "";
  const rp = rawPayload as Record<string, unknown>;

  // 1. leadResultFields — most reliable source
  const fields = rp["leadResultFields"] as Record<string, unknown> | undefined;
  if (fields) {
    const oppVal = getCaseInsensitive(fields, "OPP nr");
    if (oppVal) return String(oppVal).trim();
  }

  // 2. leadResultData array
  const data = rp["leadResultData"] as Array<{ label?: string; value?: string }> | undefined;
  if (Array.isArray(data)) {
    const found = data.find(d => d.label && OPP_NORMALIZE(d.label) === OPP_TARGET);
    if (found?.value) return String(found.value).trim();
  }

  // 3. Top-level OPP keys (fuzzy)
  const topLevel = getCaseInsensitive(rp, "OPP nr") ?? rp["opp_nr"] ?? rp["opp"] ?? rp["OPP"] ?? rp["opportunity_id"] ?? rp["reference"];
  if (topLevel) return String(topLevel).trim();

  // 4. legacy_opp_number — last resort (may be truncated)
  if (rp["legacy_opp_number"]) return String(rp["legacy_opp_number"]).trim();

  return "";
}
