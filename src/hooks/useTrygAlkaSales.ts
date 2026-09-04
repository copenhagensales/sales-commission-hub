import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrygKanvasSale } from "@/hooks/useTrygKanvasSales";

/** Kunderne på fanen "Alle tryg & alka salg". */
export const TRYG_CLIENT_ID = "516a3f67-ea6d-4ef0-929d-e3224cc16e22";
export const ALKA_CLIENT_ID = "0a8048ac-ac28-4999-b1a7-5d1238d7fc2c";

/** Antal id'er pr. forespørgsel, så URL'en ikke bliver for lang. */
const CHUNK = 200;

export interface TrygAlkaSale extends TrygKanvasSale {
  clientName: string;
}

function dayBounds(day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function chunk<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

type SaleRow = {
  id: string;
  sale_datetime: string;
  agent_email: string | null;
  agent_name: string | null;
  customer_phone: string | null;
  client_campaign_id: string | null;
};

type ItemRow = {
  id: string;
  sale_id: string;
  product_id: string | null;
  quantity: number | null;
  mapped_commission: number | null;
  mapped_revenue: number | null;
  products: { name: string | null } | null;
};

const SALE_FIELDS =
  "id, sale_datetime, agent_email, agent_name, customer_phone, client_campaign_id";
const ITEM_FIELDS =
  "id, sale_id, product_id, quantity, mapped_commission, mapped_revenue, products(name)";

/**
 * Alle salg under kunderne Tryg og ALKA for én dag, nyeste først.
 * Kunden kan sidde på salget (typisk) eller på produktets kampagne — begge spor
 * hentes i trin (først salg/produkter, derefter salgslinjer via id-lister), fordi
 * indlejret filtrering på `sales`/`products` timer ud i databasen.
 * Ren læsning — bruges kun til visningen på "Tryg - Ret salg".
 */
export function useTrygAlkaSales(day: Date, enabled = true) {
  const { start, end } = dayBounds(day);

  return useQuery({
    queryKey: ["tryg-alka-sales", start, end],
    enabled,
    queryFn: async (): Promise<TrygAlkaSale[]> => {
      // 1) Kampagner under Tryg / ALKA
      const { data: campaigns, error: campaignError } = await supabase
        .from("client_campaigns")
        .select("id, client_id, clients!inner(name)")
        .in("client_id", [TRYG_CLIENT_ID, ALKA_CLIENT_ID]);
      if (campaignError) throw campaignError;

      const campaignRows = (campaigns || []) as unknown as {
        id: string;
        clients: { name: string | null } | null;
      }[];
      const clientByCampaign = new Map<string, string>();
      for (const c of campaignRows) {
        clientByCampaign.set(c.id, c.clients?.name || "Ukendt kunde");
      }
      const campaignIds = Array.from(clientByCampaign.keys());
      if (campaignIds.length === 0) return [];

      // 2a) Spor A: salg hvor kunden står på selve salget
      const { data: salesByCampaign, error: salesError } = await supabase
        .from("sales")
        .select(SALE_FIELDS)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", start)
        .lte("sale_datetime", end);
      if (salesError) throw salesError;

      // 2b) Spor B: produkter under Tryg/ALKA-kampagner
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id, client_campaign_id")
        .in("client_campaign_id", campaignIds);
      if (productError) throw productError;

      const campaignByProduct = new Map<string, string>();
      for (const p of products || []) {
        if (p.client_campaign_id) campaignByProduct.set(p.id, p.client_campaign_id);
      }

      // 3) Salgslinjer for spor A (via sale_id) og spor B (via product_id + dato)
      const saleById = new Map<string, SaleRow>();
      for (const s of (salesByCampaign || []) as SaleRow[]) saleById.set(s.id, s);

      const items = new Map<string, ItemRow>();

      const saleIdChunks = chunk(Array.from(saleById.keys()));
      const productIdChunks = chunk(Array.from(campaignByProduct.keys()));

      const itemResults = await Promise.all([
        ...saleIdChunks.map((ids) =>
          supabase.from("sale_items").select(ITEM_FIELDS).in("sale_id", ids)
        ),
        ...productIdChunks.map((ids) =>
          supabase
            .from("sale_items")
            .select(`${ITEM_FIELDS}, sales!inner(sale_datetime)`)
            .in("product_id", ids)
            .gte("sales.sale_datetime", start)
            .lte("sales.sale_datetime", end)
        ),
      ]);
      for (const res of itemResults) {
        if (res.error) throw res.error;
        for (const r of (res.data || []) as unknown as ItemRow[]) {
          if (!items.has(r.id)) items.set(r.id, r);
        }
      }
      if (items.size === 0) return [];

      // 4) Manglende salgsdata for spor B hentes særskilt
      const missingSaleIds = Array.from(
        new Set(
          Array.from(items.values())
            .map((i) => i.sale_id)
            .filter((id) => !saleById.has(id))
        )
      );
      if (missingSaleIds.length > 0) {
        const extra = await Promise.all(
          chunk(missingSaleIds).map((ids) =>
            supabase.from("sales").select(SALE_FIELDS).in("id", ids)
          )
        );
        for (const res of extra) {
          if (res.error) throw res.error;
          for (const s of (res.data || []) as SaleRow[]) saleById.set(s.id, s);
        }
      }

      // 5) Sælgernavne via work_email (samme logik som Kanvas-visningen)
      const rows = Array.from(items.values()).filter((i) => saleById.has(i.sale_id));
      const emails = Array.from(
        new Set(
          rows
            .map((r) => saleById.get(r.sale_id)?.agent_email?.toLowerCase())
            .filter(Boolean) as string[]
        )
      );
      const nameByEmail = new Map<string, string>();
      if (emails.length > 0) {
        const { data: employees } = await supabase
          .from("employee_master_data")
          .select("first_name, last_name, work_email")
          .in("work_email", emails);
        for (const e of employees || []) {
          const email = (e.work_email || "").toLowerCase();
          const name = [e.first_name, e.last_name].filter(Boolean).join(" ").trim();
          if (email && name) nameByEmail.set(email, name);
        }
      }

      return rows
        .map((r) => {
          const sale = saleById.get(r.sale_id)!;
          const email = (sale.agent_email || "").toLowerCase();
          const saleCamp = sale.client_campaign_id;
          const prodCamp = r.product_id ? campaignByProduct.get(r.product_id) : undefined;
          const clientName =
            (saleCamp ? clientByCampaign.get(saleCamp) : undefined) ||
            (prodCamp ? clientByCampaign.get(prodCamp) : undefined) ||
            "Ukendt kunde";
          return {
            saleId: sale.id,
            saleItemId: r.id,
            saleDatetime: sale.sale_datetime,
            sellerName:
              nameByEmail.get(email) ||
              sale.agent_name ||
              sale.agent_email ||
              "Ukendt",
            customerPhone: sale.customer_phone || null,
            quantity: Number(r.quantity ?? 0),
            productName: r.products?.name || "Ukendt produkt",
            clientName,
            mappedCommission: Number(r.mapped_commission ?? 0),
            mappedRevenue: Number(r.mapped_revenue ?? 0),
          };
        })
        .sort((a, b) => b.saleDatetime.localeCompare(a.saleDatetime));
    },
  });
}
