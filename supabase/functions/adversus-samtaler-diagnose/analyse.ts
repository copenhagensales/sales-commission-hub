// Rene hjælpere til F0.1-diagnosen (plan v2.3 §5 F0.1). Ingen I/O.

export type KaldRaekke = { start?: unknown; end?: unknown };

/** Hvilket tidsfelt filtrerer Adversus' `timestamp`-filter på? Afgøres af, hvor stor en andel af de returnerede kald, der har start hhv. slut inden for vinduet. */
export function udledTimestampSemantik(rows: KaldRaekke[], fra: string, til: string): { semantik: "start" | "end" | "blandet" | "ukendt"; iVinduetStart: number; iVinduetEnd: number; antal: number } {
  const f = Date.parse(fra), t = Date.parse(til);
  let s = 0, e = 0, n = 0;
  for (const r of rows) {
    const rs = typeof r.start === "string" ? Date.parse(r.start) : NaN;
    const re = typeof r.end === "string" ? Date.parse(r.end) : NaN;
    if (Number.isNaN(rs) && Number.isNaN(re)) continue;
    n++;
    if (!Number.isNaN(rs) && rs >= f && rs <= t) s++;
    if (!Number.isNaN(re) && re >= f && re <= t) e++;
  }
  if (n === 0) return { semantik: "ukendt", iVinduetStart: 0, iVinduetEnd: 0, antal: 0 };
  const ps = s / n, pe = e / n;
  const semantik = ps >= 0.95 && pe < 0.95 ? "start" : pe >= 0.95 && ps < 0.95 ? "end" : ps >= 0.95 && pe >= 0.95 ? "blandet" : "ukendt";
  return { semantik, iVinduetStart: s, iVinduetEnd: e, antal: n };
}

/** Dansk klokkeslæt på en dato som UTC-ISO (Europe/Copenhagen). */
export function cphIso(dag: string, time: number, minut = 0): string {
  // Uafhængig af maskinens tidszone og korrekt på DST-skiftedage: gæt ud fra offset ved 00:00Z, kontrollér dansk klokketime ved gættet og justér
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Copenhagen", hour: "2-digit", hour12: false });
  time += Math.floor(minut / 60); minut = minut % 60;  // fx (10, 60) = 11:00
  const midnatZ = new Date(`${dag}T00:00:00Z`);
  const offMidnat = Number(fmt.format(midnatZ)) % 24;
  let t = new Date(Date.UTC(+dag.slice(0, 4), +dag.slice(5, 7) - 1, +dag.slice(8, 10), time - offMidnat, minut));
  const faktisk = Number(fmt.format(t)) % 24;
  if (faktisk !== time % 24) t = new Date(t.getTime() - ((faktisk - (time % 24)) * 3600000));
  return t.toISOString();
}

/** Seneste hverdag før i dag (YYYY-MM-DD, dansk tid). */
export function senesteHverdag(nu = new Date()): string {
  const dele = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(nu); // YYYY-MM-DD
  const d = new Date(`${dele}T00:00:00Z`);
  do { d.setUTCDate(d.getUTCDate() - 1); } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}
