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
    defaultSeller: 0,
    sellers: {
      "Mathias Victor Andersen": 130,
      "Jacob Østergaard Hansen": 105,
      "Sune Novrman": 80,
      "Matias Heller Frederiksen": 55,
      "Andreas Walther Christensen": 50,
      "Niklas Krøyer-Strube": 40,
      "August Bach Pedersen": 80,
      "Thomas Wehage": 25,
      "Lukas nielsen": 45,
      "Zean Romeo Ayvaz": 30,
      "Julius Rødsø Langkilde": 45,
      "Storm Søegaard": 20,
      "Thorbjørn Hansen-Larsen": 80,
      "Jonathan Gabriely Givskov Hove": 10,
      "Nicholaj Michael Wester": 60,
      "Oliver Gonsalves Vatting Arentoft": 5,
    },
    excludeEmployeeIds: [],
  },
};

export function getTdcMonthlyGoal(date: Date): TdcMonthlyGoal | null {
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return TDC_MONTHLY_GOALS[key] ?? null;
}

/** Normaliserer navne: trim, kollapser gentagne mellemrum, lowercase. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function getTdcSellerGoal(goal: TdcMonthlyGoal | null, sellerName: string): number {
  if (!goal) return 0;
  const target = normalizeName(sellerName);
  for (const [key, value] of Object.entries(goal.sellers ?? {})) {
    if (normalizeName(key) === target) return value;
  }
  return goal.defaultSeller;
}
