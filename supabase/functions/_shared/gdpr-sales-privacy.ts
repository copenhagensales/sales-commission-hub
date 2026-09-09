/**
 * Shared, side-effect-free helpers for the GDPR sales anonymisation flow.
 *
 * Used by gdpr-data-cleanup. Kept pure so the behaviour can be reasoned about
 * and verified without touching the database.
 */

/** Identity keys removed from sales.normalized_data on anonymisation. */
export const NORMALIZED_IDENTITY_KEYS = [
  "customer_name",
  "customer_email",
  "customer_zip",
  "customer_address",
  "customer_city",
  "phone_number",
  "member_number",
  "current_akasse",
] as const;

/** Keys removed from cancellation_queue.uploaded_data on anonymisation. */
export const CANCELLATION_IDENTITY_KEYS = [
  "Phone Number",
  "Age",
  "Beskæftigelsesstatus",
  "A-kasse",
  "Medlemsnummer",
  "Indmeldelsesdato",
] as const;

type Json = Record<string, unknown>;

function normalizeLabel(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function labelledValue(payload: Json | null, arrayKey: string, labels: string[]): string | null {
  const arr = payload?.[arrayKey];
  if (!Array.isArray(arr)) return null;
  const wanted = labels.map((l) => normalizeLabel(l));
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Json;
    if (wanted.includes(normalizeLabel(row.label))) {
      const value = row.value;
      if (value !== null && value !== undefined && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
  }
  return null;
}

function fieldsValue(payload: Json | null, objectKey: string, labels: string[]): string | null {
  const obj = payload?.[objectKey];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return null;
  const wanted = labels.map((l) => normalizeLabel(l));
  for (const [key, value] of Object.entries(obj as Json)) {
    if (!wanted.includes(normalizeLabel(key))) continue;
    if (value !== null && value !== undefined && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return null;
}

/**
 * Extracts the OPP number from a sales raw_payload, mirroring the
 * COALESCE order used by get_sales_report_raw.
 */
export function extractOppNumber(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Json;
  const legacy = p.legacy_opp_number;
  if (legacy !== null && legacy !== undefined && String(legacy).trim() !== "") {
    return String(legacy).trim();
  }
  const labels = ["OPP nr", "OPP-nr", "OPP nr."];
  return fieldsValue(p, "leadResultFields", labels) ?? labelledValue(p, "leadResultData", labels);
}

/** Extracts the Sales ID (CVR) from a sales raw_payload. */
export function extractSalesId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const p = payload as Json;
  const labels = ["Sales ID", "SalesID", "Sales Id"];
  return fieldsValue(p, "leadResultFields", labels) ?? labelledValue(p, "leadResultData", labels);
}

export interface PayloadLineCommission {
  lineId: string | null;
  title: string | null;
  commission: number;
}

/**
 * Reads per-line commission (e.g. Relatel totalProvision) from a raw_payload,
 * so it can be persisted to sale_items.mapped_commission before the payload is
 * dropped. Only lines with a usable numeric value are returned.
 */
export function extractPayloadLineCommissions(payload: unknown): PayloadLineCommission[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const lines = (payload as Json).lines;
  if (!Array.isArray(lines)) return [];

  const result: PayloadLineCommission[] = [];
  for (const raw of lines) {
    if (!raw || typeof raw !== "object") continue;
    const line = raw as Json;
    const value = line.totalProvision ?? line.provision;
    if (value === null || value === undefined || value === "") continue;
    const commission = Number(value);
    if (!Number.isFinite(commission)) continue;
    result.push({
      lineId: line.lineId !== undefined && line.lineId !== null ? String(line.lineId) : null,
      title: typeof line.title === "string" ? line.title : null,
      commission,
    });
  }
  return result;
}

/**
 * Removes the configured identity keys from a normalized_data object.
 * Everything else (akasse_sale, akasse_type, association_type,
 * lonsikring_type, coverage_amount, subscription_type, ...) is preserved.
 * Returns null when nothing needed removal.
 */
export function stripKeys(
  data: unknown,
  keys: readonly string[]
): { changed: boolean; removed: string[]; result: Json | null } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { changed: false, removed: [], result: null };
  }
  const source = data as Json;
  const wanted = keys.map((k) => normalizeLabel(k));
  const next: Json = {};
  const removed: string[] = [];

  for (const [key, value] of Object.entries(source)) {
    if (wanted.includes(normalizeLabel(key))) {
      removed.push(key);
      continue;
    }
    next[key] = value;
  }

  if (removed.length === 0) return { changed: false, removed: [], result: null };
  return { changed: true, removed, result: next };
}

/** Cutoff ISO timestamp for a given retention window in days. */
export function cutoffIso(retentionDays: number, now = new Date()): string {
  const cutoff = new Date(now.getTime());
  cutoff.setDate(cutoff.getDate() - retentionDays);
  return cutoff.toISOString();
}

/** Fallback retention window used when no campaign rule covers a client. */
export const FALLBACK_RETENTION_DAYS = 180;

/** Retention window for adversus_events processing artefacts. */
export const ADVERSUS_EVENTS_RETENTION_DAYS = 90;
