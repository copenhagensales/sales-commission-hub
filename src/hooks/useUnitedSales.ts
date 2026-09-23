import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TrygKanvasSale } from "@/hooks/useTrygKanvasSales";

/** Antal id'er pr. forespørgsel, så URL'en ikke bliver for lang. */
const CHUNK = 200;

export interface UnitedSale extends TrygKanvasSale {
  clientName: string;
  /** Produkt på salgslinjen — bruges af "Ret"-boksen. */
  productId: string | null;
  /** Sælgerens e-mail på salget — bruges af "Ret"-boksen. */
  agentEmail: string | null;
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

/** Kunderne tilknyttet teamet United (samme kilde som United-dashboardet). */
export function useUnitedTeamClients() {
  return useQuery({
    queryKey: ["united-team-clients"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("id")
        .ilike("name", "%united%")
        .maybeSingle();
      if (teamError) throw teamError;
      if (!team) return [] as { id: string; name: string }[];

      const { data, error } = await supabase
        .from("team_clients")
        .select("client_id, clients(id, name)")
        .eq("team_id", team.id);
      if (error) throw error;

      const rows = (data || []) as unknown as {
        clients: { id: string; name: string | null } | null;
      }[];
      return rows
        .map((r) => r.clients)
        .filter(Boolean)
        .map((c) => ({ id: c!.id, name: c!.name || "Ukendt kunde" }));
    },
  });
}

/** Kampagner (med kundenavn) under teamet Uniteds kunder. */
export function useUnitedCampaigns(enabled = true) {
  const { data: clients } = useUnitedTeamClients();
  const clientIds = (clients || []).map((c) => c.id);

  return useQuery({
    queryKey: ["united-campaigns", clientIds],
    enabled: enabled && clientIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_campaigns")
        .select("id, client_id, clients!inner(name)")
        .in("client_id", clientIds);
      if (error) throw error;

      const rows = (data || []) as unknown as {
        id: string;
        clients: { name: string | null } | null;
      }[];
      const clientByCampaign = new Map<string, string>();
      for (const c of rows) {
        clientByCampaign.set(c.id, c.clients?.name || "Ukendt kunde");
      }
      return clientByCampaign;
    },
  });
}

/**
 * Alle salg på teamet Uniteds kunder for én dag, nyeste først.
 * Kunden kan sidde på salget (typisk) eller på produktets kampagne — begge spor
 * hentes i trin, samme mønster som `useTrygAlkaSales`.
 */
export function useUnitedSales(day: Date, enabled = true) {
  const { start, end } = dayBounds(day);
  const { data: clientByCampaign } = useUnitedCampaigns(enabled);
  const campaignIds = Array.from(clientByCampaign?.keys() ?? []);

  return useQuery({
    queryKey: ["united-sales", start, end, campaignIds],
    enabled: enabled && campaignIds.length > 0,
    queryFn: async (): Promise<UnitedSale[]> => {
      const campaignNames = clientByCampaign!;

      // Spor A: salg hvor kunden står på selve salget
      const { data: salesByCampaign, error: salesError } = await supabase
        .from("sales")
        .select(SALE_FIELDS)
        .in("client_campaign_id", campaignIds)
        .gte("sale_datetime", start)
        .lte("sale_datetime", end);
      if (salesError) throw salesError;

      // Spor B: produkter under Uniteds kampagner
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id, client_campaign_id")
        .in("client_campaign_id", campaignIds);
      if (productError) throw productError;

      const campaignByProduct = new Map<string, string>();
      for (const p of products || []) {
        if (p.client_campaign_id) campaignByProduct.set(p.id, p.client_campaign_id);
      }

      // Spor B-salg: dagens salg uden kunde på salget — produktets kampagne afgør
      const { data: salesWithoutCampaign, error: noCampaignError } = await supabase
        .from("sales")
        .select(SALE_FIELDS)
        .is("client_campaign_id", null)
        .gte("sale_datetime", start)
        .lte("sale_datetime", end);
      if (noCampaignError) throw noCampaignError;

      const saleById = new Map<string, SaleRow>();
      for (const s of (salesByCampaign || []) as SaleRow[]) saleById.set(s.id, s);
      const unmappedSaleIds = ((salesWithoutCampaign || []) as SaleRow[]).map(
        (s) => s.id
      );
      const saleByIdUnmapped = new Map<string, SaleRow>(
        ((salesWithoutCampaign || []) as SaleRow[]).map((s) => [s.id, s])
      );

      const items = new Map<string, ItemRow>();
      const itemResults = await Promise.all(
        chunk([...saleById.keys(), ...unmappedSaleIds]).map((ids) =>
          supabase.from("sale_items").select(ITEM_FIELDS).in("sale_id", ids)
        )
      );
      for (const res of itemResults) {
        if (res.error) throw res.error;
        for (const r of (res.data || []) as unknown as ItemRow[]) {
          // Salg uden kunde tælles kun med hvis produktet hører til United
          const belongsViaProduct =
            r.product_id != null && campaignByProduct.has(r.product_id);
          if (!saleById.has(r.sale_id) && !belongsViaProduct) continue;
          if (!saleById.has(r.sale_id)) {
            const s = saleByIdUnmapped.get(r.sale_id);
            if (s) saleById.set(s.id, s);
          }
          if (!items.has(r.id)) items.set(r.id, r);
        }
      }
      if (items.size === 0) return [];

      // Sælgernavne via work_email
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
            (saleCamp ? campaignNames.get(saleCamp) : undefined) ||
            (prodCamp ? campaignNames.get(prodCamp) : undefined) ||
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
            productId: r.product_id,
            agentEmail: sale.agent_email,
            mappedCommission: Number(r.mapped_commission ?? 0),
            mappedRevenue: Number(r.mapped_revenue ?? 0),
          };
        })
        .sort((a, b) => b.saleDatetime.localeCompare(a.saleDatetime));
    },
  });
}

/** Aktive medarbejdere med arbejdsmail — sælger-vælgeren i "Ret". */
export function useActiveSellerOptions(enabled = true) {
  return useQuery({
    queryKey: ["united-seller-options"],
    enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("first_name, last_name, work_email")
        .eq("is_active", true)
        .not("work_email", "is", null)
        .order("first_name");
      if (error) throw error;
      return (data || [])
        .map((e) => ({
          email: (e.work_email || "").toLowerCase(),
          name:
            [e.first_name, e.last_name].filter(Boolean).join(" ").trim() ||
            e.work_email ||
            "Ukendt",
        }))
        .filter((e) => e.email);
    },
  });
}

/** Produkter under Uniteds kampagner — produkt-vælgeren i "Ret". */
export function useUnitedProductOptions(enabled = true) {
  const { data: clientByCampaign } = useUnitedCampaigns(enabled);
  const campaignIds = Array.from(clientByCampaign?.keys() ?? []);

  return useQuery({
    queryKey: ["united-product-options", campaignIds],
    enabled: enabled && campaignIds.length > 0,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, client_campaign_id")
        .in("client_campaign_id", campaignIds)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []).map((p) => ({
        id: p.id,
        name: p.name || "Ukendt produkt",
        clientName: p.client_campaign_id
          ? clientByCampaign?.get(p.client_campaign_id) || ""
          : "",
      }));
    },
  });
}
