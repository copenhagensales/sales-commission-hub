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
  /**
   * Medarbejder-id'er der vises på boardet, men ikke deltager i kronekonkurrencen.
   * De placeres altid nederst og markeres særskilt i UI'et.
   */
  crownExemptEmployeeIds?: string[];
  /** Flere medarbejdere med ét fælles mål, vist som én linje. */
  combinedSellers?: {
    name: string;
    /** Første id bruges som linjens id. */
    employeeIds: string[];
    /** Mails for medarbejdere uden for TDC Erhverv-teamet. */
    extraEmails?: string[];
    goal: number;
  }[];
}

/**
 * Produkter der ikke tælles med på månedsmål-boardene.
 * Internetfilter findes som to produktrækker (én på TDC Erhverv-kampagnen og én
 * uden kampagne med trailing mellemrum i navnet) — begge skal ekskluderes.
 */
export const MONTHLY_GOAL_EXCLUDED_PRODUCT_IDS: ReadonlySet<string> = new Set([
  "67d0440b-032f-4e09-a348-ff61b8980cff",
  "82573835-02d7-45d1-b7ca-376849baf1fd",
]);

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
    // Oliver har kun et mål på 5 salg og deltager derfor ikke i kronekonkurrencen
    crownExemptEmployeeIds: ["80aac0dd-794c-4a68-97ed-374dc6b4cfea"],
  },
  "2026-10": {
    team: 1100,
    defaultSeller: 0,
    sellers: {
      "Mathias Victor Andersen": 155,
      "Jacob Østergaard Hansen": 130,
      "Sune Novrman": 75,
      "Matias Heller Frederiksen": 70,
      "Andreas Walther Christensen": 70,
      "August Bach Pedersen": 100,
      "Thomas Wehage": 65,
      "Lukas nielsen": 105,
      "Julius Rødsø Langkilde": 65,
      "Storm Søegaard": 65,
      "Thorbjørn Hansen-Larsen": 100,
      "Jonathan Gabriely Givskov Hove": 10,
      "Nicholaj Michael Wester": 60,
    },
    excludeEmployeeIds: [],
    // Johannes (Stab) og Oliver deler ét mål og vises på én linje
    combinedSellers: [
      {
        name: "Johannes / Oliver",
        employeeIds: ["80aac0dd-794c-4a68-97ed-374dc6b4cfea", "c3c81fce-3bbb-4a5f-8250-0611bce0d7f1"],
        extraEmails: ["joh@copenhagensales.dk"],
        goal: 15,
      },
    ],
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
