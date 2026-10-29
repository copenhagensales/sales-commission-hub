// Klient til edge-funktionen sb-fil (S6/24d): udstedelse af upload-token, signeret upload og autentificeret
// streaming af vedhæftninger. Ingen Storage-læse-URL, ingen direkte storage.upload, ingen getPublicUrl.
import { supabase } from "@/integrations/supabase/client";

export const SB_FIL_TYPER: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", txt: "text/plain",
};
const TILLADTE = new Set(Object.values(SB_FIL_TYPER));
export const MAKS_FIL = 10 * 1024 * 1024;
export const MAKS_TEKSTFIL = 20 * 1024;
/** Automatiske billedpreviews over denne størrelse hentes først ved bevidst tryk (mobilstandard). */
export const MAKS_AUTO_PREVIEW = 200 * 1024;
export const FIL_GRAENSER_TEKST = "Billeder (JPEG, PNG, WebP, GIF) op til 10 MB og tekstfiler op til 20 KB. PDF understøttes ikke endnu.";
export const FIL_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.txt,image/jpeg,image/png,image/webp,image/gif,text/plain";

export type FilValg = { ok: true; type: string } | { ok: false; fejl: string };

/** Lokal validering før upload; serveren validerer igen. */
export function validerFil(f: { name: string; type: string; size: number }): FilValg {
  const ext = (/\.([a-z0-9]{1,5})$/i.exec(f.name)?.[1] ?? "").toLowerCase();
  if (ext === "pdf" || f.type === "application/pdf") return { ok: false, fejl: "PDF understøttes ikke endnu" };
  const type = SB_FIL_TYPER[ext];
  if (!type || (f.type && f.type !== type)) return { ok: false, fejl: "Filtypen understøttes ikke. Brug JPEG, PNG, WebP, GIF eller en tekstfil." };
  if (f.size < 1) return { ok: false, fejl: "Filen er tom" };
  if (type === "text/plain" && f.size > MAKS_TEKSTFIL) return { ok: false, fejl: "Tekstfiler må højst fylde 20 KB, så hele filen kan tjekkes." };
  if (f.size > MAKS_FIL) return { ok: false, fejl: "Filen er for stor (højst 10 MB)." };
  return { ok: true, type };
}

export class SbFilFejl extends Error {
  constructor(public status: number, public kode: string, public retryAfter: number | null = null) {
    super(kode);
    this.name = "SbFilFejl";
  }
}

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sb-fil`;

/** §1: kaldes efter asynkrone opslag og umiddelbart før næste netværkstrin; false = operationen er forældet. */
export type Vagt = () => boolean;
/** Operationen tilhører ikke længere den aktive session (logud/brugerskift); intet netværkskald er sendt. */
export const erForaeldetOperation = (e: unknown) => e instanceof SbFilFejl && e.kode === "foraeldet";
/** §3 (c1): operationens kontekst til udstedelse/upload: vagt + auth-bruger, sessionen skal tilhøre. */
export interface SbKontekst { vagt: Vagt; bruger: string }
const tjekVagt = (vagt?: Vagt) => { if (vagt && !vagt()) throw new SbFilFejl(0, "foraeldet"); };

async function hoveder(vagt?: Vagt, bruger?: string): Promise<Record<string, string>> {
  tjekVagt(vagt);
  const { data } = await supabase.auth.getSession();
  tjekVagt(vagt);
  // Sessionen skal tilhøre operationens auth-bruger; ellers er operationen forældet (intet netværkskald).
  if (bruger !== undefined && data.session?.user?.id !== bruger) throw new SbFilFejl(0, "foraeldet");
  const t = data.session?.access_token;
  if (!t) throw new SbFilFejl(401, "jwt");
  return { Authorization: `Bearer ${t}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
}

async function fejlFra(res: Response): Promise<SbFilFejl> {
  let kode = "fejl";
  try { const b = await res.json(); if (b && typeof b.kode === "string") kode = b.kode; } catch { /* fast kode */ }
  const ra = Number(res.headers.get("Retry-After"));
  return new SbFilFejl(res.status, kode, Number.isFinite(ra) && ra > 0 ? ra : null);
}

export interface Udstedt { sti: string; token: string; conversationId: string }

export async function udstedUpload(conversationId: string, file: { name: string; size: number }, type: string, k: SbKontekst): Promise<Udstedt> {
  const h = await hoveder(k.vagt, k.bruger);
  // Sidste await-hul: kontrollér umiddelbart før POST.
  tjekVagt(k.vagt);
  let res: Response;
  try {
    res = await fetch(BASE, {
      method: "POST",
      headers: { ...h, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "udsted", conversation_id: conversationId, filnavn: file.name.slice(0, 200), type, size: file.size }),
    });
  } catch { throw new SbFilFejl(0, "net"); }
  if (!res.ok) throw await fejlFra(res);
  const b = await res.json().catch(() => null);
  tjekVagt(k.vagt);
  if (!b || typeof b.sti !== "string" || typeof b.token !== "string") throw new SbFilFejl(500, "svar");
  return { sti: b.sti, token: b.token, conversationId };
}

export async function uploadTilSti(u: Udstedt, file: File, type: string, k: SbKontekst): Promise<void> {
  const vagt = k.vagt;
  tjekVagt(vagt);
  const { error } = await supabase.storage.from("chat-attachments").uploadToSignedUrl(u.sti, u.token, file, { contentType: type, upsert: false });
  if (error) throw new SbFilFejl(0, "upload");
  tjekVagt(vagt);
}

export function udstedFejlTekst(e: unknown): string {
  if (!(e instanceof SbFilFejl)) return "Filen kunne ikke uploades – prøv igen";
  if (e.kode === "pdf_udskudt") return "PDF understøttes ikke endnu";
  if (e.kode === "filtype") return "Filtypen understøttes ikke";
  if (e.kode === "stoerrelse") return "Filen er for stor (højst 10 MB)";
  if (e.status === 401) return "Log ind igen for at vedhæfte filer";
  if (e.status === 403) return "Du kan ikke vedhæfte filer i denne samtale";
  if (e.status === 429) return "For mange forsøg – prøv igen om lidt";
  if (e.status === 503 && e.kode === "vedligeholdelse") return "Filen kunne ikke sendes: filer er lukket lige nu";
  return "Filen kunne ikke uploades – prøv igen";
}

/** Højst 3 samtidige hentninger fra klienten. */
let aktive = 0;
const venter: (() => void)[] = [];
const afbrudt = () => new DOMException("Aborted", "AbortError");
/** B2c-2b-1 §6: kø med abort – en afbrudt køventer fjernes fra køen og starter aldrig; en vækket venter kontrollerer abort/vagt før arbejdet. */
async function medPlads<T>(fn: () => Promise<T>, signal?: AbortSignal, vagt?: Vagt): Promise<T> {
  if (signal?.aborted) throw afbrudt();
  tjekVagt(vagt);
  if (aktive >= 3) {
    await new Promise<void>((res, rej) => {
      const vaek = () => { signal?.removeEventListener("abort", af); res(); };
      const af = () => { const i = venter.indexOf(vaek); if (i >= 0) venter.splice(i, 1); rej(afbrudt()); };
      venter.push(vaek);
      signal?.addEventListener("abort", af, { once: true });
    });
  }
  aktive++;
  try {
    if (signal?.aborted) throw afbrudt();
    tjekVagt(vagt); // en gammel køventer må ikke starte GET under en ny session
    return await fn();
  } finally { aktive--; venter.shift()?.(); }
}
/** Til prøver: aktive pladser og køventere (ingen indhold). */
export const filHentningsKapacitet = () => ({ aktive, ventere: venter.length });

/**
 * Autentificeret hentning af en beskeds vedhæftning. Typen tvinges til allowlisten; aldrig farligere MIME.
 * B2c-2b-1 §6: med kontekst kontrolleres abort og vagt (bruger/generation/hentningsnummer) efter køventning,
 * sessions-/JWT-opslag (sessionen skal tilhøre konteksten), før GET, efter svar og efter bytes. En GET-fejl udsteder/uploader aldrig.
 */
export function hentFil(messageId: string, signal?: AbortSignal, k?: SbKontekst): Promise<Blob> {
  const vagt = k?.vagt;
  const tjek = () => { if (signal?.aborted) throw afbrudt(); tjekVagt(vagt); };
  return medPlads(async () => {
    const h = await hoveder(vagt, k?.bruger);
    tjek(); // sidste await-hul før transport
    let res: Response;
    try {
      res = await fetch(`${BASE}?action=laes&message_id=${encodeURIComponent(messageId)}`, { headers: h, signal, cache: "no-store" });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") throw e;
      throw new SbFilFejl(0, "net");
    }
    tjek();
    if (res.status !== 200 && res.status !== 206) throw await fejlFra(res);
    const type = (res.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
    if (!TILLADTE.has(type)) throw new SbFilFejl(410, "type");
    const buf = await res.arrayBuffer();
    tjek();
    return new Blob([buf], { type });
  }, signal, vagt);
}

export const erPermanentFilFejl = (e: unknown) => e instanceof SbFilFejl && [403, 404, 410].includes(e.status);

export function filFejlTekst(e: unknown): string {
  if (erPermanentFilFejl(e)) return "Filen er ikke længere tilgængelig";
  if (e instanceof SbFilFejl && e.status === 401) return "Log ind igen for at se filen";
  if (e instanceof SbFilFejl && e.status === 429) return "For mange hentninger – prøv igen om lidt";
  return "Filen kunne ikke hentes – prøv igen";
}
