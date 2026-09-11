/**
 * GDPR: Fritekstdetektor for ALLE indtagsveje.
 *
 * Beslutning (Kasper, 8. sep 2026, skærpet 11. sep 2026): fritekstnoter må
 * ikke findes i Stork på nogen kampagne. En navneliste har fejlet tre gange
 * ("Note til lead", "Fastgjorte noter", "Bemærkninger", fm_comment) fordi et
 * nyt feltnavn ("Notater") altid slipper igennem. Derfor to regler:
 *
 *   Regel A — feltnavnet matcher mønstret (case-insensitivt, trimmet):
 *             notat | note | noter | bemaerk | bemærk | kommentar | comment | fastgjorte
 *   Regel B — VÆRDIEN ligner fritekst, uanset hvad feltet hedder:
 *             indeholder et linjeskift, ELLER er længere end 120 tegn og
 *             indeholder mindst tre mellemrum.
 *
 * Regel B er den vigtige: den fanger et notefelt med et navn vi aldrig har set.
 *
 * UNDTAGELSE: et felt røres ikke hvis feltnavnet står i ingestion_known_fields
 * med decision='BEHOLD'. Det er ventilen, så et legitimt langt felt kan
 * frikendes uden en kodeændring.
 *
 * Modulet er rent (ingen I/O) og er single source of truth for både edge
 * functions (raw_payload.data, raw_payload.masterData(-Fields),
 * raw_payload.leadResultData(-Fields), normalized_data) og frontend
 * (fieldmarketing-registreringen).
 *
 * Der returneres KUN feltnavn, antal og regel — aldrig indholdet af feltet.
 */

/** Regel A: feltnavne der altid er fritekst. */
export const FREETEXT_NAME_REGEX =
  /notat|note|noter|bemaerk|bemærk|kommentar|comment|fastgjorte/i;

/** Regel B: minimumslængde før en værdi kan regnes som fritekst. */
export const FREETEXT_MIN_LENGTH = 120;
/** Regel B: minimum antal mellemrum i en lang værdi. */
export const FREETEXT_MIN_SPACES = 3;

export type FreetextRule = "A" | "B";

export interface FreetextRemoval {
  /** Feltnavnet/labelen der blev fjernet. Aldrig værdien. */
  field: string;
  /** Hvilken regel der udløste fjernelsen. */
  rule: FreetextRule;
  /** Antal gange feltet blev fjernet i denne kørsel. */
  count: number;
}

export interface StripFreetextOptions {
  /** Feltnavne med decision='BEHOLD' — røres ikke af nogen regel. */
  keepLabels?: Iterable<string>;
  /** Ekstra feltnavne der altid fjernes (fx CVR-berigelsesfelter). */
  blockedLabels?: Iterable<string>;
}

export interface StripFreetextResult<T> {
  data: T;
  /** Aggregeret pr. feltnavn + regel. Tom liste = intet fjernet. */
  removals: FreetextRemoval[];
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function toSet(values: Iterable<string> | undefined): Set<string> {
  const set = new Set<string>();
  if (!values) return set;
  for (const v of values) {
    if (typeof v === "string" && v.trim() !== "") set.add(normalizeLabel(v));
  }
  return set;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isLabelValueItem(v: unknown): v is { label: unknown; value?: unknown } {
  return isPlainObject(v) && "label" in v;
}

/** Regel A: matcher feltnavnet fritekstmønstret? */
export function matchesFreetextName(label: string): boolean {
  return FREETEXT_NAME_REGEX.test(label.trim());
}

/** Regel B: ligner værdien fritekst? */
export function looksLikeFreetextValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (/[\n\r]/.test(value)) return true;
  if (value.length > FREETEXT_MIN_LENGTH) {
    const spaces = value.length - value.replace(/ /g, "").length;
    if (spaces >= FREETEXT_MIN_SPACES) return true;
  }
  return false;
}

interface Ctx {
  keep: Set<string>;
  blocked: Set<string>;
  removals: Map<string, FreetextRemoval>;
}

function record(ctx: Ctx, field: string, rule: FreetextRule): void {
  const key = `${rule}::${normalizeLabel(field)}`;
  const existing = ctx.removals.get(key);
  if (existing) {
    existing.count++;
    return;
  }
  ctx.removals.set(key, { field: field.trim(), rule, count: 1 });
}

/**
 * Afgør om et felt skal fjernes. Returnerer null når feltet beholdes.
 * BEHOLD-undtagelsen slår begge regler.
 */
function decide(ctx: Ctx, label: string, value: unknown): FreetextRule | null {
  const normalized = normalizeLabel(label);
  if (ctx.keep.has(normalized)) return null;
  if (ctx.blocked.has(normalized)) return "A";
  if (matchesFreetextName(label)) return "A";
  if (looksLikeFreetextValue(value)) return "B";
  return null;
}

function walk(input: unknown, ctx: Ctx): unknown {
  if (input === null || input === undefined) return input;

  if (Array.isArray(input)) {
    const kept: unknown[] = [];
    for (const item of input) {
      if (isLabelValueItem(item) && typeof item.label === "string") {
        const rule = decide(ctx, item.label, item.value);
        if (rule) {
          record(ctx, item.label, rule);
          continue;
        }
      }
      kept.push(walk(item, ctx));
    }
    return kept;
  }

  if (isPlainObject(input)) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      const rule = decide(ctx, key, value);
      if (rule) {
        record(ctx, key, rule);
        continue;
      }
      out[key] = walk(value, ctx);
    }
    return out;
  }

  return input;
}

/**
 * Fjerner fritekstfelter fra en vilkårlig payload (objekt, array eller
 * label/value-liste). Input muteres ikke.
 */
export function stripFreetextFields<T>(
  input: T,
  options: StripFreetextOptions = {},
): StripFreetextResult<T> {
  const ctx: Ctx = {
    keep: toSet(options.keepLabels),
    blocked: toSet(options.blockedLabels),
    removals: new Map(),
  };
  const data = walk(input, ctx) as T;
  return { data, removals: [...ctx.removals.values()] };
}

/** Slår removals fra flere payloads sammen til én liste. */
export function mergeFreetextRemovals(
  target: Map<string, FreetextRemoval>,
  removals: FreetextRemoval[],
): void {
  for (const r of removals) {
    const key = `${r.rule}::${normalizeLabel(r.field)}`;
    const existing = target.get(key);
    if (existing) existing.count += r.count;
    else target.set(key, { ...r });
  }
}
