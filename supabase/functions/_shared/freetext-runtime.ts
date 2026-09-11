/**
 * DB-glue til fritekstdetektoren (se freetext-strip.ts for reglerne).
 *
 * Ansvar:
 *  - Hente BEHOLD-ventilen fra ingestion_known_fields (cachet pr. kørsel)
 *  - Logge hver kørsel i gdpr_cleanup_log med action 'fritekst_strippet'
 *    (kun feltnavn, antal og regel — aldrig indhold)
 *  - Registrere regel B-fund som decision='BLOKER' i ingestion_known_fields,
 *    så et ukendt notefelt dukker op i feltregistret til gennemsyn
 *
 * Selve reglerne ligger i freetext-strip.ts og må ikke duplikeres her.
 */

import {
  type FreetextRemoval,
  mergeFreetextRemovals,
  stripFreetextFields,
  type StripFreetextOptions,
} from "./freetext-strip.ts";

/** Minimal klientflade — undgår hård kobling til supabase-js-versionen. */
// deno-lint-ignore no-explicit-any
type DbClient = { from: (table: string) => any };

export const FREETEXT_LOG_ACTION = "fritekst_strippet";
const BLOKER_NOTE = "Fjernet af fritekstdetektor";

/** Feltnavne der er frikendt i feltregistret (decision='BEHOLD'). */
export async function loadKeepLabels(supabase: DbClient): Promise<Set<string>> {
  const keep = new Set<string>();
  try {
    const { data } = await supabase
      .from("ingestion_known_fields")
      .select("field_label")
      .eq("decision", "BEHOLD");
    for (const row of (data ?? []) as { field_label: string }[]) {
      if (typeof row.field_label === "string") {
        keep.add(row.field_label.trim().toLowerCase());
      }
    }
  } catch (_e) {
    // Ventilen er en undtagelse, ikke en forudsætning: kan den ikke læses,
    // filtrerer vi hårdt frem for at lade fritekst slippe igennem.
  }
  return keep;
}

export interface FreetextStripper {
  /** Fjerner fritekst fra en payload og akkumulerer statistik. */
  strip<T>(input: T): T;
  /** Markerer at ét salg blev behandlet (bruges til antal salg i loggen). */
  countSale(): void;
  /** Skriver loggen + registrerer regel B-fund. Sikker at kalde flere gange. */
  flush(): Promise<void>;
  /** Aktuelle removals — til test/diagnostik. */
  removals(): FreetextRemoval[];
}

export interface CreateStripperOptions extends StripFreetextOptions {
  /** Integrationsnavn brugt ved registrering af regel B-fund. */
  integration: string;
  /** Beholdernavn brugt ved registrering af regel B-fund. */
  container?: string;
  /** Hvem der udløste kørslen (gdpr_cleanup_log.triggered_by). */
  triggeredBy: string;
}

/**
 * Opretter en stripper med BEHOLD-ventilen indlæst én gang.
 * Brug én stripper pr. indtagskørsel og kald flush() til sidst.
 */
export async function createFreetextStripper(
  supabase: DbClient,
  options: CreateStripperOptions,
): Promise<FreetextStripper> {
  const keep = options.keepLabels
    ? new Set([...options.keepLabels].map((k) => k.trim().toLowerCase()))
    : await loadKeepLabels(supabase);

  const acc = new Map<string, FreetextRemoval>();
  let sales = 0;
  let flushed = false;

  return {
    strip<T>(input: T): T {
      const result = stripFreetextFields(input, {
        keepLabels: keep,
        blockedLabels: options.blockedLabels,
      });
      mergeFreetextRemovals(acc, result.removals);
      return result.data;
    },
    countSale() {
      sales++;
    },
    removals() {
      return [...acc.values()];
    },
    async flush() {
      if (flushed) return;
      const removals = [...acc.values()];
      if (removals.length === 0) return;
      flushed = true;
      await logFreetextRemovals(supabase, {
        removals,
        salesAffected: sales,
        integration: options.integration,
        container: options.container ?? "raw_payload",
        triggeredBy: options.triggeredBy,
      });
    },
  };
}

export interface LogFreetextArgs {
  removals: FreetextRemoval[];
  salesAffected: number;
  integration: string;
  container: string;
  triggeredBy: string;
}

/**
 * Logger fjernelserne og registrerer regel B-fund som BLOKER.
 * Fejl her må aldrig vælte et indtag — de logges kun.
 */
export async function logFreetextRemovals(
  supabase: DbClient,
  args: LogFreetextArgs,
): Promise<void> {
  const { removals, salesAffected, integration, container, triggeredBy } = args;
  if (removals.length === 0) return;

  const ruleAFields = new Set(
    removals.filter((r) => r.rule === "A").map((r) => r.field.trim().toLowerCase()),
  );

  try {
    await supabase.from("gdpr_cleanup_log").insert({
      action: FREETEXT_LOG_ACTION,
      records_affected: salesAffected,
      triggered_by: triggeredBy,
      details: {
        integration,
        container,
        felter_fjernet_i_alt: removals.reduce((sum, r) => sum + r.count, 0),
        felter: removals
          .slice()
          .sort((a, b) => b.count - a.count)
          .map((r) => ({ felt: r.field, antal: r.count, regel: r.rule })),
      },
    });
  } catch (e) {
    console.error("[freetext-strip] kunne ikke logge til gdpr_cleanup_log", e);
  }

  // Regel B-fund uden navnematch = ukendt notefelt → skal ses efter.
  const unknownFields = removals.filter(
    (r) => r.rule === "B" && !ruleAFields.has(r.field.trim().toLowerCase()),
  );
  if (unknownFields.length === 0) return;

  const now = new Date().toISOString();
  try {
    await supabase.from("ingestion_known_fields").upsert(
      unknownFields.map((r) => ({
        integration,
        container,
        field_label: r.field,
        decision: "BLOKER",
        note: BLOKER_NOTE,
        occurrences: r.count,
        last_seen: now,
      })),
      { onConflict: "integration,container,field_label" },
    );
  } catch (e) {
    console.error("[freetext-strip] kunne ikke registrere regel B-felt", e);
  }
}
