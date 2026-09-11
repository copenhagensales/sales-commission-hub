/**
 * GDPR: ÉT databasedrevet indtagsfilter for alle indtagsveje.
 *
 * Beslutning (Kasper, 11. sep 2026): de tre ad hoc-filtre (normalized-identity,
 * fritekstdetektoren og den hårdkodede blokering af CVR-felter) erstattes af ét
 * modul, hvor REGLERNE LIGGER I DATABASEN — public.ingestion_known_fields.
 * Ændres en beslutning i UI'et, følger filteret med uden en ny udrulning.
 *
 * Rækkefølgen af regler pr. felt:
 *   0. Telefonfelt og phone_filter_enabled=false → feltet røres ikke (Kasper
 *      har ikke truffet den sidste beslutning om telefonnumre).
 *   1. decision='BLOKER'    → feltet fjernes. Hårdt, uden undtagelse.
 *   2. decision='BEHOLD'    → feltet beholdes, fritekstdetektoren springes over.
 *   3. Feltet er ukendt     → værdien beholdes, feltet registreres som
 *      'UAFKLARET' (udløser alarmen 'nyt_ukendt_felt') OG fritekstdetektoren
 *      køres, jf. regel 4.
 *   4. decision='UAFKLARET' → værdien beholdes, men fritekstdetektoren køres.
 *      Rammer den, fjernes feltet og registreres som 'BLOKER'.
 *
 * Regel 3 og 4 er skyggetilstanden: ingenting går tabt, men alt ukendt bliver
 * synligt og skal afklares. Når UAFKLARET er nul, kan vi skifte til streng
 * positivliste.
 *
 * Modulet er rent (ingen I/O) og er single source of truth for både edge
 * functions og frontend. Der returneres KUN feltnavn, beholder, antal og regel
 * — aldrig indholdet af feltet.
 */

/** Beslutninger i public.ingestion_known_fields. */
export type FieldDecision = "BLOKER" | "BEHOLD" | "UAFKLARET";

/** Hvilken regel der fjernede feltet. */
export type FilterRule = "BLOKER" | "FRITEKST_NAVN" | "FRITEKST_VAERDI";

/** Beholdere der filtreres. *Fields og data er OBJEKTER, resten kan være ARRAYS. */
export const RAW_PAYLOAD_SUBCONTAINERS = [
  "data",
  "masterData",
  "masterDataFields",
  "leadResultData",
  "leadResultFields",
  "closureData",
] as const;

export const CONTAINERS = [
  "raw_payload",
  ...RAW_PAYLOAD_SUBCONTAINERS,
  "normalized_data",
  "uploaded_data",
  "fieldmarketing",
] as const;

/** Fritekst: feltnavne der altid er fritekst (kun for UAFKLARET/ukendte felter). */
export const FREETEXT_NAME_REGEX =
  /notat|note|noter|bemaerk|bemærk|kommentar|comment|fastgjorte/i;

/** Fritekst: minimumslængde før en værdi kan regnes som fritekst. */
export const FREETEXT_MIN_LENGTH = 120;
/** Fritekst: minimum antal mellemrum i en lang værdi. */
export const FREETEXT_MIN_SPACES = 3;

/**
 * Telefonfelter holdes udenfor indtil Kasper har besluttet Finansforbundets
 * nummerfelter og Tryg via Adversus. Mønstret er bevidst bredt: at lade et
 * telefonfelt slippe igennem er den ønskede fejlretning, mens at fjerne det
 * for tidligt ikke kan gøres om.
 */
export const PHONE_FIELD_REGEX =
  /telefon|phone|mobil|\btlf\b|msisdn|kontakt\s*nummer|kontakt\s*nr\b|(ældste|aeldste|nyeste)\s+nummer|live\s+nummer|abo\s*\d|\bnummer\s*\d|\bnr\s*\d/i;

export function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/** Fritekst regel A: matcher feltnavnet fritekstmønstret? */
export function matchesFreetextName(label: string): boolean {
  return FREETEXT_NAME_REGEX.test(label.trim());
}

/** Fritekst regel B: ligner værdien fritekst? */
export function looksLikeFreetextValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (/[\n\r]/.test(value)) return true;
  if (value.length > FREETEXT_MIN_LENGTH) {
    const spaces = value.length - value.replace(/ /g, "").length;
    if (spaces >= FREETEXT_MIN_SPACES) return true;
  }
  return false;
}

/** Er feltnavnet et telefonfelt? */
export function isPhoneField(label: string): boolean {
  return PHONE_FIELD_REGEX.test(label.trim());
}

export interface KnownFieldRow {
  integration: string;
  container: string;
  field_label: string;
  decision: string;
}

/**
 * Opslag i feltregistret. Præcist match (integration+beholder+felt) vinder;
 * ellers slås feltnavnet op på tværs, hvor BLOKER vinder over BEHOLD.
 * Det gør et blokeret felt blokeret i ALLE beholdere — også dem hvor det
 * endnu ikke er registreret. Det var netop hullet i de gamle filtre.
 */
export type DecisionLookup = (
  container: string,
  label: string,
) => FieldDecision | undefined;

const DECISION_RANK: Record<FieldDecision, number> = {
  BLOKER: 3,
  BEHOLD: 2,
  UAFKLARET: 1,
};

function asDecision(value: string): FieldDecision | undefined {
  const v = value?.trim().toUpperCase();
  if (v === "BLOKER" || v === "BEHOLD" || v === "UAFKLARET") return v;
  return undefined;
}

export function createDecisionLookup(
  rows: KnownFieldRow[],
  integration?: string,
): DecisionLookup {
  const exact = new Map<string, FieldDecision>();
  const byLabel = new Map<string, FieldDecision>();
  const wantedIntegration = integration ? normalizeLabel(integration) : null;

  for (const row of rows ?? []) {
    const decision = asDecision(String(row?.decision ?? ""));
    if (!decision || typeof row.field_label !== "string") continue;
    const label = normalizeLabel(row.field_label);
    if (label === "") continue;

    const container = normalizeLabel(String(row.container ?? ""));
    const rowIntegration = normalizeLabel(String(row.integration ?? ""));
    if (!wantedIntegration || rowIntegration === wantedIntegration) {
      exact.set(`${container}::${label}`, decision);
    }

    const current = byLabel.get(label);
    if (!current || DECISION_RANK[decision] > DECISION_RANK[current]) {
      byLabel.set(label, decision);
    }
  }

  return (container, label) => {
    const key = normalizeLabel(label);
    return exact.get(`${normalizeLabel(container)}::${key}`) ?? byLabel.get(key);
  };
}

export interface RemovedField {
  /** Feltnavnet. Aldrig værdien. */
  field: string;
  container: string;
  rule: FilterRule;
  count: number;
}

export interface SeenField {
  field: string;
  container: string;
  count: number;
}

/** Statistik for en hel kørsel. Kan deles på tværs af mange salg. */
export interface FilterStats {
  removed: Map<string, RemovedField>;
  /** Ukendte felter der skal registreres som UAFKLARET (regel 3). */
  unknown: Map<string, SeenField>;
  /** Felter fritekstdetektoren fjernede, og som skal sættes til BLOKER (regel 4). */
  freetextBlocked: Map<string, SeenField>;
  salesAffected: number;
}

export function createFilterStats(): FilterStats {
  return {
    removed: new Map(),
    unknown: new Map(),
    freetextBlocked: new Map(),
    salesAffected: 0,
  };
}

export interface FilterOptions {
  lookup: DecisionLookup;
  /** Når false springes alle telefonfelter over, uanset BLOKER. */
  phoneFilterEnabled: boolean;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** masterData/leadResultData/closureData er arrays af {label,value} eller {name,value}. */
function labelOf(item: unknown): string | null {
  if (!isPlainObject(item)) return null;
  if (typeof item.label === "string") return item.label;
  if (typeof item.name === "string") return item.name;
  return null;
}

function bump<T extends { count: number }>(
  map: Map<string, T>,
  key: string,
  make: () => T,
): void {
  const existing = map.get(key);
  if (existing) existing.count++;
  else map.set(key, make());
}

function record(
  stats: FilterStats,
  container: string,
  field: string,
  rule: FilterRule,
): void {
  const key = `${rule}::${normalizeLabel(container)}::${normalizeLabel(field)}`;
  bump(stats.removed, key, () => ({
    field: field.trim(),
    container,
    rule,
    count: 1,
  }));
}

function noteUnknown(stats: FilterStats, container: string, field: string): void {
  const key = `${normalizeLabel(container)}::${normalizeLabel(field)}`;
  bump(stats.unknown, key, () => ({ field: field.trim(), container, count: 1 }));
}

function noteFreetextBlocked(
  stats: FilterStats,
  container: string,
  field: string,
): void {
  const key = `${normalizeLabel(container)}::${normalizeLabel(field)}`;
  bump(stats.freetextBlocked, key, () => ({
    field: field.trim(),
    container,
    count: 1,
  }));
}

/**
 * Afgør om et felt skal fjernes. Returnerer null når feltet beholdes.
 * Registrerer samtidig ukendte felter og fritekstfund i statistikken.
 */
function decide(
  label: string,
  value: unknown,
  container: string,
  opts: FilterOptions,
  stats: FilterStats,
): FilterRule | null {
  // Regel 0: telefonfelter holdes udenfor indtil flaget slås til.
  if (!opts.phoneFilterEnabled && isPhoneField(label)) return null;

  const decision = opts.lookup(container, label);

  // Regel 1: BLOKER — hårdt, uden undtagelse.
  if (decision === "BLOKER") return "BLOKER";

  // Regel 2: BEHOLD — fritekstdetektoren springes over for netop dette felt.
  if (decision === "BEHOLD") return null;

  // Regel 3: ukendt felt → behold værdien, men gør det synligt som UAFKLARET.
  if (!decision) noteUnknown(stats, container, label);

  // Regel 4: UAFKLARET (og nye felter) → kør fritekstdetektoren.
  if (matchesFreetextName(label)) {
    noteFreetextBlocked(stats, container, label);
    return "FRITEKST_NAVN";
  }
  if (looksLikeFreetextValue(value)) {
    noteFreetextBlocked(stats, container, label);
    return "FRITEKST_VAERDI";
  }
  return null;
}

function walk(
  input: unknown,
  container: string,
  opts: FilterOptions,
  stats: FilterStats,
): unknown {
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) {
    const kept: unknown[] = [];
    for (const item of input) {
      const label = labelOf(item);
      if (label !== null) {
        const value = isPlainObject(item) ? item.value : undefined;
        const rule = decide(label, value, container, opts, stats);
        if (rule) {
          record(stats, container, label, rule);
          continue;
        }
      }
      kept.push(walk(item, container, opts, stats));
    }
    return kept;
  }

  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      // Underbeholdere i raw_payload filtreres under deres eget beholdernavn,
      // så feltregistret rammer den rigtige række.
      const sub = (RAW_PAYLOAD_SUBCONTAINERS as readonly string[]).includes(key)
        ? key
        : null;
      if (sub) {
        out[key] = walk(value, sub, opts, stats);
        continue;
      }
      const rule = decide(key, value, container, opts, stats);
      if (rule) {
        record(stats, container, key, rule);
        continue;
      }
      out[key] = walk(value, container, opts, stats);
    }
    return out;
  }

  return input;
}

/**
 * Filtrerer én beholder. Input muteres ikke, og funktionen er idempotent:
 * en anden kørsel på resultatet fjerner ikke mere.
 */
export function filterIngestionPayload<T>(
  input: T,
  container: string,
  opts: FilterOptions,
  stats: FilterStats = createFilterStats(),
): { data: T; stats: FilterStats } {
  const data = walk(input, container, opts, stats) as T;
  return { data, stats };
}

/** Fjerner de samme feltnavne fra en pii_fields-liste, så den holdes i sync. */
export function filterPiiFields(
  piiFields: string[] | null | undefined,
  container: string,
  opts: FilterOptions,
): string[] | null {
  if (!Array.isArray(piiFields)) return piiFields ?? null;
  const throwaway = createFilterStats();
  return piiFields.filter(
    (f) =>
      typeof f === "string" &&
      !decide(f, null, container, opts, throwaway),
  );
}

/** Aggregerede log-detaljer — kun feltnavn, beholder, antal og regel. */
export function summarizeStats(stats: FilterStats): {
  felter_fjernet_i_alt: number;
  felter: { felt: string; beholder: string; antal: number; regel: FilterRule }[];
  nye_ukendte_felter: { felt: string; beholder: string; antal: number }[];
} {
  const felter = [...stats.removed.values()]
    .sort((a, b) => b.count - a.count)
    .map((r) => ({
      felt: r.field,
      beholder: r.container,
      antal: r.count,
      regel: r.rule,
    }));
  return {
    felter_fjernet_i_alt: felter.reduce((sum, f) => sum + f.antal, 0),
    felter,
    nye_ukendte_felter: [...stats.unknown.values()].map((f) => ({
      felt: f.field,
      beholder: f.container,
      antal: f.count,
    })),
  };
}
