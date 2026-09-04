import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrygKanvasSale } from "@/hooks/useTrygKanvasSales";

/** Kunderne på fanen "Alle tryg & alka salg". */
export const TRYG_CLIENT_ID = "516a3f67-ea6d-4ef0-929d-e3224cc16e22";
export const ALKA_CLIENT_ID = "0a8048ac-ac28-4999-b1a7-5d1238d7fc2c";

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

const SALES_PART =
  "sales!inner(id, sale_datetime, agent_email, agent_name, customer_phone, client_campaign_id)";
const SELECT_BY_SALE = `id, quantity, mapped_commission, mapped_revenue, products(name, client_campaign_id), ${SALES_PART}`;
const SELECT_BY_PRODUCT = `id, quantity, mapped_commission, mapped_revenue, products!inner(name, client_campaign_id), ${SALES_PART}`;

type Row = {
  id: string;
  quantity: number | null;
  mapped_commission: number | null;
  mapped_revenue: number | null;
  products: { name: string | null; client_campaign_id: string | null } | null;
  sales: {
    id: string;
    sale_datetime: string;
    agent_email: string | null;
    agent_name: string | null;
    customer_phone: string | null;
    client_campaign_id: string | null;
  };
};

/**
 * Alle salg under kunderne Tryg og ALKA for én dag, nyeste først.
 * Kunden kan sidde på salget (typisk) eller på produktets kampagne — begge spor
 * hentes og forenes. Ren læsning — bruges kun til visningen på "Tryg - Ret salg".
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

      // 2) To spor: kunden på salget, og kunden på produktets kampagne
      const [bySale, byProduct] = await Promise.all([
        supabase
          .from("sale_items")
          .select(SELECT_BY_SALE)
          .in("sales.client_campaign_id", campaignIds)
          .gte("sales.sale_datetime", start)
          .lte("sales.sale_datetime", end),
        supabase
          .from("sale_items")
          .select(SELECT_BY_PRODUCT)
          .in("products.client_campaign_id", campaignIds)
          .not("product_id", "is", null)
          .gte("sales.sale_datetime", start)
          .lte("sales.sale_datetime", end),
      ]);
      if (bySale.error) throw bySale.error;
      if (byProduct.error) throw byProduct.error;

      const byId = new Map<string, Row>();
      for (const r of (bySale.data || []) as unknown as Row[]) byId.set(r.id, r);
      for (const r of (byProduct.data || []) as unknown as Row[]) {
        // Produkt-sporet kan give rækker uden kampagne-match på produktet, når
        // PostgREST ikke filtrerer den indlejrede relation — filtrér her.
        if (!r.products?.client_campaign_id) continue;
        if (!clientByCampaign.has(r.products.client_campaign_id)) continue;
        if (!byId.has(r.id)) byId.set(r.id, r);
      }
      const rows = Array.from(byId.values()).filter((r) => {
        const saleCamp = r.sales.client_campaign_id;
        const prodCamp = r.products?.client_campaign_id;
        return (
          (saleCamp && clientByCampaign.has(saleCamp)) ||
          (prodCamp && clientByCampaign.has(prodCamp))
        );
      });
      if (rows.length === 0) return [];

      // 3) Sælgernavne via work_email (samme logik som Kanvas-visningen)
      const emails = Array.from(
        new Set(
          rows
            .map((r) => r.sales.agent_email?.toLowerCase())
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
          const email = (r.sales.agent_email || "").toLowerCase();
          const saleCamp = r.sales.client_campaign_id;
          const prodCamp = r.products?.client_campaign_id;
          const clientName =
            (saleCamp ? clientByCampaign.get(saleCamp) : undefined) ||
            (prodCamp ? clientByCampaign.get(prodCamp) : undefined) ||
            "Ukendt kunde";
          return {
            saleId: r.sales.id,
            saleItemId: r.id,
            saleDatetime: r.sales.sale_datetime,
            sellerName:
              nameByEmail.get(email) ||
              r.sales.agent_name ||
              r.sales.agent_email ||
              "Ukendt",
            customerPhone: r.sales.customer_phone || null,
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
