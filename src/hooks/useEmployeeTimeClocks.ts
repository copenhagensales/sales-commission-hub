import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EmployeeTimeClock {
  id: string;
  employee_id: string;
  client_id: string | null;
  clock_type: "override" | "documentation" | "revenue";
  hourly_rate: number;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  project_name: string | null;
  cpo_per_hour: number;
}

export function useEmployeeTimeClocks(filters?: {
  employeeId?: string;
  clientId?: string;
  teamId?: string;
  activeOnly?: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ["employee-time-clocks", filters];

  const { data: clocks, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("employee_time_clocks")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
      }
      if (filters?.clientId) {
        query = query.eq("client_id", filters.clientId);
      }
      if (filters?.activeOnly !== false) {
        query = query.eq("is_active", true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmployeeTimeClock[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (params: {
      employeeId: string;
      clientId?: string | null;
      clockType: "override" | "documentation" | "revenue";
      hourlyRate?: number;
      projectName?: string | null;
      cpoPerHour?: number;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("employee_time_clocks").insert({
        employee_id: params.employeeId,
        client_id: params.clientId || null,
        clock_type: params.clockType,
        hourly_rate: params.hourlyRate ?? 0,
        project_name: params.projectName || null,
        cpo_per_hour: params.cpoPerHour ?? 0,
        created_by: user?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-time-clocks"] });
      toast({ title: "Stempelur oprettet" });
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast({ title: "Eksisterer allerede", description: "Der findes allerede et stempelur med denne kombination", variant: "destructive" });
      } else {
        toast({ title: "Fejl", description: "Kunne ikke oprette stempelur", variant: "destructive" });
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (params: {
      id: string;
      clockType?: "override" | "documentation" | "revenue";
      hourlyRate?: number;
      isActive?: boolean;
      projectName?: string | null;
      cpoPerHour?: number;
    }) => {
      const updates: Record<string, any> = {};
      if (params.clockType !== undefined) updates.clock_type = params.clockType;
      if (params.hourlyRate !== undefined) updates.hourly_rate = params.hourlyRate;
      if (params.isActive !== undefined) updates.is_active = params.isActive;
      if (params.projectName !== undefined) updates.project_name = params.projectName;
      if (params.cpoPerHour !== undefined) updates.cpo_per_hour = params.cpoPerHour;

      const { error } = await supabase
        .from("employee_time_clocks")
        .update(updates)
        .eq("id", params.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-time-clocks"] });
      toast({ title: "Stempelur opdateret" });
    },
    onError: () => {
      toast({ title: "Fejl", description: "Kunne ikke opdatere stempelur", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employee_time_clocks")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-time-clocks"] });
      toast({ title: "Stempelur slettet" });
    },
    onError: () => {
      toast({ title: "Fejl", description: "Kunne ikke slette stempelur", variant: "destructive" });
    },
  });

  return {
    clocks: clocks ?? [],
    isLoading,
    createClock: createMutation.mutate,
    updateClock: updateMutation.mutate,
    deleteClock: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
