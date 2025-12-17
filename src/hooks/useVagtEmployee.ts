import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface VagtEmployee {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  team: string | null; // Maps to department field
  job_title?: string | null;
}

export function useVagtEmployee() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["vagt-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;

      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email, private_phone, is_active, department, job_title")
        .or(`private_email.eq.${user.email},work_email.eq.${user.email}`)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        id: data.id,
        full_name: `${data.first_name} ${data.last_name}`,
        email: data.private_email,
        phone: data.private_phone,
        is_active: data.is_active ?? true,
        team: data.department, // Use department as team
        job_title: data.job_title,
      } as VagtEmployee;
    },
    enabled: !!user,
  });
}

export function useVagtEmployees() {
  return useQuery({
    queryKey: ["vagt-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email, private_phone, is_active, department")
        .eq("job_title", "Fieldmarketing")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      
      return (data || []).map(emp => ({
        id: emp.id,
        full_name: `${emp.first_name} ${emp.last_name}`,
        email: emp.private_email,
        phone: emp.private_phone,
        is_active: emp.is_active ?? true,
        team: emp.department, // Use department as team
      })) as VagtEmployee[];
    },
  });
}
