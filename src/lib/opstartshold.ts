import type { OpstartRaekke } from "@/hooks/useOpstartshold";

export interface HoldDag {
  dag: number; dato: string; linjer: number; hiper: number; ansatte: number; solgte: number;
  pct: number; frafald: number; foreloebig: boolean; fremtid: boolean;
}
export interface HoldSaelger {
  id: string; navn: string; slut: string | null; linjer: number; hiper: number; arbejdsdage: number; prDag: number;
  dage: { dag: number; eesy: number; hiper: number }[];
}
export interface HoldData {
  noegle: string; navn: string; start: string; startere: number; dage: HoldDag[]; saelgere: HoldSaelger[];
  total: { linjer: number; hiper: number; pctSnit: number; prStarter: number; tilbage: number };
}

const aktiv = (slut: string | null, dato: string) => !slut || slut >= dato;

/** Samler RPC-rækker pr. hold. Ansatte = medlemmer uden slutdato eller med slutdato ≥ dagen. */
export function bygHold(rows: OpstartRaekke[], idag: string): HoldData[] {
  const pr = new Map<string, OpstartRaekke[]>();
  for (const r of rows) { const a = pr.get(r.hold_noegle) ?? []; a.push(r); pr.set(r.hold_noegle, a); }
  return [...pr.values()].map((rs) => {
    const f = rs[0];
    const medlemmer = new Map<string, OpstartRaekke[]>();
    for (const r of rs) { const a = medlemmer.get(r.employee_id) ?? []; a.push(r); medlemmer.set(r.employee_id, a); }
    const startere = medlemmer.size;
    const dagNr = [...new Set(rs.map((r) => r.dag))].sort((a, b) => a - b);
    let forrige = startere;
    const dage: HoldDag[] = dagNr.map((d) => {
      const paa = rs.filter((r) => r.dag === d);
      const dato = paa[0].dato;
      const ansatte = paa.filter((r) => aktiv(r.slut_dato, dato)).length;
      const solgte = paa.filter((r) => aktiv(r.slut_dato, dato) && r.linjer > 0).length;
      const linjer = paa.reduce((s, r) => s + r.linjer, 0);
      const hiper = paa.reduce((s, r) => s + r.hiper, 0);
      const frafald = Math.max(0, forrige - ansatte);
      forrige = ansatte;
      return { dag: d, dato, linjer, hiper, ansatte, solgte, pct: ansatte ? solgte / ansatte : 0, frafald, foreloebig: dato === idag, fremtid: dato > idag };
    });
    const faktiske = dage.filter((d) => !d.fremtid);
    const linjer = faktiske.reduce((s, d) => s + d.linjer, 0);
    const hiper = faktiske.reduce((s, d) => s + d.hiper, 0);
    const saelgere: HoldSaelger[] = [...medlemmer.values()].map((ms) => {
      const m = ms[0];
      const egne = ms.filter((r) => r.dato <= idag && aktiv(r.slut_dato, r.dato));
      const l = egne.reduce((s, r) => s + r.linjer, 0);
      const h = egne.reduce((s, r) => s + r.hiper, 0);
      return {
        id: m.employee_id, navn: m.navn || "Ukendt", slut: m.slut_dato, linjer: l, hiper: h, arbejdsdage: egne.length,
        prDag: egne.length ? l / egne.length : 0,
        dage: egne.sort((a, b) => a.dag - b.dag).map((r) => ({ dag: r.dag, eesy: r.linjer - r.hiper, hiper: r.hiper })),
      };
    }).sort((a, b) => b.prDag - a.prDag);
    const sidste = faktiske[faktiske.length - 1];
    return {
      noegle: f.hold_noegle, navn: f.hold_navn?.trim() || "Hold", start: f.start_dato, startere, dage, saelgere,
      total: {
        linjer, hiper,
        pctSnit: faktiske.length ? faktiske.reduce((s, d) => s + d.pct, 0) / faktiske.length : 0,
        prStarter: startere ? linjer / startere : 0,
        tilbage: sidste ? sidste.ansatte : startere,
      },
    };
  });
}

/** Kumuleret linjeantal pr. arbejdsdag til kurven (kun dage til og med i dag). */
export function kumuleret(hold: HoldData[], antalDage: number): Record<string, number | string>[] {
  return Array.from({ length: antalDage }, (_, i) => {
    const p: Record<string, number | string> = { dag: i + 1 };
    for (const h of hold) {
      const til = h.dage.filter((d) => d.dag <= i + 1 && !d.fremtid);
      if (til.length === i + 1) p[h.noegle] = til.reduce((s, d) => s + d.linjer, 0);
    }
    return p;
  });
}
