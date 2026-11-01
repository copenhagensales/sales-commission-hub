import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentEmployeeId } from "@/hooks/useCurrentEmployeeId";
import type { FiberType, FiberVariant } from "@/lib/tdcFiber";

const KEY_ACCESS = "tdc-fiber-access";
const KEY_MINE = "tdc-fiber-mine-salg";

export interface FiberAdgang { employee_id: string; rolle: "saelger" | "admin"; navn: string }

/** Hele adgangslisten (kun id + rolle) beriget med navn på aktive kolleger. */
export function useTdcFiberAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [KEY_ACCESS, user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<FiberAdgang[]> => {
      const { data, error } = await supabase.from("tdc_fiber_access").select("employee_id, rolle");
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.employee_id);
      const navne = new Map<string, string>();
      if (ids.length) {
        const { data: emps } = await supabase.from("employee_master_data").select("id, first_name, last_name").in("id", ids);
        for (const e of emps ?? []) navne.set(e.id, `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim());
      }
      return (data ?? []).map((r) => ({ employee_id: r.employee_id, rolle: r.rolle as FiberAdgang["rolle"], navn: navne.get(r.employee_id) ?? "Ukendt" }));
    },
  });
}

/** Min rolle på listen (null = ikke på listen). */
export function useMinFiberRolle() {
  const { data: mitId } = useCurrentEmployeeId();
  const q = useTdcFiberAccess();
  const rolle = q.data?.find((r) => r.employee_id === mitId)?.rolle ?? null;
  return { rolle, mitId: mitId ?? null, isLoading: q.isLoading };
}

export interface Kollega { id: string; navn: string; team: string }

/** Aktive medarbejdere i teams Relatel og TDC Erhverv (leadgivere og kandidater til listen). */
export function useFiberKolleger(enabled = true) {
  return useQuery({
    queryKey: ["tdc-fiber-kolleger"],
    enabled,
    staleTime: 300000,
    queryFn: async (): Promise<Kollega[]> => {
      const { data, error } = await supabase
        .from("team_members")
        .select("employee_id, teams!inner(name), employee_master_data!inner(id, first_name, last_name, is_active)")
        .in("teams.name", ["Relatel", "TDC Erhverv"])
        .eq("employee_master_data.is_active", true);
      if (error) throw error;
      type Row = { employee_id: string; teams: { name: string }; employee_master_data: { first_name: string | null; last_name: string | null } };
      return ((data ?? []) as unknown as Row[])
        .map((r) => ({ id: r.employee_id, team: r.teams.name, navn: `${r.employee_master_data.first_name ?? ""} ${r.employee_master_data.last_name ?? ""}`.trim() }))
        .sort((a, b) => a.team.localeCompare(b.team, "da") || a.navn.localeCompare(b.navn, "da"));
    },
  });
}

export function useAendrFiberAdgang() {
  const qc = useQueryClient();
  const { data: mitId } = useCurrentEmployeeId();
  return useMutation({
    retry: 0,
    mutationFn: async (a: { handling: "tilfoej" | "fjern"; employeeId: string }) => {
      if (a.handling === "tilfoej") {
        const { error } = await supabase.from("tdc_fiber_access").insert({ employee_id: a.employeeId, rolle: "saelger", created_by: mitId ?? null });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tdc_fiber_access").delete().eq("employee_id", a.employeeId).eq("rolle", "saelger");
        if (error) throw error;
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [KEY_ACCESS] }),
  });
}

export interface FiberSalgInput {
  salgId: string; leadSalgId: string | null; type: FiberType; variant: FiberVariant;
  mobilevoice: boolean; cvr: string; leadgiverId: string | null;
}

export function useOpretFiberSalg() {
  const qc = useQueryClient();
  return useMutation({
    retry: 0,
    mutationFn: async (i: FiberSalgInput) => {
      const { data, error } = await supabase.rpc("tdc_fiber_opret_salg", {
        p_salg_id: i.salgId, p_lead_salg_id: i.leadSalgId as string, p_type: i.type, p_variant: i.variant,
        p_mobilevoice: i.mobilevoice, p_cvr: i.cvr, p_leadgiver: i.leadgiverId as string,
      });
      if (error) throw error;
      return (data as { status?: string } | null)?.status ?? "ukendt";
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [KEY_MINE] }),
  });
}

export interface MitFiberSalg { id: string; tid: string; rolle: string; navn: string | null; produkt: string | null; provision: number }

/** Salg jeg har tastet i dag (mine og de leaddele, jeg har registreret). */
export function useMineFiberSalgIDag(enabled = true) {
  return useQuery({
    queryKey: [KEY_MINE],
    enabled,
    queryFn: async (): Promise<MitFiberSalg[]> => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_datetime, agent_name, raw_payload, sale_items(display_name, mapped_commission)")
        .eq("source", "tdc_fiber_manual")
        .gte("sale_datetime", start.toISOString())
        .order("sale_datetime", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((s) => {
        const rp = (s.raw_payload ?? {}) as { rolle?: string };
        const item = s.sale_items?.[0];
        return { id: s.id, tid: s.sale_datetime, rolle: rp.rolle ?? "", navn: s.agent_name, produkt: item?.display_name ?? null, provision: Number(item?.mapped_commission ?? 0) };
      });
    },
  });
}
