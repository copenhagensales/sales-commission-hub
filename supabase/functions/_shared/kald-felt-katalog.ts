// Feltkataloget som data i hentningen (plan v2.5 F1b-2): ingest læser `kald_felt_katalog` (cache 5 min) og skriver KUN felter,
// der er hentes = ja og status aktiv. Kolonner, der ikke hentes, skrives som null (kernekolonner – NOT NULL/nøgler – skrives altid);
// metadata-nøgler, der ikke hentes eller ikke findes i kataloget, kasseres. Afledte felter (afledt:…) følger deres afhængigheder.
// Rækker stemples med katalog_version. Ligger i _shared, fordi både integration-engine og andre funktioner bruger det.
// deno-lint-ignore-file no-explicit-any -- supabase-js er 3rd party

export interface KatalogRaekke {
  kilde: string;
  endpoint: string;
  felt_sti: string;
  kampagne_ekstern_id: string | null;
  adversus_felt_id: number | null;
  maal_tabel: string | null;
  maal_kolonne: string | null;
  metadata_noegle: string | null;
  hentes: boolean;
  status: string;
  afledt_af: string[];
  klassifikation: string;
}

export interface Katalog {
  raekker: KatalogRaekke[];
  version: number;
  hentet: number;  // ms-tidsstempel
}

export const KATALOG_CACHE_MS = 5 * 60 * 1000;

/** Kolonner, der altid skrives (NOT NULL/nøgler) – kan ikke slås fra i kataloget; et hentes = nej logges, men ignoreres. */
export const KERNEKOLONNER: Record<string, ReadonlySet<string>> = {
  dialer_calls: new Set(["external_id", "integration_type", "dialer_name", "start_time", "end_time", "duration_seconds", "total_duration_seconds", "status", "agent_external_id", "campaign_external_id", "lead_external_id"]),
  dialer_leads: new Set(["external_id", "integration_id"]),
  dialer_sessions: new Set(["external_id", "integration_id", "status", "source"]),
};

export function kildeForIntegrationType(t: string | undefined): string {
  return t === "enreach" ? "enreach" : "adversus";
}

let cache: Katalog | null = null;
let igang: Promise<Katalog> | null = null;

/** Nulstiller cachen (prøver). */
export function nulstilKatalogCache(): void { cache = null; igang = null; }

/** Henter kataloget med service-klienten (cache 5 min; samtidige kald deler ét opslag). Kaster ved fejl – kalderen vælger fallback. */
export async function hentKatalog(svc: any, opts: { tvang?: boolean } = {}): Promise<Katalog> {
  if (!opts.tvang && cache && Date.now() - cache.hentet < KATALOG_CACHE_MS) return cache;
  if (!igang) {
    igang = (async () => {
      const [{ data: raekker, error: e1 }, { data: ver, error: e2 }] = await Promise.all([
        svc.from("kald_felt_katalog").select("kilde, endpoint, felt_sti, kampagne_ekstern_id, adversus_felt_id, maal_tabel, maal_kolonne, metadata_noegle, hentes, status, afledt_af, klassifikation").limit(5000),
        svc.from("kald_felt_katalog_version").select("version").order("version", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (e1) throw new Error(`feltkatalog: ${e1.message ?? e1}`);
      if (e2) throw new Error(`feltkatalog version: ${e2.message ?? e2}`);
      if (!Array.isArray(raekker) || raekker.length === 0) throw new Error("feltkatalog: tomt");
      const k: Katalog = { raekker: raekker.map(normaliser), version: Number(ver?.version ?? 1), hentet: Date.now() };
      cache = k;
      return k;
    })().finally(() => { igang = null; });
  }
  return await igang;
}

/** Bygger et katalog uden DB (prøver/mock). */
export function lavKatalog(raekker: Partial<KatalogRaekke>[], version = 1): Katalog {
  return { raekker: raekker.map(normaliser), version, hentet: Date.now() };
}

function normaliser(r: any): KatalogRaekke {
  return {
    kilde: String(r.kilde ?? "adversus"), endpoint: String(r.endpoint ?? ""), felt_sti: String(r.felt_sti ?? ""),
    kampagne_ekstern_id: r.kampagne_ekstern_id == null ? null : String(r.kampagne_ekstern_id),
    adversus_felt_id: r.adversus_felt_id == null ? null : Number(r.adversus_felt_id),
    maal_tabel: r.maal_tabel ?? null, maal_kolonne: r.maal_kolonne ?? null, metadata_noegle: r.metadata_noegle ?? null,
    hentes: r.hentes !== false, status: String(r.status ?? "aktiv"),
    afledt_af: Array.isArray(r.afledt_af) ? r.afledt_af.map(String) : [], klassifikation: String(r.klassifikation ?? "ukendt"),
  };
}

export function harKilde(kat: Katalog, kilde: string): boolean {
  return kat.raekker.some((r) => r.kilde === kilde && r.status !== "forslag");
}

/** Et felt skrives, når det selv er hentes + aktiv, og alle afhængigheder (samme kilde/endpoint) er det. */
export function erAktiv(kat: Katalog, r: KatalogRaekke): boolean {
  if (!r.hentes || r.status !== "aktiv") return false;
  for (const dep of r.afledt_af) {
    const d = kat.raekker.find((x) => x.kilde === r.kilde && x.endpoint === r.endpoint && x.felt_sti === dep && (x.kampagne_ekstern_id ?? null) === (r.kampagne_ekstern_id ?? null));
    if (d && !(d.hentes && d.status === "aktiv")) return false;
  }
  return true;
}

/** Metadata-nøgler, der må skrives i måltabellen for kilden (forening over endpoints; valgfrit afgrænset til én kampagne + kampagneløse rækker). */
export function tilladteNoegler(kat: Katalog, maalTabel: string, kilde: string, kampagne?: string | null): Set<string> {
  const s = new Set<string>();
  for (const r of kat.raekker) {
    if (r.kilde !== kilde || r.maal_tabel !== maalTabel || !r.metadata_noegle) continue;
    if (kampagne !== undefined && r.kampagne_ekstern_id != null && r.kampagne_ekstern_id !== kampagne) continue;
    if (erAktiv(kat, r)) s.add(r.metadata_noegle);
  }
  return s;
}

/** Kolonner, kataloget kender for tabellen (uanset hentes) og dem, der må skrives. */
export function kolonner(kat: Katalog, maalTabel: string, kilde: string): { kendte: Set<string>; tilladte: Set<string> } {
  const kendte = new Set<string>(), tilladte = new Set<string>();
  for (const r of kat.raekker) {
    if (r.kilde !== kilde || r.maal_tabel !== maalTabel || !r.maal_kolonne) continue;
    kendte.add(r.maal_kolonne);
    if (erAktiv(kat, r)) tilladte.add(r.maal_kolonne);
  }
  return { kendte, tilladte };
}

export interface AnvendResultat<T> { raekke: T; kasserede_noegler: string[]; nullede_kolonner: string[]; kerne_ignoreret: string[] }

/** Anvender kataloget på én række før skrivning: filtrerer metadata-jsonb, nuller fravalgte kolonner, stempler katalog_version. */
export function anvendKatalog<T extends Record<string, unknown>>(kat: Katalog, maalTabel: string, kilde: string, raekke: T, opts: { metadataFelt?: string; kampagne?: string | null } = {}): AnvendResultat<T> {
  const metadataFelt = opts.metadataFelt ?? "metadata";
  const kerne = KERNEKOLONNER[maalTabel] ?? new Set<string>();
  const { kendte, tilladte } = kolonner(kat, maalTabel, kilde);
  const noegler = tilladteNoegler(kat, maalTabel, kilde, opts.kampagne);
  const ud: Record<string, unknown> = { ...raekke };
  const kasserede: string[] = [], nullede: string[] = [], kerneIgn: string[] = [];
  for (const k of Object.keys(ud)) {
    if (k === metadataFelt) continue;
    if (!kendte.has(k) || tilladte.has(k)) continue;  // ukendt for kataloget (fx agent_id, updated_at) eller tilladt → urørt
    if (kerne.has(k)) { kerneIgn.push(k); continue; }
    ud[k] = null; nullede.push(k);
  }
  const md = ud[metadataFelt];
  if (md && typeof md === "object" && !Array.isArray(md)) {
    const ren: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(md as Record<string, unknown>)) {
      if (v === undefined) continue;
      if (noegler.has(k)) ren[k] = v; else kasserede.push(k);
    }
    ud[metadataFelt] = Object.keys(ren).length > 0 ? ren : null;
  } else if (md !== undefined) {
    ud[metadataFelt] = null;
  }
  ud.katalog_version = kat.version;
  return { raekke: ud as T, kasserede_noegler: kasserede, nullede_kolonner: nullede, kerne_ignoreret: kerneIgn };
}

/** Kampagnefelter (emner): finder de felt-id'er, kataloget endnu ikke kender for kampagnen, og opretter dem (hentes = ja, klassifikation ukendt – klassificeres i UI).
 *  `art` m = masterData, r = resultData. Navn/type fra /campaign-fields eller feltets egne name/label/type, ellers »Kampagnefelt <id>«. Idempotent (dubletter ignoreres). */
export async function sikrKampagnefelter(svc: any, kat: Katalog, kampagne: string, felter: { art: "m" | "r"; id: number; navn?: string; type?: string }[]): Promise<number> {
  const nye: Record<string, unknown>[] = [];
  const set = new Set<string>();
  for (const f of felter) {
    if (!Number.isFinite(f.id)) continue;
    const sti = `${f.art === "m" ? "masterData" : "resultData"}.${f.id}`;
    const noegle = `${f.art}:${f.id}`;
    if (set.has(noegle)) continue;
    set.add(noegle);
    const findes = kat.raekker.some((r) => r.kilde === "adversus" && r.endpoint === "/leads" && r.felt_sti === sti && r.kampagne_ekstern_id === kampagne);
    if (findes) continue;
    nye.push({
      kilde: "adversus", endpoint: "/leads", felt_sti: sti, kampagne_ekstern_id: kampagne, adversus_felt_id: f.id,
      felt_navn: f.navn?.trim() || (f.art === "m" ? `Kampagnefelt ${f.id}` : `Resultatfelt ${f.id}`), datatype: f.type?.trim() || "string",
      beskrivelse: "Oprettet automatisk af hentningen (F1b-2) – klassificeres i UI", maal_tabel: "dialer_leads", metadata_noegle: noegle,
      hentes: true, klassifikation: "ukendt", status: "aktiv", version: kat.version,
    });
  }
  if (nye.length === 0) return 0;
  let oprettet = 0;
  for (const r of nye) {
    const { error } = await svc.from("kald_felt_katalog").insert(r);
    if (error && error.code !== "23505") throw new Error(`feltkatalog: kunne ikke oprette ${r.felt_sti} for kampagne ${kampagne}: ${error.message ?? error}`);
    if (!error) oprettet++;
    kat.raekker.push(normaliser(r));  // kendt for resten af kørslen (også ved dublet: rækken findes i DB)
  }
  return oprettet;
}
