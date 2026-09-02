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

/**
 * Produkter der ikke tælles med på boardet "Relatel Månedsmål".
 * Navnene i systemet afviger fra dagligsproget ("BTL #2" = "#2"/"Trin 2"),
 * så id'erne står med produktnavnet fra `products` som kommentar.
 */
export const RELATEL_MONTHLY_GOAL_EXCLUDED_PRODUCT_IDS: ReadonlySet<string> = new Set([
  // Switch Professionel (BTL-varianter)
  "e5c7c979-9180-4e26-8672-2d48f0e0f329", // Switch Professionel #1
  "6d9eb706-9bd3-4f43-824a-ae769eb60468", // Switch Professionel #2
  "c24ca95e-7399-4870-a920-6654cd4231ec", // Switch Professionel #3
  // Omstillingsbruger
  "1bcce0ca-5913-4166-9fb1-4975dac8a9e5", // Omstillingsbruger ATL
  "7b656e2e-7a30-4100-a959-c24961bbb3f6", // Omstillingsbruger  #1
  "1bb077b0-3bed-40a1-ae17-68f9127a3d1c", // Omstillingsbruger #2
  "86b6306c-4c11-432e-bffd-9fe11101d869", // Omstillingsbruger #3
  "0fd5b4a4-1fe6-4982-bf01-be41539657fc", // Omstillingsbruger #4
  // M2M
  "52fe90d0-1309-4aa8-bad9-5e8b46a30a8a", // M2M Basis
  "b364b200-4579-436d-a975-767be1c40274", // M2M Medium DK
  "0824ce5a-2602-41d7-ab57-841747aab077", // M2M Medium
  "4646e99c-ec6e-4c82-bf99-0b1d99086a00", // M2M Stor
  // Datadeling
  "b0c7c77f-f7bd-4657-a845-9541e9b80289", // Datadeling ATL
  "30f018a0-2b9f-4e3e-89da-475624aec4df", // Datadeling Trin 1
  "3e308058-7cee-4b75-9b79-91373c48c2e8", // Datadeling Trin 2
  // Mobilfeatures
  "3f172eb3-cd49-4b8f-b363-3df5b2c8965f", // Mobilfeatures ATL
  "c52a45c8-ce7d-40c1-864e-dcb449c38b2e", // Mobilfeatures Trin 1
  "0b9e78b5-468d-40ee-a977-1c5f75e654e0", // Mobilfeatures Trin 2
  "eb81080c-b5ef-4075-bd6c-d78c03b40b73", // Mobilfeatures Trin 3
  "e45254cc-703c-473f-bbd9-70090da093d9", // Mobilfeatures Trin 4
  // Smartwatch e-sim
  "05bc0564-3f16-4e0d-8d19-bd7b8599fde5", // Smartwatch e-sim ATL
  "4529d04d-a2d6-48dd-8c6f-a5f674663af0", // Smartwatch e-sim Trin 1
  "d59d5578-87eb-40d6-be30-3265eb1ae89b", // Smartwatch e-sim Trin 2
]);

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
