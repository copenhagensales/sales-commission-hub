/**
 * Hardkodede månedsmål for boardet "Relatel Månedsmål".
 *
 * Nøglen er "YYYY-MM" (dansk kalendermåned). Tilføj en ny blok når en ny måned starter.
 * - `team`: fælles mål for hele Relatel-teamet (antal produkter).
 * - `defaultSeller`: individuelt mål der bruges for alle sælgere uden eget mål.
 * - `sellers`: individuelle mål pr. sælger (navn som i medarbejderstamdata).
 */
export interface RelatelMonthlyGoal {
  team: number;
  defaultSeller: number;
  sellers?: Record<string, number>;
  /** Medarbejder-id'er der ikke skal vises som sælgere på boardet. */
  excludeEmployeeIds?: string[];
}

export const RELATEL_MONTHLY_GOALS: Record<string, RelatelMonthlyGoal> = {
  "2026-09": {
    team: 850,
    defaultSeller: 0,
    // Foreløbige (vilkårlige) targets — justeres når de rigtige tal er oplyst.
    sellers: {
      "Anders Schjødt Kristensen": 90,
      "Benjamin Nickolaj Andersen": 90,
      "Emillio Pedersen": 80,
      "Frederik Bülow Donner": 80,
      "Gustav Fyrstenborg Diebel": 80,
      "Jacob Lykke Nielson": 80,
      "Noah Zylber": 75,
      "Rasmus Quiding Fricke": 75,
      "Samuel Juul": 70,
      "Simon Sejer Linddal Sørensen": 70,
      "Thorbjørn Mindedal Weichert": 60,
    },
    excludeEmployeeIds: [],
  },
};

export function getRelatelMonthlyGoal(date: Date): RelatelMonthlyGoal | null {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return RELATEL_MONTHLY_GOALS[key] ?? null;
}

/** Normaliserer navne: trim, kollapser gentagne mellemrum, lowercase. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getRelatelSellerGoal(goal: RelatelMonthlyGoal | null, sellerName: string): number {
  if (!goal) return 0;
  const target = normalizeName(sellerName);
  for (const [key, value] of Object.entries(goal.sellers ?? {})) {
    if (normalizeName(key) === target) return value;
  }
  return goal.defaultSeller;
}
