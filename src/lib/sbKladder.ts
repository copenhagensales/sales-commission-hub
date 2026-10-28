// Uafsendte chatkladder pr. bruger og samtale (kun tekst og svarreference-id – aldrig svartekst,
// filer eller AI-resultater). sessionStorage; ryddes ved send, sletning og logud.
import { supabase } from "@/integrations/supabase/client";

const PREFIX = "sb-kladde:";
export interface Kladde { tekst: string; svarId: string | null }

const noegle = (emp: string, conv: string) => `${PREFIX}${emp}:${conv}`;

function lager(): Storage | null {
  try { return typeof window !== "undefined" ? window.sessionStorage : null; } catch { return null; }
}

export function laesKladde(emp: string, conv: string): Kladde | null {
  const s = lager()?.getItem(noegle(emp, conv));
  if (!s) return null;
  try {
    const o = JSON.parse(s);
    if (typeof o?.tekst !== "string") return null;
    return { tekst: o.tekst, svarId: typeof o.svarId === "string" ? o.svarId : null };
  } catch { return null; }
}

export function gemKladde(emp: string, conv: string, k: Kladde): void {
  const l = lager();
  if (!l) return;
  if (!k.tekst && !k.svarId) { l.removeItem(noegle(emp, conv)); return; }
  try { l.setItem(noegle(emp, conv), JSON.stringify({ tekst: k.tekst.slice(0, 4000), svarId: k.svarId })); } catch { /* fuldt lager */ }
}

export function sletKladde(emp: string, conv: string): void {
  lager()?.removeItem(noegle(emp, conv));
}

export function rydAlleKladder(): void {
  const l = lager();
  if (!l) return;
  for (let i = l.length - 1; i >= 0; i--) { const k = l.key(i); if (k?.startsWith(PREFIX)) l.removeItem(k); }
}

let registreret = false;
/** Rydder alle kladder ved logud (registreres én gang). */
export function registrerKladdeOprydning(): void {
  if (registreret) return;
  registreret = true;
  supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_OUT") rydAlleKladder(); });
}
