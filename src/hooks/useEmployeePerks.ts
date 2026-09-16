import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PerkRedemptionType = "online" | "fysisk" | "begge";

export interface EmployeePerk {
  id: string;
  partner_name: string;
  description: string | null;
  redemption_type: PerkRedemptionType;
  discount_code: string | null;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface EmployeePerkInput {
  partner_name: string;
  description: string | null;
  redemption_type: PerkRedemptionType;
  discount_code: string | null;
  link_url: string | null;
  is_active: boolean;
  sort_order: number;
}

const PERKS_KEY = ["employee-perks"];

export function useEmployeePerks() {
  return useQuery({
    queryKey: PERKS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_perks")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("partner_name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as EmployeePerk[];
    },
    staleTime: 60_000,
  });
}

/** Kun ejere, superadmins og medlemmer af teamet Stab kan redigere. Håndhæves i databasen. */
export function useCanManagePerks() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["can-manage-employee-perks", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_manage_employee_perks", {
        _user_id: user!.id,
      });
      if (error) return false;
      return data === true;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
  });

  return { canManage: query.data === true, isLoading: query.isLoading };
}

export function useCreatePerk() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: EmployeePerkInput) => {
      const { error } = await supabase
        .from("employee_perks")
        .insert({ ...input, created_by: user?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PERKS_KEY }),
  });
}

export function useUpdatePerk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: EmployeePerkInput & { id: string }) => {
      const { error } = await supabase
        .from("employee_perks")
        .update(input)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PERKS_KEY }),
  });
}

export function useDeletePerk() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_perks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PERKS_KEY }),
  });
}
