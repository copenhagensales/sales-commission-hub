// 24d2-design-v4 §11: driftsstatus for Beskeder (pause, filport, modelport). Ingen localStorage.
// Manglende/fejlende RPC eller ugyldigt svar = ukendt status → fil-/modelvej lukket. En kendt pause ophæves kun
// af en gyldig statuslæsning, der er startet efter pausebeviset. Gamle sessionssvar ignoreres.
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import { sessionsGeneration } from "@/lib/sbKladder";

export interface SbDriftRaekke { beskeder_pause: boolean; fil_tilladt: boolean; tjek_tilladt: boolean }
export type SbDriftStatus = "kendt" | "ukendt";
interface Laesning { raekke: SbDriftRaekke | null; start: number }

// Lokal type ved Supabase-grænsen: RPC'en findes endnu ikke i de genererede typer (types.ts røres ikke).
type DriftRpc = (fn: "sb_24d2_drift") => PromiseLike<{ data: unknown; error: unknown }>;
const kaldDrift = (): PromiseLike<{ data: unknown; error: unknown }> =>
  (supabase.rpc.bind(supabase) as unknown as DriftRpc)("sb_24d2_drift");

const erBool = (x: unknown): x is boolean => typeof x === "boolean";
/** Kendt svar kræver præcis én række med tre booleans. */
export function tolkDrift(data: unknown): SbDriftRaekke | null {
  if (!Array.isArray(data) || data.length !== 1) return null;
  const r: unknown = data[0];
  if (typeof r !== "object" || r === null) return null;
  const p = Reflect.get(r, "beskeder_pause"), f = Reflect.get(r, "fil_tilladt"), t = Reflect.get(r, "tjek_tilladt");
  if (!erBool(p) || !erBool(f) || !erBool(t)) return null;
  return { beskeder_pause: p, fil_tilladt: f, tjek_tilladt: t };
}

// ---------- Delt tilstand (pr. QueryClient og session) ----------
let sekvens = 0;
interface PauseTilstand { pause: boolean; bevis: number }
const pauser = new WeakMap<QueryClient, Map<string, PauseTilstand>>();
const lyttere = new Set<() => void>();
const meld = () => { for (const l of lyttere) l(); };
const sk = (bruger: string, gen: number) => `${bruger}:${gen}`;
function pauseMap(qc: QueryClient): Map<string, PauseTilstand> {
  let m = pauser.get(qc);
  if (!m) { m = new Map(); pauser.set(qc, m); }
  return m;
}
export const erPauseKendt = (qc: QueryClient, bruger: string, gen: number) => pauseMap(qc).get(sk(bruger, gen))?.pause === true;

/** Modelport for startTjekHvisNoedvendigt: kun kendt tjek_tilladt=true for (bruger, generation) åbner. */
const modelPorte = new Map<string, boolean>();
export function tjekPortAaben(bruger: string | null | undefined, gen: number): boolean {
  return !!bruger && gen === sessionsGeneration() && modelPorte.get(sk(bruger, gen)) === true;
}

export const driftNoegle = (bruger: string | null, gen: number) => ["sb-24d2-drift", bruger, gen] as const;

/**
 * Pausebevis (RPC eller præcis P0001/SB24D2_PAUSE). Deles i QueryClienten for sessionen og genhenter drift.
 * Ignoreres for en forældet session.
 */
export function registrerPause(qc: QueryClient, bruger: string, gen: number): void {
  if (gen !== sessionsGeneration()) return;
  pauseMap(qc).set(sk(bruger, gen), { pause: true, bevis: ++sekvens });
  meld();
  void qc.invalidateQueries({ queryKey: driftNoegle(bruger, gen) });
}

function anvendLaesning(qc: QueryClient, bruger: string, gen: number, l: Laesning): void {
  if (gen !== sessionsGeneration()) return; // gammelt sessionssvar
  const k = sk(bruger, gen);
  modelPorte.set(k, l.raekke?.tjek_tilladt === true);
  const m = pauseMap(qc); const nu = m.get(k);
  if (l.raekke?.beskeder_pause) m.set(k, { pause: true, bevis: Math.max(nu?.bevis ?? 0, l.start) });
  else if (l.raekke && nu?.pause && l.start > nu.bevis) m.set(k, { pause: false, bevis: nu.bevis });
  meld();
}

export interface SbDrift {
  status: SbDriftStatus; beskederPause: boolean; filTilladt: boolean; tjekTilladt: boolean; refetch: () => void;
}

export function useSbDrift(enabled: boolean, bruger: string | null | undefined, samtaleId?: string | null): SbDrift {
  const qc = useQueryClient();
  const gen = sessionsGeneration();
  const b = bruger ?? null;
  const aktiv = enabled && !!b;
  const q = useQuery({
    queryKey: driftNoegle(b, gen),
    enabled: aktiv,
    retry: 0,
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    queryFn: async (): Promise<Laesning> => {
      const start = ++sekvens;
      let raekke: SbDriftRaekke | null = null;
      try { const { data, error } = await kaldDrift(); raekke = error ? null : tolkDrift(data); } catch { raekke = null; }
      const l = { raekke, start };
      if (b) anvendLaesning(qc, b, gen, l);
      return l;
    },
  });
  const pause = useSyncExternalStore(
    (l) => { lyttere.add(l); return () => { lyttere.delete(l); }; },
    () => (b ? erPauseKendt(qc, b, gen) : false),
  );
  const { refetch: rq } = q;
  // Samtidige hændelser samles: en igangværende hentning genbruges (cancelRefetch:false).
  const refetch = useCallback(() => { if (aktiv) void rq({ cancelRefetch: false }); }, [aktiv, rq]);
  const foerste = useRef(true);
  useEffect(() => {
    if (foerste.current) { foerste.current = false; return; }
    refetch();
  }, [samtaleId, refetch]);
  const raekke = q.data && gen === sessionsGeneration() ? q.data.raekke : null;
  const kendt = aktiv && !!raekke;
  return {
    status: kendt ? "kendt" : "ukendt",
    beskederPause: pause || (kendt && raekke!.beskeder_pause),
    filTilladt: kendt && raekke!.fil_tilladt,
    tjekTilladt: kendt && raekke!.tjek_tilladt,
    refetch,
  };
}
