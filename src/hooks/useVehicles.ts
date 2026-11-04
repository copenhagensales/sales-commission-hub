import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Vehicle = Database["public"]["Tables"]["vehicle"]["Row"];
export type VehicleInput = { name: string; license_plate: string; notes: string | null };

const KEY = ["fm-vehicles-admin"];

/** Alle biler (også udgåede) til administration. */
export function useAllVehicles() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle").select("*").order("name");
      if (error) throw error;
      return data as Vehicle[];
    },
  });
}

/** Databasen afgør, om brugeren må redigere biler (samme regel som RLS). */
export function useCanManageVehicles() {
  return useQuery({
    queryKey: ["fm-vehicles-can-manage"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return false;
      const { data, error } = await supabase.rpc("is_vagt_admin_or_planner", { _user_id: auth.user.id });
      if (error) return false;
      return data === true;
    },
  });
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: KEY });
    // Opdatér "Vælg bil"-lister andre steder
    qc.invalidateQueries({ predicate: (q) => JSON.stringify(q.queryKey).toLowerCase().includes("vehicle") });
  };
}

export function useSaveVehicle() {
  const invalidate = useInvalidate();
  return useMutation({
    retry: 0,
    mutationFn: async ({ id, input }: { id?: string; input: VehicleInput }) => {
      const q = id
        ? supabase.from("vehicle").update(input).eq("id", id).select("id")
        : supabase.from("vehicle").insert({ ...input, is_active: true }).select("id");
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Du har ikke rettighed til at gemme biler.");
    },
    onSuccess: invalidate,
  });
}

export function useSetVehicleActive() {
  const invalidate = useInvalidate();
  return useMutation({
    retry: 0,
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { data, error } = await supabase.from("vehicle").update({ is_active: active }).eq("id", id).select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Du har ikke rettighed til at ændre biler.");
    },
    onSuccess: invalidate,
  });
}
