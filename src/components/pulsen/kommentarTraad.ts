// S8: tråde i kommentarsporet (ét niveau). Ren funktion – bruges af PostFooter og prøver.
export interface TraadKommentar { id: string; parentId?: string | null; createdAt: string }

/** Ældste først; hver topkommentar får sine svar (ældste først). Svar uden kendt forælder vises som topkommentarer, så intet forsvinder. */
export function grupperKommentarer<T extends TraadKommentar>(alle: T[]): { top: T; svar: T[] }[] {
  const sorteret = [...alle].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const ids = new Set(sorteret.map((c) => c.id));
  const top = sorteret.filter((c) => !c.parentId || !ids.has(c.parentId));
  return top.map((t) => ({ top: t, svar: sorteret.filter((c) => c.parentId === t.id) }));
}
