/**
 * DB-glue til indtagsfilteret (reglerne ligger i ingestion-filter.ts).
 *
 * Ansvar:
 *  - Læse beslutningerne i public.ingestion_known_fields (cachet i 5 minutter),
 *    så en ændring i UI'et virker uden en ny udrulning
 *  - Læse flaget public.ingestion_filter_settings.phone_filter_enabled
 *  - Logge hver kørsel i gdpr_cleanup_log med action 'ingestion_filter'
 *    (kun feltnavn, beholder, antal og regel — aldrig indhold)
 *  - Registrere ukendte felter som 'UAFKLARET' (udløser 'nyt_ukendt_felt')
 *    og fritekstfund som 'BLOKER'
 *
 * Reglerne må IKKE duplikeres her.
 */

import {
  createDecisionLookup,
  createFilterStats,
  type DecisionLookup,
  filterIngestionPayload,
  type FilterStats,
  filterPiiFields,
  type KnownFieldRow,
  summarizeStats,
} from "./ingestion-filter.ts";

/** Minimal klientflade — undgår hård kobling til supabase-js-versionen. */
// deno-lint-ignore no-explicit-any
type DbClient = { from: (table: string) => any };

export const INGESTION_FILTER_LOG_ACTION = "ingestion_filter";
const FREETEXT_NOTE = "Fjernet af fritekstdetektor";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedConfig {
  rows: KnownFieldRow[];
  phoneFilterEnabled: boolean;
  loadedAt: number;
}

let cache: CachedConfig | null = null;

/** Nulstiller cachen (bruges i test og ved manuel genindlæsning). */
export function resetIngestionFilterCache(): void {
  cache = null;
}

async function loadConfig(supabase: DbClient): Promise<CachedConfig> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache;

  let rows: KnownFieldRow[] = [];
  try {
    const { data } = await supabase
      .from("ingestion_known_fields")
      .select("integration, container, field_label, decision")
      .limit(20000);
    rows = (data ?? []) as KnownFieldRow[];
  } catch (e) {
    console.error("[ingestion-filter] kunne ikke læse feltregistret", e);
    // Kan registret ikke læses, bruger vi den forrige cache hvis den findes.
    if (cache) return cache;
  }

  let phoneFilterEnabled = false;
  try {
    const { data } = await supabase
      .from("ingestion_filter_settings")
      .select("phone_filter_enabled")
      .limit(1)
      .maybeSingle();
    phoneFilterEnabled = data?.phone_filter_enabled === true;
  } catch (e) {
    console.error("[ingestion-filter] kunne ikke læse indstillinger", e);
  }

  cache = { rows, phoneFilterEnabled, loadedAt: Date.now() };
  return cache;
}

export interface IngestionFilter {
  /** Filtrerer en beholder (fx 'raw_payload', 'normalized_data'). */
  filter<T>(input: T, container?: string): T;
  /** Holder pii_fields i sync med de fjernede felter. */
  filterPii(piiFields: string[] | null | undefined, container?: string): string[] | null;
  /** Markerer at ét salg blev behandlet (antal salg i loggen). */
  countSale(): void;
  /** Skriver log + registrerer ukendte/fritekstfelter. Sikker at kalde flere gange. */
  flush(): Promise<void>;
  /** Aktuel statistik — til diagnostik og test. */
  stats(): FilterStats;
  /** Er telefonfiltrering slået til i basen? */
  phoneFilterEnabled: boolean;
}

export interface CreateIngestionFilterOptions {
  /** Integrationsnavn ('adversus', 'enreach', 'fieldmarketing', ...). */
  integration: string;
  /** Hvem der udløste kørslen (gdpr_cleanup_log.triggered_by). */
  triggeredBy: string;
}

export async function createIngestionFilter(
  supabase: DbClient,
  options: CreateIngestionFilterOptions,
): Promise<IngestionFilter> {
  const config = await loadConfig(supabase);
  const lookup: DecisionLookup = createDecisionLookup(
    config.rows,
    options.integration,
  );
  const opts = { lookup, phoneFilterEnabled: config.phoneFilterEnabled };
  const stats = createFilterStats();
  let flushed = false;

  return {
    phoneFilterEnabled: config.phoneFilterEnabled,
    filter<T>(input: T, container = "raw_payload"): T {
      if (input === null || input === undefined) return input;
      return filterIngestionPayload(input, container, opts, stats).data;
    },
    filterPii(piiFields, container = "normalized_data") {
      return filterPiiFields(piiFields, container, opts);
    },
    countSale() {
      stats.salesAffected++;
    },
    stats() {
      return stats;
    },
    async flush() {
      if (flushed) return;
      flushed = true;
      await persistStats(supabase, stats, options);
    },
  };
}

async function persistStats(
  supabase: DbClient,
  stats: FilterStats,
  options: CreateIngestionFilterOptions,
): Promise<void> {
  const summary = summarizeStats(stats);
  const now = new Date().toISOString();

  if (summary.felter_fjernet_i_alt > 0 || summary.nye_ukendte_felter.length > 0) {
    try {
      await supabase.from("gdpr_cleanup_log").insert({
        action: INGESTION_FILTER_LOG_ACTION,
        records_affected: stats.salesAffected,
        triggered_by: options.triggeredBy,
        details: {
          integration: options.integration,
          salg_behandlet: stats.salesAffected,
          ...summary,
        },
      });
    } catch (e) {
      console.error("[ingestion-filter] kunne ikke logge til gdpr_cleanup_log", e);
    }
  }

  // Regel 3: ukendte felter registreres som UAFKLARET uden at overskrive
  // en eksisterende beslutning (ignoreDuplicates).
  const unknown = [...stats.unknown.values()];
  if (unknown.length > 0) {
    try {
      await supabase.from("ingestion_known_fields").upsert(
        unknown.map((f) => ({
          integration: options.integration,
          container: f.container,
          field_label: f.field,
          decision: "UAFKLARET",
          occurrences: f.count,
          last_seen: now,
        })),
        { onConflict: "integration,container,field_label", ignoreDuplicates: true },
      );
    } catch (e) {
      console.error("[ingestion-filter] kunne ikke registrere ukendt felt", e);
    }
  }

  // Regel 4: fritekstfund sættes til BLOKER, så de dukker op i feltregistret.
  const blocked = [...stats.freetextBlocked.values()];
  if (blocked.length > 0) {
    try {
      await supabase.from("ingestion_known_fields").upsert(
        blocked.map((f) => ({
          integration: options.integration,
          container: f.container,
          field_label: f.field,
          decision: "BLOKER",
          note: FREETEXT_NOTE,
          occurrences: f.count,
          last_seen: now,
        })),
        { onConflict: "integration,container,field_label" },
      );
    } catch (e) {
      console.error("[ingestion-filter] kunne ikke registrere fritekstfelt", e);
    }
  }
}
