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

export interface TdcOppGroup {
  /** OPP-nummer, eller "" hvis salget mangler OPP. */
  opp: string;
  saleIds: string[];
  sellerName: string;
  saleDatetime: string;
  products: TdcOppProduct[];
}

interface SaleRow {
  id: string;
  sale_datetime: string;
  agent_email: string | null;
  agent_name: string | null;
  raw_payload: any;
  sale_items: { quantity: number | null; products: { name: string | null } | null }[] | null;
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
          "id, sale_datetime, agent_email, agent_name, raw_payload, client_campaigns!inner(client_id), sale_items(quantity, products(name))"
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
          };
          groups.set(key, group);
        }

        group.saleIds.push(row.id);
        if (row.sale_datetime > group.saleDatetime) group.saleDatetime = row.sale_datetime;

        for (const item of row.sale_items || []) {
          const name = item.products?.name || "Ukendt produkt";
          const quantity = item.quantity ?? 0;
          const existing = group.products.find((p) => p.name === name);
          if (existing) existing.quantity += quantity;
          else group.products.push({ name, quantity });
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
