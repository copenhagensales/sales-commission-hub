// Uafsendte chatkladder pr. bruger og samtale (S6/B2a §1). sessionStorage, nøglerummet "sb-kladde:".
// Gemmes ALDRIG: File/Blob-bytes, blob-URL, uploadtoken, JWT, svartekst, leverede beskeders indhold
// eller AI-resultater. File-objekter holdes kun i hukommelsen (bruger-/samtale-/afsendelsesafgrænset).
import { supabase } from "@/integrations/supabase/client";

const PREFIX = "sb-kladde:";

/** Filmetadata. `trin` skelner udstedt sti, igangværende og bekræftet upload. */
export interface FilMeta {
  name: string;
  type: string;
  size: number;
  sti: string | null;
  trin: "valgt" | "udstedt" | "uploader" | "uploadet";
}

export interface Kladde { tekst: string; svarId: string | null; fil?: FilMeta | null; retId?: string | null }

export type AfsendelsesTilstand = "sender" | "afstemmer" | "afvist" | "genudsted" | "vaelg_fil" | "gemt_vaek";

export interface Afsendelse {
  id: string;
  tekst: string;
  svarId: string | null;
  fil: FilMeta | null;
  tilstand: AfsendelsesTilstand;
  /** Serverens P0001-tekst (ordret) ved kendt afvisning. */
  fejl: string | null;
  /** Mindst ét tidligere forsøg havde ukendt udfald. */
  tidligereUkendt: boolean;
  oprettet: number;
}

export interface RetKladde { beskedId: string; tekst: string; revision: number }

const noegle = (emp: string, conv: string) => `${PREFIX}${emp}:${conv}`;
const afsNoegle = (emp: string, conv: string) => `${PREFIX}${emp}:${conv}:afs`;
const retNoegle = (emp: string, conv: string, msg: string) => `${PREFIX}${emp}:${conv}:ret:${msg}`;

function lager(): Storage | null {
  try { return typeof window !== "undefined" ? window.sessionStorage : null; } catch { return null; }
}

// §6: autoritativt hukommelseslager pr. nøgle i den levende session. Ny tilstand skrives først her, derefter
// forsøges sessionStorage. En kendt hukommelsesværdi (også en eksplicit slettet = null) har forrang for lageret.
// Overlever ikke rigtig reload.
const hukommelse = new Map<string, string | null>();
const noegleFejl = new Set<string>();
let ignorerLager = false; // rydning kunne ikke gennemføres → lageret læses ikke i denne generation

/** true = gemt (eller fjernet); false = lagringsfejl (værdien findes kun i hukommelsen). */
function skriv(k: string, v: unknown | null): boolean {
  hukommelse.set(k, v === null ? null : JSON.stringify(v));
  const l = lager();
  let ok = false;
  if (l) {
    try {
      if (v === null) l.removeItem(k); else l.setItem(k, JSON.stringify(v));
      ok = true;
    } catch { ok = false; }
  }
  // En fejlet sletning lader ikke en fejlstatus hænge på en ryddet kladde; tombstone forhindrer genoplivning.
  if (ok || v === null) noegleFejl.delete(k); else noegleFejl.add(k);
  return ok;
}
function laes(k: string): unknown {
  try {
    const s = hukommelse.has(k) ? hukommelse.get(k) : ignorerLager ? null : lager()?.getItem(k);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

const TRIN = new Set(["valgt", "udstedt", "uploader", "uploadet"]);
function filMeta(o: unknown): FilMeta | null {
  const f = o as Partial<FilMeta> | null;
  if (!f || typeof f.name !== "string" || typeof f.type !== "string" || typeof f.size !== "number") return null;
  return { name: f.name.slice(0, 200), type: f.type, size: f.size, sti: typeof f.sti === "string" ? f.sti : null, trin: TRIN.has(f.trin as string) ? f.trin as FilMeta["trin"] : "valgt" };
}

// ---------- Skrivekladde ----------

export function laesKladde(emp: string, conv: string): Kladde | null {
  const o = laes(noegle(emp, conv)) as Partial<Kladde> | null;
  if (!o || typeof o.tekst !== "string") return null;
  return { tekst: o.tekst, svarId: typeof o.svarId === "string" ? o.svarId : null, fil: filMeta(o.fil), retId: typeof o.retId === "string" ? o.retId : null };
}

export function gemKladde(emp: string, conv: string, k: Kladde): boolean {
  if (!k.tekst && !k.svarId && !k.fil && !k.retId) return skriv(noegle(emp, conv), null);
  return skriv(noegle(emp, conv), { tekst: k.tekst.slice(0, 4000), svarId: k.svarId, fil: k.fil ?? null, retId: k.retId ?? null });
}

export function sletKladde(emp: string, conv: string): void { skriv(noegle(emp, conv), null); }

// ---------- Redigeringskladder ----------

export function laesRetKladde(emp: string, conv: string, msg: string): RetKladde | null {
  const o = laes(retNoegle(emp, conv, msg)) as Partial<RetKladde> | null;
  if (!o || typeof o.tekst !== "string" || typeof o.revision !== "number" || o.beskedId !== msg) return null;
  return { beskedId: msg, tekst: o.tekst, revision: o.revision };
}
export function gemRetKladde(emp: string, conv: string, k: RetKladde): boolean {
  return skriv(retNoegle(emp, conv, k.beskedId), { beskedId: k.beskedId, tekst: k.tekst.slice(0, 4000), revision: k.revision });
}
export function sletRetKladde(emp: string, conv: string, msg: string): void { skriv(retNoegle(emp, conv, msg), null); }

/** Fejlstatus følger den berørte kladde (bevares over navigation, ryddes ved næste vellykkede skrivning). */
export const harKladdeLagerFejl = (emp: string, conv: string) => noegleFejl.has(noegle(emp, conv));
export const harRetLagerFejl = (emp: string, conv: string, msg: string) => noegleFejl.has(retNoegle(emp, conv, msg));

// ---------- Afsendelser (hukommelse + sessionStorage) ----------

type Lytter = () => void;
const lyttere = new Set<Lytter>();
const afsendelser = new Map<string, Afsendelse[]>();
const lagringsFejl = new Set<string>();
const filer = new Map<string, File>();
const TOM: Afsendelse[] = [];
let generation = 0;

const nk = (emp: string, conv: string) => `${emp}:${conv}`;
const fk = (emp: string, conv: string, id: string) => `${emp}:${conv}:${id}`;
const meld = () => { for (const l of lyttere) l(); };

/** Sessionsgeneration; øges ved logud/brugerskift, så gamle forløb ikke skriver videre. */
export const sessionsGeneration = () => generation;

/** §1: Operationens ejer, fastholdt synkront ved brugerhandlingens start (før første await). */
export interface OperationsEjer { emp: string; conv: string; gen: number }
export const fastholdEjer = (emp: string, conv: string): OperationsEjer => ({ emp, conv, gen: generation });
/** Ejerskab gælder stadig: samme sessionsgeneration (samtaleskift/afmontering ændrer ikke ejeren). */
export const ejerGyldig = (e: OperationsEjer | null | undefined) => !!e && e.gen === generation;

function laesAfsendelser(emp: string, conv: string): Afsendelse[] {
  const o = laes(afsNoegle(emp, conv));
  if (!Array.isArray(o)) return [];
  const ud: Afsendelse[] = [];
  for (const r of o as Partial<Afsendelse>[]) {
    if (!r || typeof r.id !== "string" || typeof r.tekst !== "string") continue;
    ud.push({
      id: r.id, tekst: r.tekst, svarId: typeof r.svarId === "string" ? r.svarId : null, fil: filMeta(r.fil),
      tilstand: (["sender", "afstemmer", "afvist", "genudsted", "vaelg_fil", "gemt_vaek"] as const).includes(r.tilstand as AfsendelsesTilstand) ? r.tilstand as AfsendelsesTilstand : "afstemmer",
      fejl: typeof r.fejl === "string" ? r.fejl : null, tidligereUkendt: !!r.tidligereUkendt,
      oprettet: typeof r.oprettet === "number" ? r.oprettet : 0,
    });
  }
  return ud;
}

/** Aktuelle afsendelser for (bruger, samtale). Stabil reference mellem ændringer. */
export function hentAfsendelser(emp: string, conv: string): Afsendelse[] {
  const k = nk(emp, conv);
  let l = afsendelser.get(k);
  if (!l) {
    // Efter reload: et forsøg, der var i gang, har ukendt udfald → afstemmes (genindsendes ikke automatisk).
    l = laesAfsendelser(emp, conv).map((a) => (a.tilstand === "sender" ? { ...a, tilstand: "afstemmer" as const, tidligereUkendt: true } : a));
    afsendelser.set(k, l.length ? l : TOM);
  }
  return afsendelser.get(k) ?? TOM;
}

function saet(emp: string, conv: string, l: Afsendelse[]): void {
  const k = nk(emp, conv);
  afsendelser.set(k, l.length ? l : TOM);
  if (skriv(afsNoegle(emp, conv), l.length ? l : null)) lagringsFejl.delete(k); else lagringsFejl.add(k);
  meld();
}

/** Synkron registrering før første sideeffekt. */
export function tilfoejAfsendelse(emp: string, conv: string, a: Afsendelse, fil?: File | null): void {
  if (fil) filer.set(fk(emp, conv, a.id), fil);
  saet(emp, conv, [...hentAfsendelser(emp, conv).filter((x) => x.id !== a.id), a]);
}

/** Opdaterer kun posten med dette id; ingen effekt, hvis den er væk eller generationen er skiftet. */
export function opdaterAfsendelse(emp: string, conv: string, id: string, ret: Partial<Afsendelse>, gen = generation): void {
  if (gen !== generation) return;
  const l = hentAfsendelser(emp, conv);
  if (!l.some((x) => x.id === id)) return;
  saet(emp, conv, l.map((x) => (x.id === id ? { ...x, ...ret, id } : x)));
}

/** Sletter kun den bekræftede post (og dens File). */
export function fjernAfsendelse(emp: string, conv: string, id: string, gen = generation): void {
  if (gen !== generation) return;
  filer.delete(fk(emp, conv, id));
  const l = hentAfsendelser(emp, conv);
  if (!l.some((x) => x.id === id)) return;
  saet(emp, conv, l.filter((x) => x.id !== id));
}

export const afsendelsesFil = (emp: string, conv: string, id: string) => filer.get(fk(emp, conv, id)) ?? null;
export function saetAfsendelsesFil(emp: string, conv: string, id: string, f: File | null): void {
  if (f) filer.set(fk(emp, conv, id), f); else filer.delete(fk(emp, conv, id));
  meld();
}

/** Skrivekladdens valgte File (overlever navigation/afmontering, ikke reload). */
export const kladdeFil = (emp: string, conv: string) => filer.get(fk(emp, conv, "_kladde")) ?? null;
export function saetKladdeFil(emp: string, conv: string, f: File | null): void {
  if (f) filer.set(fk(emp, conv, "_kladde"), f); else filer.delete(fk(emp, conv, "_kladde"));
}

export const harLagringsFejl = (emp: string, conv: string) => lagringsFejl.has(nk(emp, conv));

export function abonnerAfsendelser(l: Lytter): () => void { lyttere.add(l); return () => { lyttere.delete(l); }; }

export function rydAlleKladder(): void {
  generation++;
  afsendelser.clear();
  filer.clear();
  lagringsFejl.clear();
  hukommelse.clear();
  noegleFejl.clear();
  ignorerLager = false;
  const l = lager();
  if (l) {
    try {
      for (let i = l.length - 1; i >= 0; i--) {
        const k = l.key(i);
        if (!k?.startsWith(PREFIX)) continue;
        // Fejlet sletning → tombstone, så ryddede værdier ikke genindlæses i den nye generation.
        try { l.removeItem(k); } catch { hukommelse.set(k, null); }
      }
    } catch { ignorerLager = true; }
  }
  meld();
}

let registreret = false;
let sidsteBruger: string | null | undefined;
/** Rydder alle kladder ved logud og brugerskift (registreres én gang). */
export function registrerKladdeOprydning(): void {
  if (registreret) return;
  registreret = true;
  supabase.auth.onAuthStateChange((e, s) => {
    const bruger = s?.user?.id ?? null;
    if (e === "SIGNED_OUT" || (sidsteBruger && bruger && bruger !== sidsteBruger)) rydAlleKladder();
    if (bruger) sidsteBruger = bruger;
  });
}
