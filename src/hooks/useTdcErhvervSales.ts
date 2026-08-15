import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { extractOpp } from "@/components/cancellations/utils/extractOpp";

export const TDC_ERHVERV_CLIENT_ID = "20744525-7466-4b2c-afa7-6ee09a9112b0";
export const TDC_ERHVERV_TEAM_ID = "ee967dfd-04c8-465e-bda7-f1c47094bae0";

export interface TdcOppProduct {
  name: string;
  quantity: number;
}

/** Rå salgslinje (én pr. sale_items-række) til redigering. */
export interface TdcOppItem {
  saleItemId: string;
  saleId: string;
  productId: string | null;
  productName: string;
  quantity: number;
}

export interface TdcOppGroup {
  /** OPP-nummer, eller "" hvis salget mangler OPP. */
  opp: string;
  saleIds: string[];
  sellerName: string;
  saleDatetime: string;
  products: TdcOppProduct[];
  items: TdcOppItem[];
}

interface SaleRow {
  id: string;
  sale_datetime: string;
  agent_email: string | null;
  agent_name: string | null;
  raw_payload: any;
  sale_items:
    | {
        id: string;
        quantity: number | null;
        product_id: string | null;
        products: { name: string | null } | null;
      }[]
    | null;
}


function dayBounds(day: Date) {
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(day);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** TDC Erhverv-salg for én dag, grupperet pr. OPP-nummer. */
export function useTdcErhvervSales(day: Date, enabled = true) {
  const { start, end } = dayBounds(day);

  return useQuery({
    queryKey: ["tdc-erhverv-sales", start],
    enabled,
    queryFn: async (): Promise<TdcOppGroup[]> => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id, sale_datetime, agent_email, agent_name, raw_payload, client_campaigns!inner(client_id), sale_items(id, quantity, product_id, products(name))"
        )
        .eq("client_campaigns.client_id", TDC_ERHVERV_CLIENT_ID)
        .gte("sale_datetime", start)
        .lte("sale_datetime", end)
        .order("sale_datetime", { ascending: false });
      if (error) throw error;

      const rows = (data || []) as unknown as SaleRow[];

      // Sælgernavne via work_email
      const emails = Array.from(
        new Set(rows.map((r) => r.agent_email?.toLowerCase()).filter(Boolean) as string[])
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

      const groups = new Map<string, TdcOppGroup>();

      for (const row of rows) {
        const opp = extractOpp(row.raw_payload);
        const key = opp || `__no_opp__${row.id}`;
        const email = (row.agent_email || "").toLowerCase();
        const sellerName =
          nameByEmail.get(email) || row.agent_name || row.agent_email || "Ukendt";

        let group = groups.get(key);
        if (!group) {
          group = {
            opp,
            saleIds: [],
            sellerName,
            saleDatetime: row.sale_datetime,
            products: [],
            items: [],
          };
          groups.set(key, group);
        }

        group.saleIds.push(row.id);
        if (row.sale_datetime > group.saleDatetime) group.saleDatetime = row.sale_datetime;

        for (const item of row.sale_items || []) {
          const name = item.products?.name || "Ukendt produkt";
          const quantity = Number(item.quantity ?? 0);
          const existing = group.products.find((p) => p.name === name);
          if (existing) existing.quantity += quantity;
          else group.products.push({ name, quantity });

          group.items.push({
            saleItemId: item.id,
            saleId: row.id,
            productId: item.product_id,
            productName: name,
            quantity,
          });
        }
      }


      return Array.from(groups.values())
        .map((g) => ({
          ...g,
          products: g.products.sort((a, b) => a.name.localeCompare(b.name, "da")),
        }))
        .sort((a, b) => b.saleDatetime.localeCompare(a.saleDatetime));
    },
  });
}

export interface TdcProductOption {
  id: string;
  name: string;
}

/** Aktive TDC Erhverv-produkter til valg i redigeringsdialogen. */
export function useTdcErhvervProducts(enabled = true) {
  return useQuery({
    queryKey: ["tdc-erhverv-products"],
    enabled,
    staleTime: 10 * 60 * 1000,
    queryFn: async (): Promise<TdcProductOption[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, client_campaigns!inner(client_id)")
        .eq("client_campaigns.client_id", TDC_ERHVERV_CLIENT_ID)
        .eq("is_active", true)
        .eq("is_hidden", false)
        .is("merged_into_product_id", null)
        .order("name");
      if (error) throw error;
      return (data || []).map((p: any) => ({ id: p.id, name: p.name as string }));
    },
  });
}

export interface TdcOppEditLine {
  /** Findes kun for eksisterende salgslinjer. */
  saleItemId?: string;
  saleId?: string;
  productId: string;
  quantity: number;
}

export interface UpdateTdcErhvervOppInput {
  saleIds: string[];
  /** Primær salgsrække, som nye produktlinjer oprettes på. */
  primarySaleId: string;
  originalOpp: string;
  opp: string;
  lines: TdcOppEditLine[];
  removedSaleItemIds: string[];
}

/** Retter OPP-nummer, produkter og antal – og genberegner provision/omsætning. */
export function useUpdateTdcErhvervOpp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateTdcErhvervOppInput) => {
      // 1. OPP-nummer på alle salgsrækker i gruppen
      const newOpp = input.opp.trim();
      if (newOpp && newOpp !== input.originalOpp) {
        const { data: salesRows, error: salesError } = await supabase
          .from("sales")
          .select("id, raw_payload")
          .in("id", input.saleIds);
        if (salesError) throw salesError;

        for (const row of salesRows || []) {
          const payload = ((row.raw_payload as any) || {}) as Record<string, any>;
          const fields = { ...((payload.leadResultFields as Record<string, any>) || {}) };
          fields["OPP nr"] = newOpp;
          const { error } = await supabase
            .from("sales")
            .update({ raw_payload: { ...payload, leadResultFields: fields } })
            .eq("id", row.id);
          if (error) throw error;
        }
      }

      // 2. Slettede produktlinjer
      if (input.removedSaleItemIds.length > 0) {
        const { error } = await supabase
          .from("sale_items")
          .delete()
          .in("id", input.removedSaleItemIds);
        if (error) throw error;
      }

      // Produktnavne til adversus_product_title
      const productIds = Array.from(new Set(input.lines.map((l) => l.productId)));
      const nameById = new Map<string, string>();
      if (productIds.length > 0) {
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .in("id", productIds);
        for (const p of products || []) nameById.set(p.id, p.name as string);
      }

      // 3. Opdater eksisterende og opret nye linjer
      for (const line of input.lines) {
        const title = nameById.get(line.productId) || null;
        if (line.saleItemId) {
          const { error } = await supabase
            .from("sale_items")
            .update({
              product_id: line.productId,
              quantity: line.quantity,
              adversus_product_title: title,
              needs_mapping: false,
            })
            .eq("id", line.saleItemId);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("sale_items").insert({
            sale_id: line.saleId || input.primarySaleId,
            product_id: line.productId,
            quantity: line.quantity,
            adversus_product_title: title,
            needs_mapping: false,
          });
          if (error) throw error;
        }
      }

      // 4. Genberegn provision/omsætning
      await supabase.functions.invoke("rematch-pricing-rules", {
        body: { sale_ids: input.saleIds },
      });

      // 5. Advarsel hvis nogen linjer ender uden provision
      const { data: after } = await supabase
        .from("sale_items")
        .select("mapped_commission")
        .in("sale_id", input.saleIds);
      const zeroCommission = (after || []).filter(
        (i) => !i.mapped_commission || Number(i.mapped_commission) === 0
      ).length;

      return { zeroCommission };
    },
    onSuccess: () => {
      for (const key of [
        ["tdc-erhverv-sales"],
        ["sales-aggregates"],
        ["fm-sales-edit"],
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}


/** Sletter alle salgsrækker under et OPP-nummer (hard delete). */
export function useDeleteTdcErhvervOpp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (saleIds: string[]) => {
      if (saleIds.length === 0) return;
      const { error } = await supabase.from("sales").delete().in("id", saleIds);
      if (error) throw error;
    },
    onSuccess: () => {
      for (const key of [
        ["tdc-erhverv-sales"],
        ["sales-aggregates"],
        ["fm-sales-edit"],
      ]) {
        queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });
}

/**
 * True hvis brugeren er ejer/ledelse, eller medlem af TDC Erhverv-teamet
 * (leder og assisterende leder er medlemmer af teamet).
 */
export function useIsTdcErhvervLeader() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["is-tdc-erhverv-leader", user?.email],
    enabled: !!user?.email,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      if (!user?.email) return false;
      const lowerEmail = user.email.toLowerCase();

      const { data: employee } = await supabase
        .from("employee_master_data")
        .select("id, auth_user_id")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();

      if (employee?.auth_user_id) {
        const { data: isOwner } = await supabase.rpc("is_owner", {
          _user_id: employee.auth_user_id,
        });
        if (isOwner) return true;
      }

      if (!employee) return false;

      const { data: memberships } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("employee_id", employee.id);

      return (memberships ?? []).some((m) => m.team_id === TDC_ERHVERV_TEAM_ID);
    },
  });
}
