/**
 * TDC Tilbud – produktkatalog.
 * Kilde: "Oli_arket2.0" fane "Aarhus Arket 2.0" (okt. 2026). Rettes af udvikler.
 * price = månedspris ekskl. moms, subsidy = muligt tilskud pr. stk (gavekort),
 * commission = vejledende provision pr. stk ved [0 %, 50 %, 100 %] tilskud.
 * countsInCommission=false følger arkets formel F31:H31, som ikke medtager rækken.
 */

export interface TilbudProduct {
  id: string;
  group: string;
  name: string;
  price: number;
  subsidy: number;
  commission: [number, number, number];
  countsInCommission?: boolean;
  /** Navn i idriftsættelsesmailens abonnementsliste, hvis relevant */
  mailSubscription?: string;
  /** Længere produktnavn til opsummeringsteksten */
  summaryName?: string;
  kind: "mobile" | "mbb" | "other";
}

export const TILBUD_PRODUCTS: TilbudProduct[] = [
  { id: "premium-1000", summaryName: "Mobil Premium 1TB", group: "Mobilpakker", name: "1000GB Premium", price: 379, subsidy: 3411, commission: [2075, 1680, 1250], mailSubscription: "Premium mobil (1TB)", kind: "mobile" },
  { id: "pro-100", summaryName: "Mobil Professionel 100GB", group: "Mobilpakker", name: "100GB Pro", price: 209, subsidy: 1881, commission: [1300, 1075, 850], mailSubscription: "Professionel mobil (100GB)", kind: "mobile" },
  { id: "standard-40", summaryName: "Mobil Standard 40GB", group: "Mobilpakker", name: "40GB Standard", price: 189, subsidy: 1701, commission: [1060, 855, 650], mailSubscription: "Standard mobil (40GB)", kind: "mobile" },
  { id: "basis-15", summaryName: "Mobil Basis 15GB", group: "Mobilpakker", name: "15GB Basis", price: 139, subsidy: 1251, commission: [750, 600, 450], mailSubscription: "Basis mobil (15GB)", kind: "mobile" },
  { id: "dk-3", summaryName: "Mobil DK 3GB", group: "Mobilpakker", name: "3GB", price: 99, subsidy: 891, commission: [540, 430, 325], mailSubscription: "Mobil DK (3GB)", kind: "mobile" },
  { id: "eu-basis-40", summaryName: "Mobil Basis 40GB", group: "Kun EU", name: "40GB Basis", price: 159, subsidy: 1431, commission: [845, 670, 500], mailSubscription: "Mobil Basis (40GB)", kind: "mobile" },
  { id: "eu-basis-5", summaryName: "Mobil Basis 5GB", group: "Kun EU", name: "5GB Basis", price: 109, subsidy: 684, commission: [585, 470, 350], mailSubscription: "Mobil Basis (5GB)", kind: "mobile" },
  { id: "eu-minut", summaryName: "Mobil Minut", group: "Kun EU", name: "Mobil Minut", price: 38.5, subsidy: 306, commission: [190, 160, 125], mailSubscription: "Mobil minut", kind: "mobile" },
  { id: "oms-pro", group: "Omstilling", name: "Professionel omstilling", price: 388.5, subsidy: 0, commission: [1250, 1250, 1250], kind: "other" },
  { id: "oms-std", group: "Omstilling", name: "Standard omstilling", price: 145.6, subsidy: 0, commission: [850, 850, 850], kind: "other" },
  { id: "ddi", group: "Omstilling", name: "DDI nummer", price: 14, subsidy: 0, commission: [0, 0, 0], kind: "other" },
  { id: "mb-hoved", group: "Omstilling", name: "MB hovednummer", price: 38.5, subsidy: 0, commission: [0, 0, 0], countsInCommission: false, kind: "other" },
  { id: "iot-std", group: "Omstilling", name: "IOT Standard", price: 14.6, subsidy: 0, commission: [0, 0, 0], countsInCommission: false, kind: "other" },
  { id: "iot-prem", group: "Omstilling", name: "IOT Premium", price: 29.2, subsidy: 0, commission: [0, 0, 0], countsInCommission: false, kind: "other" },
  { id: "mbb-50", group: "5G Bredbånd / Fiber", name: "MBB 50/10", price: 249, subsidy: 0, commission: [1000, 1000, 1000], kind: "mbb" },
  { id: "mbb-100", group: "5G Bredbånd / Fiber", name: "MBB 100/20", price: 299, subsidy: 0, commission: [1100, 1100, 1100], kind: "mbb" },
  { id: "mbb-500", group: "5G Bredbånd / Fiber", name: "MBB 500/100", price: 399, subsidy: 0, commission: [1300, 1300, 1300], kind: "mbb" },
  { id: "fiber-100", group: "5G Bredbånd / Fiber", name: "Fiber 100/100 (VOK)", price: 499, subsidy: 0, commission: [1250, 1250, 1250], kind: "mbb" },
  { id: "fiber-1000", group: "5G Bredbånd / Fiber", name: "Fiber 1000/1000 (VOK)", price: 359, subsidy: 0, commission: [750, 750, 750], kind: "mbb" },
  { id: "filter", group: "Diverse", name: "Internetfilter", price: 10, subsidy: 0, commission: [35, 35, 35], kind: "other" },
  { id: "passivt", group: "Diverse", name: "Passivt nummer", price: 12, subsidy: 0, commission: [35, 35, 35], kind: "other" },
  { id: "datakort", group: "Diverse", name: "Extra datakort", price: 36.4, subsidy: 0, commission: [0, 0, 0], kind: "other" },
];

export interface HardwareItem { id: string; group: string; name: string; price: number }

const hw = (group: string, items: [string, number][]): HardwareItem[] =>
  items.map(([name, price], i) => ({ id: `${group}-${i}`, group, name, price }));

export const HARDWARE: HardwareItem[] = [
  ...hw("Samsung", [
    ["Galaxy Xcover 7 128GB", 2399.2], ["HMD Fusion 5G 256GB Business", 1999],
    ["Samsung Galaxy S24 128GB Enterprise", 5759], ["Samsung Galaxy S25 128GB EE Enterprise", 5759],
    ["Galaxy S26 256GB", 6399.2], ["Galaxy S26 Ultra 256GB", 9199.2], ["Galaxy S26 Ultra 512GB", 10399.2],
    ["Samsung Galaxy Tab A7 Lite Wifi 32GB", 1079], ["Samsung Galaxy Buds4", 1519.2],
  ]),
  ...hw("Routere", [
    ["4G Router", 719.2], ["5G wifi 7 Router", 3679.2], ["Doro Leva L11s", 839.2],
  ]),
  ...hw("Apple", [
    ["iPhone 17e 256GB", 5199], ["iPhone 18 Pro 256GB", 8799], ["iPhone 17 256GB", 6799],
    ["iPhone 18 Pro 512GB", 10399], ["iPhone 17 Pro 256GB", 7999.2], ["iPhone 17 Pro 512GB", 9599.2],
    ["iPhone 17 Pro Max 256GB", 8799.2], ["iPhone 17 Pro Max 512GB", 10399.2], ["iPhone 18 Pro Max 256GB", 9839],
    ["iPad Wifi 128GB", 3199], ["iPad Wifi 128GB + 5G", 4399], ["AirPods 4", 959.2],
    ["AirPods Pro 3", 1599.2], ["Apple Watch SE", 2199], ["Apple Watch Ultra 3", 5599.2],
  ]),
];

export const VAT_FACTOR = 1.25;
export const CONTRACT_MONTHS = 36;
