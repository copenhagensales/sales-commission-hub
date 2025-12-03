// Data fra resultatopgørelse Jan-Nov 2025 (Copenhagen Sales ApS)

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
  totalSalaries: 39750875.82,
  totalSalariesPreviousYear: 26970737.75,
  resultBeforeTax: 3624196.61,
  resultBeforeTaxPreviousYear: 6084844.80,
  resultBeforeDepreciation: 3892077.44,
  resultBeforeDepreciationPreviousYear: 6130480.54,
  period: "Jan - Nov 2025",
  months: 11,
};

// Lønninger detaljeret
export const salaryDetails: FinancialLineItem[] = [
  { account: "2210", name: "Lønninger", actual: 38711404.70, previousYear: 26343235.24 },
  { account: "2222", name: "AER (Samlet betaling)", actual: 318529.87, previousYear: 196490.64 },
  { account: "2241", name: "Personaleudgifter", actual: 273945.15, previousYear: 145677.15 },
  { account: "2215", name: "Pensioner, arbejdsgiver", actual: 131000.00, previousYear: 126200.00 },
  { account: "2223", name: "ATP", actual: 120252.00, previousYear: 85801.22 },
  { account: "2230", name: "KM-penge", actual: 118800.00, previousYear: 46900.00 },
  { account: "2245", name: "Lønforskud", actual: 56261.00, previousYear: 0 },
  { account: "2240", name: "Bespisning personale", actual: 38465.44, previousYear: 36845.29 },
  { account: "2214", name: "Personalegoder og multimedier", actual: 29150.00, previousYear: -5333.40 },
];

// Omkostningskategorier
export const costCategories: CostCategory[] = [
  {
    category: "Salgs- og rejseomkostninger",
    total: 2419708.43,
    previousYearTotal: 1954380.09,
    items: [
      { account: "2810", name: "Stadeplads med moms", actual: 1154772.00, previousYear: 1066969.00 },
      { account: "2802", name: "Annoncer og reklame EU moms", actual: 312931.04, previousYear: 244721.59 },
      { account: "2770", name: "Rejseudgifter", actual: 255546.52, previousYear: 187676.70 },
      { account: "2800", name: "Annoncer og reklame", actual: 254580.20, previousYear: 129385.06 },
      { account: "2775", name: "Hotelophold", actual: 167664.96, previousYear: 59131.28 },
      { account: "2750", name: "Restaurationsbesøg - personale", actual: 134619.47, previousYear: 155552.45 },
      { account: "2809", name: "Stadeplads uden moms", actual: 78147.50, previousYear: 38742.00 },
      { account: "2754", name: "Gaver og blomster - personale", actual: 58195.84, previousYear: 61233.45 },
    ],
  },
  {
    category: "Lokaleomkostninger",
    total: 3046492.40,
    previousYearTotal: 1414353.70,
    items: [
      { account: "3410", name: "Husleje m/moms", actual: 2684149.75, previousYear: 1238874.65 },
      { account: "3430", name: "Vedligeholdelse og rengøring", actual: 236133.39, previousYear: 123285.74 },
      { account: "3414", name: "Ekstraordinære omkostninger", actual: 95156.50, previousYear: 20775.00 },
      { account: "3420", name: "El, vand og gas", actual: 26031.10, previousYear: 19960.12 },
      { account: "3431", name: "Alarm", actual: 5021.66, previousYear: 7203.79 },
    ],
  },
  {
    category: "Administrationsomkostninger",
    total: 1368472.24,
    previousYearTotal: 1159740.59,
    items: [
      { account: "3604", name: "Edb-udgifter / software", actual: 491864.56, previousYear: 372602.28 },
      { account: "3617", name: "Mindre anskaffelser", actual: 372611.37, previousYear: 604497.03 },
      { account: "3648", name: "Rådgivning - Konsulentydelse", actual: 229687.26, previousYear: 16000.00 },
      { account: "3650", name: "Forsikringer", actual: 87754.57, previousYear: 50120.88 },
      { account: "3620", name: "Telefon", actual: 51888.30, previousYear: 29535.17 },
      { account: "3640", name: "Revisor", actual: 27300.00, previousYear: 24500.00 },
      { account: "3621", name: "Internetforbindelse", actual: 26088.00, previousYear: -12975.84 },
      { account: "3645", name: "Advokat", actual: 21000.00, previousYear: 9600.00 },
      { account: "3600", name: "Kontorartikler og tryksager", actual: 16747.94, previousYear: 18485.17 },
    ],
  },
  {
    category: "Autodrift - personbiler",
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
      { account: "3940", name: "Afskrivning, driftsmidler og inventar", actual: 270753.69, previousYear: 36153.38 },
    ],
  },
];

// Direkte omkostninger
export const directCostsDetails: FinancialLineItem[] = [
  { account: "1310", name: "Direkte omkostninger m/moms", actual: 8180220.62, previousYear: 3557468.04 },
  { account: "1321", name: "Direkte omk. ydelser u/moms indenfor EU", actual: 36162.00, previousYear: 260730.00 },
];

// Beregn totale faste omkostninger
export const totalFixedCosts = costCategories.reduce((sum, cat) => sum + cat.total, 0) + summaryData.totalSalaries;
export const totalFixedCostsPreviousYear = costCategories.reduce((sum, cat) => sum + cat.previousYearTotal, 0) + summaryData.totalSalariesPreviousYear;

// Forecast helpers
export const monthlyAverage = {
  revenue: summaryData.revenue / summaryData.months,
  directCosts: summaryData.directCosts / summaryData.months,
  salaries: summaryData.totalSalaries / summaryData.months,
  fixedCosts: totalFixedCosts / summaryData.months,
  result: summaryData.resultBeforeTax / summaryData.months,
};

export const forecastFullYear = {
  revenue: monthlyAverage.revenue * 12,
  directCosts: monthlyAverage.directCosts * 12,
  salaries: monthlyAverage.salaries * 12,
  fixedCosts: monthlyAverage.fixedCosts * 12,
  result: monthlyAverage.result * 12,
};
