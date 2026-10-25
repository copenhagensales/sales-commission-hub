// Ren logik (ingen Deno-afhængigheder) – testes af Vitest.

export const FIRST_RUN_MONTHS = 3;

function shift(period: string, delta: number) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Perioder (YYYY-MM) der skal hentes. Første kørsel: perioden + de 2 foregående (3 måneder i alt). */
export function portalPeriods(period: string, firstRun: boolean): string[] {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error("Ugyldig periode");
  const n = firstRun ? FIRST_RUN_MONTHS : 1;
  return Array.from({ length: n }, (_, i) => shift(period, -i));
}

/** Dansk dato "dd-mm-yyyy" / "dd.mm.yyyy" / "dd/mm/yyyy" eller ISO → "yyyy-mm-dd"; ellers null (gættes aldrig). */
export function parsePortalDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "1.234,56 kr." → 1234.56; ellers null. */
export function parsePortalAmount(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/\s|kr\.?|DKK/gi, "").match(/^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/);
  if (!m) return null;
  const n = Number(m[0].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export const periodOf = (isoDate: string | null) => (isoDate ? isoDate.slice(0, 7) : null);

// ---------- Katalog ----------
export type CatalogEntry = { slug: string; status: string; flow_version: number; login_fields: unknown };
export const PORTAL_MODULES = ["hiper"] as const;
export type PortalSlug = (typeof PORTAL_MODULES)[number];

export class PortalError extends Error {
  constructor(public code: "PORTAL_LAYOUT" | "PORTAL_REQUIRES_CODE" | "PORTAL_LOGIN_FAILED" | "PORTAL_NOT_SUPPORTED" | "BROWSERBASE" | "CREDENTIAL_MISSING", message: string, public retryable = false) {
    super(message);
  }
}

/** Slår katalogrækken op og validerer at modulet findes og er understøttet. */
export function resolveCatalog(entry: CatalogEntry | null | undefined): { slug: PortalSlug; fields: string[]; flowVersion: number } {
  if (!entry) throw new PortalError("PORTAL_NOT_SUPPORTED", "Portalen findes ikke i kataloget");
  if (entry.status !== "understoettet") throw new PortalError("PORTAL_NOT_SUPPORTED", "Portalen er ikke understøttet");
  if (!(PORTAL_MODULES as readonly string[]).includes(entry.slug)) throw new PortalError("PORTAL_NOT_SUPPORTED", "Intet flow-modul for portalen");
  const fields = Array.isArray(entry.login_fields) ? entry.login_fields.filter((f): f is string => typeof f === "string") : [];
  if (!fields.length) throw new PortalError("PORTAL_NOT_SUPPORTED", "Kataloget mangler loginfelter");
  return { slug: entry.slug as PortalSlug, fields, flowVersion: entry.flow_version };
}
