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

/**
 * Alle salg på produkter under kunderne Tryg og ALKA for én dag, nyeste først.
 * Ren læsning — bruges kun til visningen på "Tryg - Ret salg".
 */
export function useTrygAlkaSales(day: Date, enabled = true) {
  const { start, end } = dayBounds(day);

  return useQuery({
    queryKey: ["tryg-alka-sales", start, end],
    enabled,
    queryFn: async (): Promise<TrygAlkaSale[]> => {
      // 1) Produkter der hører til Tryg / ALKA
      const { data: products, error: productError } = await supabase
        .from("products")
        .select(
          "id, name, client_campaigns!inner(client_id, clients!inner(name))"
        )
        .in("client_campaigns.client_id", [TRYG_CLIENT_ID, ALKA_CLIENT_ID]);
      if (productError) throw productError;

      const productRows = (products || []) as unknown as {
        id: string;
        name: string | null;
        client_campaigns: { clients: { name: string | null } | null } | null;
      }[];

      const productInfo = new Map<string, { name: string; client: string }>();
      for (const p of productRows) {
        productInfo.set(p.id, {
          name: p.name || "Ukendt produkt",
          client: p.client_campaigns?.clients?.name || "Ukendt kunde",
        });
      }
      const productIds = Array.from(productInfo.keys());
      if (productIds.length === 0) return [];

      // 2) Salgslinjer på de produkter inden for dagen
      const { data, error } = await supabase
        .from("sale_items")
        .select(
          "id, product_id, quantity, mapped_commission, mapped_revenue, sales!inner(id, sale_datetime, agent_email, agent_name, customer_phone)"
        )
        .in("product_id", productIds)
        .gte("sales.sale_datetime", start)
        .lte("sales.sale_datetime", end);
      if (error) throw error;

      const rows = (data || []) as unknown as {
        id: string;
        product_id: string | null;
        quantity: number | null;
        mapped_commission: number | null;
        mapped_revenue: number | null;
        sales: {
          id: string;
          sale_datetime: string;
          agent_email: string | null;
          agent_name: string | null;
          customer_phone: string | null;
        };
      }[];

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
          const info = r.product_id ? productInfo.get(r.product_id) : undefined;
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
            productName: info?.name || "Ukendt produkt",
            clientName: info?.client || "Ukendt kunde",
            mappedCommission: Number(r.mapped_commission ?? 0),
            mappedRevenue: Number(r.mapped_revenue ?? 0),
          };
        })
        .sort((a, b) => b.saleDatetime.localeCompare(a.saleDatetime));
    },
  });
}
