import type { OpstartRaekke } from "@/hooks/useOpstartshold";

export interface HoldDag {
  dag: number; dato: string; linjer: number; hiper: number; ansatte: number; solgte: number;
  pct: number; prSaelger: number; trin: 0 | 1 | 2 | 3 | 4; frafald: number; foreloebig: boolean; fremtid: boolean;
}
export interface HoldSaelger {
  id: string; navn: string; slut: string | null; linjer: number; hiper: number; arbejdsdage: number; prDag: number;
  sidsteSalg: string | null; dageUdenSalg: number; flag: boolean;
  dage: { dag: number; eesy: number; hiper: number }[];
}
export interface HoldData {
  noegle: string; navn: string; start: string; startere: number; dage: HoldDag[]; saelgere: HoldSaelger[];
  total: { linjer: number; hiper: number; pctSnit: number; prSaelgerSnit: number; prStarter: number; tilbage: number; dagIGang: number | null };
}

/** Farvetrin efter linjer pr. ansat sælger (afrundet til én decimal): <0,4 · 0,4–0,7 · 0,8–1,1 · 1,2–1,9 · ≥2,0. */
export function farveTrin(prSaelger: number): 0 | 1 | 2 | 3 | 4 {
  const x = Math.round(prSaelger * 10) / 10;
  if (x >= 2) return 4; if (x >= 1.2) return 3; if (x >= 0.8) return 2; if (x >= 0.4) return 1; return 0;
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
      const prSaelger = ansatte ? linjer / ansatte : 0;
      return { dag: d, dato, linjer, hiper, ansatte, solgte, pct: ansatte ? solgte / ansatte : 0, prSaelger, trin: farveTrin(prSaelger), frafald, foreloebig: dato === idag, fremtid: dato > idag };
    });
    const faktiske = dage.filter((d) => !d.fremtid);
    const linjer = faktiske.reduce((s, d) => s + d.linjer, 0);
    const hiper = faktiske.reduce((s, d) => s + d.hiper, 0);
    const ansatDage = faktiske.reduce((s, d) => s + d.ansatte, 0);
    const holdSnit = ansatDage ? linjer / ansatDage : 0;
    const saelgere: HoldSaelger[] = [...medlemmer.values()].map((ms) => {
      const m = ms[0];
      const egne = ms.filter((r) => r.dato <= idag && aktiv(r.slut_dato, r.dato));
      const l = egne.reduce((s, r) => s + r.linjer, 0);
      const h = egne.reduce((s, r) => s + r.hiper, 0);
      const sorteret = [...egne].sort((a, b) => a.dag - b.dag);
      const medSalg = sorteret.filter((r) => r.linjer > 0);
      const sidsteSalg = medSalg.length ? medSalg[medSalg.length - 1].dato : null;
      // Afsluttede arbejdsdage uden salg i træk til og med seneste (dagen i dag tæller kun, hvis der er salg).
      const afsluttede = sorteret.filter((r) => r.dato < idag || r.linjer > 0);
      let dageUdenSalg = 0;
      for (let i = afsluttede.length - 1; i >= 0 && afsluttede[i].linjer === 0; i--) dageUdenSalg++;
      const prDag = egne.length ? l / egne.length : 0;
      const stoppet = !!m.slut_dato && m.slut_dato < idag;
      const flag = !stoppet && (dageUdenSalg >= 3 || (afsluttede.length > 5 && prDag < holdSnit / 2));
      return {
        sidsteSalg, dageUdenSalg, flag,
        id: m.employee_id, navn: m.navn || "Ukendt", slut: m.slut_dato, linjer: l, hiper: h, arbejdsdage: egne.length,
        prDag,
        dage: sorteret.sort((a, b) => a.dag - b.dag).map((r) => ({ dag: r.dag, eesy: r.linjer - r.hiper, hiper: r.hiper })),
      };
    }).sort((a, b) => b.prDag - a.prDag);
    const sidste = faktiske[faktiske.length - 1];
    return {
      noegle: f.hold_noegle, navn: f.hold_navn?.trim() || "Hold", start: f.start_dato, startere, dage, saelgere,
      total: {
        linjer, hiper,
        pctSnit: faktiske.length ? faktiske.reduce((s, d) => s + d.pct, 0) / faktiske.length : 0,
        prSaelgerSnit: holdSnit,
        prStarter: startere ? linjer / startere : 0,
        dagIGang: dage.find((d) => d.foreloebig)?.dag ?? null,
        tilbage: sidste ? sidste.ansatte : startere,
      },
    };
  });
}

/** Kumuleret linjer pr. starter pr. arbejdsdag til kurven (kun dage til og med i dag). */
export function kumuleret(hold: HoldData[], antalDage: number): Record<string, number | string>[] {
  return Array.from({ length: antalDage }, (_, i) => {
    const p: Record<string, number | string> = { dag: i + 1 };
    for (const h of hold) {
      const til = h.dage.filter((d) => d.dag <= i + 1 && !d.fremtid);
      if (til.length === i + 1 && h.startere) p[h.noegle] = Math.round((til.reduce((s, d) => s + d.linjer, 0) / h.startere) * 100) / 100;
    }
    return p;
  });
}
