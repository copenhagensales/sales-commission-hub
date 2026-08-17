/**
 * Robust forbindelsestjek.
 *
 * `navigator.onLine` er notorisk upålidelig: en række browsere, VPN-klienter og
 * virtuelle netværkskort rapporterer `false`, selvom maskinen har fuld adgang til
 * internettet. Vi brugte flaget tidligere som eneste kilde, hvilket kunne låse en
 * bruger ude med beskeden "Ingen internetforbindelse" uden reel årsag.
 *
 * Reglen nu: `navigator.onLine === false` er kun et *signal*. Vi erklærer først
 * brugeren offline, hvis et rigtigt netværkskald mod backend også fejler.
 */
const HEALTH_TIMEOUT_MS = 5000;

/** True hvis browseren *signalerer* offline (må ikke bruges alene til at blokere). */
export function browserReportsOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Kan vi faktisk nå backend? Verificeres med et rigtigt HTTP-kald. */
export async function canReachBackend(): Promise<boolean> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url) return false;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    const res = await fetch(`${url}/auth/v1/health`, {
      signal: controller.signal,
      cache: "no-store",
      headers: key ? { apikey: key } : undefined,
    });
    clearTimeout(timeout);
    // Alt der besvares af serveren beviser, at vi har forbindelse.
    return res.status < 500;
  } catch {
    return false;
  }
}

/**
 * Endelig afgørelse: er brugeren reelt offline?
 * Returnerer kun true hvis browseren signalerer offline OG backend ikke kan nås.
 */
export async function isReallyOffline(): Promise<boolean> {
  if (!browserReportsOffline()) return false;
  return !(await canReachBackend());
}
