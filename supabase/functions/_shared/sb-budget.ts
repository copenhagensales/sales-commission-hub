// Fælles tidsbudget for S6-edges (sb-fil, storkbook-tjek, beskeder-oprydning).
// Ændrer ALDRIG globalThis.fetch; den kaldes dovent ved hvert kald, så prøver kan mocke den.
// Hvert kald får min(maksMs, slut()-nu) ved kaldets start; timeren gælder også læsning af svarbody.

export class BudgetStop extends DOMException {
  constructor() { super("budget", "TimeoutError"); }
}

export const erBudgetStop = (e: unknown): boolean => e instanceof BudgetStop;

/** Resterende ms til en absolut frist (aldrig negativ). */
export const rest = (slut: number): number => Math.max(0, slut - Date.now());

/**
 * Fetch med budget. Bevarer alle requestparametre/headers, kombinerer Request-/init-signaler med
 * budgettimeren (overskriver ikke en eksisterende afbrydelse) og holder timeren aktiv, indtil
 * svarbody er læst færdig, annulleret eller fejlet. ms <= 0 → ingen netværksoperation (BudgetStop).
 */
export function budgetFetch(slut: () => number, maksMs: number): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const ms = Math.min(maksMs, slut() - Date.now());
    if (!(ms > 0)) throw new BudgetStop();
    const ctl = new AbortController();
    const signaler: AbortSignal[] = [ctl.signal];
    if (input instanceof Request) signaler.push(input.signal);
    if (init?.signal) signaler.push(init.signal);
    const timer = setTimeout(() => ctl.abort(new DOMException("timeout", "TimeoutError")), ms);
    let ryddet = false;
    const ryd = () => { if (!ryddet) { ryddet = true; clearTimeout(timer); } };
    let res: Response;
    try {
      res = await globalThis.fetch(input, { ...init, signal: AbortSignal.any(signaler) });
    } catch (e) { ryd(); throw e; }
    if (!res.body) { ryd(); return res; }
    const reader = res.body.getReader();
    const krop = new ReadableStream<Uint8Array>({
      async pull(c) {
        try {
          const r = await reader.read();
          if (r.done) { ryd(); c.close(); } else c.enqueue(r.value);
        } catch (e) { ryd(); c.error(e); }
      },
      async cancel(g) { ryd(); ctl.abort(); await reader.cancel(g).catch(() => {}); },
    });
    return new Response(krop, { status: res.status, statusText: res.statusText, headers: res.headers });
  };
}

/** createClient-indstillinger: budgetfetch og ingen automatiske PostgREST-genforsøg (supabase-js 2.118.0: db.retry). */
export const budgetIndstillinger = (slut: () => number, maksMs: number, ekstra: { headers?: Record<string, string> } = {}) => ({
  global: { fetch: budgetFetch(slut, maksMs), ...(ekstra.headers ? { headers: ekstra.headers } : {}) },
  db: { retry: false },
  auth: { persistSession: false, autoRefreshToken: false },
});

export type LaesUdfald =
  | { ok: true; bytes: Uint8Array<ArrayBuffer> }
  | { ok: false; grund: "for_stor" | "frist" | "fejl" };

/**
 * Begrænset læser: tæller bytes FØR de beholdes, annullerer readeren ved overskridelse, frist eller fejl
 * og returnerer aldrig en delvis fil. EOF kræves for ok.
 */
export async function laesBegraenset(body: ReadableStream<Uint8Array> | null, maks: number, slut: number): Promise<LaesUdfald> {
  if (!body) return { ok: true, bytes: new Uint8Array(0) };
  const reader = body.getReader();
  const annuller = () => reader.cancel().catch(() => {});
  const dele: Uint8Array[] = [];
  let n = 0;
  try {
    while (true) {
      const ms = slut - Date.now();
      if (ms <= 0) { await annuller(); return { ok: false, grund: "frist" }; }
      let t: number | undefined;
      const frist = new Promise<"frist">((r) => { t = setTimeout(() => r("frist"), ms); });
      const r = await Promise.race([reader.read(), frist]).finally(() => clearTimeout(t));
      if (r === "frist") { await annuller(); return { ok: false, grund: "frist" }; }
      if (r.done) break;
      n += r.value.byteLength;
      if (n > maks) { await annuller(); return { ok: false, grund: "for_stor" }; }
      dele.push(r.value);
    }
  } catch {
    await annuller();
    return { ok: false, grund: "fejl" };
  }
  const ud = new Uint8Array(n);
  let o = 0;
  for (const d of dele) { ud.set(d, o); o += d.byteLength; }
  return { ok: true, bytes: ud };
}
