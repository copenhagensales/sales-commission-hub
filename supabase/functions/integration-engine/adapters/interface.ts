import { StandardSale } from "../types.ts";

export interface DialerAdapter {
  fetchSales(days: number): Promise<StandardSale[]>;
  normalizeWebhook?(payload: any): StandardSale;
}
