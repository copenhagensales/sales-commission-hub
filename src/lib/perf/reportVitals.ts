/** Rapporterer LCP, INP og CLS med console.debug under nøglen "stork-vitals" (ingen lagring endnu). */
export function reportWebVitals(): void {
  if (typeof window === "undefined") return;
  void import("web-vitals").then(({ onLCP, onINP, onCLS }) => {
    const log = (m: { name: string; value: number; rating: string }) =>
      console.debug("stork-vitals", { name: m.name, value: Math.round(m.name === "CLS" ? m.value * 1000 : m.value) / (m.name === "CLS" ? 1000 : 1), rating: m.rating, path: window.location.pathname });
    onLCP(log);
    onINP(log);
    onCLS(log);
  }).catch(() => undefined);
}
