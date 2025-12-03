// Data fra resultatopgørelse Jan-Nov 2025 (Copenhagen Sales ApS)
// Løn er fjernet - hentes eksternt

export interface FinancialLineItem {
  account: string;
  name: string;
  actual: number;
  previousYear: number;
}

export interface CostCategory {
  category: string;
  items: FinancialLineItem[];
  total: number;
  previousYearTotal: number;
}

// Hovedtal
export const summaryData = {
  revenue: 58803853.82,
  revenuePreviousYear: 41512842.48,
  directCosts: 8216382.62,
  directCostsPreviousYear: 3818198.04,
  contributionMargin: 50587471.20,
  contributionMarginPreviousYear: 37694644.44,
  resultBeforeTax: 3624196.61,
  resultBeforeTaxPreviousYear: 6084844.80,
  resultBeforeDepreciation: 3892077.44,
  resultBeforeDepreciationPreviousYear: 6130480.54,
  period: "Jan - Nov 2025",
  months: 11,
};

// Omkostningskategorier (uden løn)
export const costCategories: CostCategory[] = [
  {
    category: "Field Marketing",
    total: 1154772.00 + 78147.50 + 167664.96 + 255546.52, // Stadeplads + Hotel + Rejse
    previousYearTotal: 1066969.00 + 38742.00 + 59131.28 + 187676.70,
    items: [
      { account: "2810", name: "Stadeplads med moms", actual: 1154772.00, previousYear: 1066969.00 },
      { account: "2809", name: "Stadeplads uden moms", actual: 78147.50, previousYear: 38742.00 },
      { account: "2775", name: "Hotelophold", actual: 167664.96, previousYear: 59131.28 },
      { account: "2770", name: "Rejseudgifter", actual: 255546.52, previousYear: 187676.70 },
    ],
  },
  {
    category: "Lokaleomkostninger",
    total: 3046492.40,
    previousYearTotal: 1414353.70,
    items: [
      { account: "3410", name: "Husleje", actual: 2684149.75, previousYear: 1238874.65 },
      { account: "3430", name: "Vedligeholdelse og rengøring", actual: 236133.39, previousYear: 123285.74 },
      { account: "3414", name: "Ekstraordinære omkostninger", actual: 95156.50, previousYear: 20775.00 },
      { account: "3420", name: "El, vand og gas", actual: 26031.10, previousYear: 19960.12 },
      { account: "3431", name: "Alarm", actual: 5021.66, previousYear: 7203.79 },
    ],
  },
  {
    category: "Marketing & Annoncering",
    total: 312931.04 + 254580.20,
    previousYearTotal: 244721.59 + 129385.06,
    items: [
      { account: "2802", name: "Annoncer og reklame EU moms", actual: 312931.04, previousYear: 244721.59 },
      { account: "2800", name: "Annoncer og reklame", actual: 254580.20, previousYear: 129385.06 },
    ],
  },
  {
    category: "IT & Software",
    total: 491864.56 + 13435.18 + 12781.86 + 26088.00 + 51888.30,
    previousYearTotal: 372602.28 + 10857.12 + 24347.12 + (-12975.84) + 29535.17,
    items: [
      { account: "3604", name: "Edb-udgifter / software", actual: 491864.56, previousYear: 372602.28 },
      { account: "3620", name: "Telefon", actual: 51888.30, previousYear: 29535.17 },
      { account: "3621", name: "Internetforbindelse", actual: 26088.00, previousYear: -12975.84 },
      { account: "3605", name: "Edb-udgifter uden moms", actual: 13435.18, previousYear: 10857.12 },
      { account: "3607", name: "Edb-udgifter EU moms", actual: 12781.86, previousYear: 24347.12 },
    ],
  },
  {
    category: "Administration",
    total: 372611.37 + 229687.26 + 87754.57 + 27300.00 + 21000.00 + 16747.94,
    previousYearTotal: 604497.03 + 16000.00 + 50120.88 + 24500.00 + 9600.00 + 18485.17,
    items: [
      { account: "3617", name: "Mindre anskaffelser", actual: 372611.37, previousYear: 604497.03 },
      { account: "3648", name: "Rådgivning / Konsulent", actual: 229687.26, previousYear: 16000.00 },
      { account: "3650", name: "Forsikringer", actual: 87754.57, previousYear: 50120.88 },
      { account: "3640", name: "Revisor", actual: 27300.00, previousYear: 24500.00 },
      { account: "3645", name: "Advokat", actual: 21000.00, previousYear: 9600.00 },
      { account: "3600", name: "Kontorartikler", actual: 16747.94, previousYear: 18485.17 },
    ],
  },
  {
    category: "Personale (ekskl. løn)",
    total: 134619.47 + 58195.84 + 38465.44 + 273945.15,
    previousYearTotal: 155552.45 + 61233.45 + 36845.29 + 145677.15,
    items: [
      { account: "2241", name: "Personaleudgifter", actual: 273945.15, previousYear: 145677.15 },
      { account: "2750", name: "Restaurationsbesøg", actual: 134619.47, previousYear: 155552.45 },
      { account: "2754", name: "Gaver og blomster", actual: 58195.84, previousYear: 61233.45 },
      { account: "2240", name: "Bespisning personale", actual: 38465.44, previousYear: 36845.29 },
    ],
  },
  {
    category: "Autodrift",
    total: 109844.87,
    previousYearTotal: 64951.77,
    items: [
      { account: "3110", name: "Brændstof", actual: 67130.15, previousYear: 28188.90 },
      { account: "3140", name: "Reparation/vedligeholdelse", actual: 31506.56, previousYear: 26834.06 },
      { account: "3120", name: "Bilforsikring", actual: 11208.16, previousYear: 6308.81 },
    ],
  },
  {
    category: "Afskrivninger",
    total: 270753.69,
    previousYearTotal: 61031.16,
    items: [
      { account: "3940", name: "Afskrivning driftsmidler", actual: 270753.69, previousYear: 36153.38 },
    ],
  },
];

// Beregn totale faste omkostninger (uden løn)
export const totalFixedCosts = costCategories.reduce((sum, cat) => sum + cat.total, 0);
export const totalFixedCostsPreviousYear = costCategories.reduce((sum, cat) => sum + cat.previousYearTotal, 0);

// Månedlige faste omkostninger
export const monthlyFixedCosts = totalFixedCosts / summaryData.months;
export const monthlyFixedCostsPreviousYear = totalFixedCostsPreviousYear / summaryData.months;

// Nøgleposter pr. måned
export const monthlyKeyItems = {
  husleje: 2684149.75 / summaryData.months,
  fieldMarketing: (1154772.00 + 78147.50 + 167664.96 + 255546.52) / summaryData.months,
  itSoftware: (491864.56 + 13435.18 + 12781.86 + 26088.00 + 51888.30) / summaryData.months,
  marketing: (312931.04 + 254580.20) / summaryData.months,
};

// Forecast helpers (uden løn)
export const monthlyAverage = {
  revenue: summaryData.revenue / summaryData.months,
  directCosts: summaryData.directCosts / summaryData.months,
  fixedCosts: totalFixedCosts / summaryData.months,
  result: summaryData.resultBeforeTax / summaryData.months,
};

export const forecastFullYear = {
  revenue: monthlyAverage.revenue * 12,
  directCosts: monthlyAverage.directCosts * 12,
  fixedCosts: monthlyAverage.fixedCosts * 12,
  result: monthlyAverage.result * 12,
};
