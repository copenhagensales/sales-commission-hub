// Felttræ: navne og typer af felter i et JSON-objekt – ALDRIG værdier.
// Bruges af samtaler-F0.1 (plan v2.3): kald-webhook i testtilstand og adversus-samtaler-diagnose
// måler, hvilke felter Adversus leverer, uden at persondata gemmes eller logges.

export type FeltType = "string" | "number" | "boolean" | "null" | "object" | "array" | "undefined";

const typeAf = (v: unknown): FeltType => {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  const t = typeof v;
  if (t === "string" || t === "number" || t === "boolean" || t === "undefined") return t;
  return "object";
};

/** Returnerer sorterede stier som "cdr.id: number", "clips[]: object", "clips[].tagId: number". Maks. `dybde` niveauer. */
export function feltTrae(v: unknown, dybde = 3, praefiks = "", ud: string[] = []): string[] {
  if (dybde < 0) return ud;
  const t = typeAf(v);
  if (t === "object") {
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const sti = praefiks ? `${praefiks}.${k}` : k;
      const barn = (v as Record<string, unknown>)[k];
      const bt = typeAf(barn);
      ud.push(`${sti}: ${bt}`);
      if (bt === "object" || bt === "array") feltTrae(barn, dybde - 1, sti, ud);
    }
  } else if (t === "array") {
    const arr = v as unknown[];
    const sti = `${praefiks}[]`;
    if (arr.length === 0) { ud.push(`${sti}: tom`); return ud; }
    // Første element er repræsentativt; typer af øvrige elementer samles uden værdier
    const typer = Array.from(new Set(arr.map(typeAf))).sort().join("|");
    ud.push(`${sti}: ${typer}`);
    const foerste = arr.find((x) => typeAf(x) === "object" || typeAf(x) === "array");
    if (foerste !== undefined) feltTrae(foerste, dybde - 1, sti, ud);
  }
  return ud;
}

/** Fordeling af en nøgles værdier i en liste af objekter – kun for felter med lukkede værdisæt (fx disposition). */
export function fordeling(rows: unknown[], noegle: string, maksDistinkte = 20): Record<string, number> {
  const ud: Record<string, number> = {};
  for (const r of rows) {
    const v = (r as Record<string, unknown> | null)?.[noegle];
    const k = v === undefined ? "(mangler)" : v === null ? "(null)" : String(v);
    if (!(k in ud) && Object.keys(ud).length >= maksDistinkte) { ud["(flere)"] = (ud["(flere)"] ?? 0) + 1; continue; }
    ud[k] = (ud[k] ?? 0) + 1;
  }
  return ud;
}
