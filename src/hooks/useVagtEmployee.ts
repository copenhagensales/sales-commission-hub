import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface VagtEmployee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: "admin" | "planner" | "employee" | "brand_viewer" | null;
  availability_notes: string | null;
  is_active: boolean;
  team: string | null;
}

export function useVagtEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["vagt-employee", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from("employee")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data as VagtEmployee | null;
    },
    enabled: !!user,
  });
}

export function useVagtEmployees() {
  return useQuery({
    queryKey: ["vagt-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee")
        .select("*")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      return data as VagtEmployee[];
    },
  });
}
