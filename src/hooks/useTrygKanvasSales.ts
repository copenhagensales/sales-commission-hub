import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** "Meeting -- CPH sales Kanvas" – det eneste produkt der vises på Tryg - Ret salg. */
export const TRYG_KANVAS_PRODUCT_ID = "24664858-d4e3-4227-9d6f-727f9c29cae0";

export interface TrygKanvasSale {
  saleId: string;
  saleItemId: string;
  saleDatetime: string;
  sellerName: string;
  customerPhone: string | null;
  quantity: number;
  productName: string;
  /** Provision på salgslinjen — vises i sletnings-bekræftelsen. */
  mappedCommission: number;
  /** Omsætning på salgslinjen — vises i sletnings-bekræftelsen. */
  mappedRevenue: number;
}

function dayBounds(from: Date, to?: Date) {
  const start = new Date(from);
  start.setHours(0, 0, 0, 0);
  const end = new Date(to ?? from);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/**
 * Alle salg på Kanvas-produktet, nyeste først.
 * Uden `to` hentes kun `from`-dagen; med `to` hentes hele perioden.
 */
export function useTrygKanvasSales(from: Date, to?: Date, enabled = true) {
  const { start, end } = dayBounds(from, to);

  return useQuery({
    queryKey: ["tryg-kanvas-sales", start, end],
    enabled,
    queryFn: async (): Promise<TrygKanvasSale[]> => {
      const { data, error } = await supabase
        .from("sale_items")
        .select(
          "id, quantity, mapped_commission, mapped_revenue, products(name), sales!inner(id, sale_datetime, agent_email, agent_name, customer_phone)"
        )
        .eq("product_id", TRYG_KANVAS_PRODUCT_ID)
        .gte("sales.sale_datetime", start)
        .lte("sales.sale_datetime", end);
      if (error) throw error;


      const rows = (data || []) as unknown as {
        id: string;
        quantity: number | null;
        mapped_commission: number | null;
        mapped_revenue: number | null;
        products: { name: string | null } | null;
        sales: {
          id: string;
          sale_datetime: string;
          agent_email: string | null;
          agent_name: string | null;
          customer_phone: string | null;
        };
      }[];

      // Sælgernavne via work_email
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
            mappedCommission: Number(r.mapped_commission ?? 0),
            mappedRevenue: Number(r.mapped_revenue ?? 0),
          };
        })
        .sort((a, b) => b.saleDatetime.localeCompare(a.saleDatetime));
    },
  });
}

const INVALIDATE_KEYS = [
  ["tryg-kanvas-sales"],
  ["tryg-sale-reviews"],
  ["sales-aggregates"],
];

/** Sletter en salgsregistrering (hard delete på sales-rækken). */
export function useDeleteTrygKanvasSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase.from("sales").delete().eq("id", saleId);
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of INVALIDATE_KEYS) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/**
 * Sletter en eksplicit liste af salg (hard delete). Bruges kun til de afviste
 * Kanvas-salg på "Tryg - Ret salg" — id'erne kommer altid fra den viste liste.
 */
export function useDeleteTrygKanvasSales() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleIds: string[]) => {
      const ids = Array.from(new Set(saleIds.filter(Boolean)));
      if (ids.length === 0) throw new Error("Ingen salg valgt til sletning.");

      // Batches så URL'en ikke bliver for lang ved store perioder.
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        const { error } = await supabase.from("sales").delete().in("id", batch);
        if (error) throw error;
      }
      return ids.length;
    },
    onSuccess: () => {
      for (const key of INVALIDATE_KEYS) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}
