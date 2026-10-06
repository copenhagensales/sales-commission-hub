import { CONTRACT_MONTHS, HARDWARE, TILBUD_PRODUCTS, VAT_FACTOR, type HardwareItem, type TilbudProduct } from "./catalog";

export type Quantities = Record<string, number>;

export interface TilbudTotals {
  price: number;
  priceInclVat: number;
  subsidy: number;
  priceAfterSubsidy: number;
  commission: [number, number, number];
  commissionDiff: number;
  hardwareSpent: number;
  remainingBudget: number;
}

const qty = (q: Quantities, id: string) => Math.max(0, q[id] ?? 0);

export function calcTilbud(
  products: Quantities,
  hardware: Quantities,
  catalog: TilbudProduct[] = TILBUD_PRODUCTS,
  hwCatalog: HardwareItem[] = HARDWARE,
  opts: { campaign?: boolean } = {},
): TilbudTotals {
  const campaign = opts.campaign ?? true;
  let price = 0, subsidy = 0;
  const commission: [number, number, number] = [0, 0, 0];
  for (const p of catalog) {
    const n = qty(products, p.id);
    if (!n) continue;
    price += n * p.price;
    subsidy += n * p.subsidy;
    if (p.countsInCommission !== false) for (let i = 0; i < 3; i++) commission[i] += n * activeCommission(p, campaign)[i];
  }
  const hardwareSpent = hwCatalog.reduce((s, h) => s + qty(hardware, h.id) * h.price, 0);
  return {
    price,
    priceInclVat: price * VAT_FACTOR,
    subsidy,
    priceAfterSubsidy: price - subsidy / CONTRACT_MONTHS,
    commission,
    commissionDiff: commission[0] - commission[1],
    hardwareSpent,
    remainingBudget: subsidy - hardwareSpent,
  };
}

/** Antal stk af et produkt det resterende budget rækker til (arkets "Resterende"). */
export const affordableCount = (remaining: number, itemPrice: number) =>
  itemPrice > 0 && remaining > 0 ? Math.floor(remaining / itemPrice) : 0;

export const fmtKr = (n: number) =>
  `${n.toLocaleString("da-DK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr.`;

/** Provisionssats ud fra kampagne-kontakten (kampagne = standard). */
export const activeCommission = (p: TilbudProduct, campaign: boolean) =>
  !campaign && p.nonCampaignCommission ? p.nonCampaignCommission : p.commission;
