/**
 * Hardkodede månedsmål for boardet "TDC Månedsmål".
 *
 * Nøglen er "YYYY-MM" (dansk kalendermåned). Tilføj en ny blok når en ny måned starter.
 * - `team`: fælles mål for hele TDC Erhverv-teamet (antal produkter).
 * - `defaultSeller`: individuelt mål der bruges for alle sælgere uden eget mål.
 * - `sellers`: individuelle mål pr. sælger (navn som i medarbejderstamdata).
 */
export interface TdcMonthlyGoal {
  team: number;
  defaultSeller: number;
  sellers?: Record<string, number>;
  /** Medarbejder-id'er der ikke skal vises som sælgere på boardet. */
  excludeEmployeeIds?: string[];
}

export const TDC_MONTHLY_GOALS: Record<string, TdcMonthlyGoal> = {
  "2026-09": {
    team: 850,
    defaultSeller: 30,
    sellers: {},
    excludeEmployeeIds: [],
  },
};

export function getTdcMonthlyGoal(date: Date): TdcMonthlyGoal | null {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return TDC_MONTHLY_GOALS[key] ?? null;
}

export function getTdcSellerGoal(goal: TdcMonthlyGoal | null, sellerName: string): number {
  if (!goal) return 0;
  const explicit = goal.sellers?.[sellerName];
  return typeof explicit === "number" ? explicit : goal.defaultSeller;
}
