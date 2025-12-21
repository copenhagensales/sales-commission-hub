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

      const lowerEmail = user.email.toLowerCase();
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, private_email, private_phone, is_active, job_title")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      // Fetch team name for this employee
      const { data: teamMemberships } = await supabase
        .from("team_members")
        .select("team:teams(name)")
        .eq("employee_id", data.id);
      
      const teamNames = (teamMemberships || [])
        .map((tm: { team: { name: string } | null }) => tm.team?.name)
        .filter(Boolean)
        .join(", ");
      
      return {
        id: data.id,
        full_name: `${data.first_name} ${data.last_name}`,
        email: data.private_email,
        phone: data.private_phone,
        is_active: data.is_active ?? true,
        team: teamNames || null,
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
      // First get the Fieldmarketing team ID
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("id, name")
        .ilike("name", "Fieldmarketing")
        .maybeSingle();

      if (teamError) throw teamError;
      if (!teamData) return [];

      // Get all employees who are members of the Fieldmarketing team
      const { data, error } = await supabase
        .from("team_members")
        .select(`
          employee_id,
          employee:employee_id(
            id,
            first_name,
            last_name,
            private_email,
            private_phone,
            is_active
          )
        `)
        .eq("team_id", teamData.id);

      if (error) throw error;
      
      return (data || [])
        .filter(tm => tm.employee && tm.employee.is_active)
        .map(tm => ({
          id: tm.employee.id,
          full_name: `${tm.employee.first_name} ${tm.employee.last_name}`,
          email: tm.employee.private_email,
          phone: tm.employee.private_phone,
          is_active: tm.employee.is_active ?? true,
          team: teamData.name,
        })) as VagtEmployee[];
    },
  });
}
