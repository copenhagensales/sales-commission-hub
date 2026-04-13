import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EmployeeClientAssignment {
  id: string;
  employee_id: string;
  client_id: string;
  created_at: string;
}

export function useEmployeeClientAssignments(filters?: {
  employeeId?: string;
  clientId?: string;
  teamId?: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const queryKey = ["employee-client-assignments", filters];

  const { data: assignments, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      let query = supabase
        .from("employee_client_assignments")
        .select("*")
        .order("created_at", { ascending: false });

      if (filters?.employeeId) {
        query = query.eq("employee_id", filters.employeeId);
      }
      if (filters?.clientId) {
        query = query.eq("client_id", filters.clientId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmployeeClientAssignment[];
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (params: { employeeId: string; clientId: string }) => {
      const { error } = await supabase
        .from("employee_client_assignments")
        .insert({ employee_id: params.employeeId, client_id: params.clientId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-client-assignments"] });
      toast({ title: "Medarbejder tildelt kunde" });
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast({ title: "Allerede tildelt", description: "Medarbejderen er allerede tildelt denne kunde", variant: "destructive" });
      } else {
        toast({ title: "Fejl", description: "Kunne ikke tildele medarbejder", variant: "destructive" });
      }
    },
  });

  const unassignMutation = useMutation({
    mutationFn: async (params: { employeeId: string; clientId: string }) => {
      const { error } = await supabase
        .from("employee_client_assignments")
        .delete()
        .eq("employee_id", params.employeeId)
        .eq("client_id", params.clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-client-assignments"] });
      toast({ title: "Tildeling fjernet" });
    },
    onError: () => {
      toast({ title: "Fejl", description: "Kunne ikke fjerne tildeling", variant: "destructive" });
    },
  });

  const bulkAssignMutation = useMutation({
    mutationFn: async (params: { employeeId: string; clientIds: string[] }) => {
      const rows = params.clientIds.map((clientId) => ({
        employee_id: params.employeeId,
        client_id: clientId,
      }));
      const { error } = await supabase
        .from("employee_client_assignments")
        .upsert(rows, { onConflict: "employee_id,client_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-client-assignments"] });
      toast({ title: "Tildelinger opdateret" });
    },
    onError: () => {
      toast({ title: "Fejl", description: "Kunne ikke opdatere tildelinger", variant: "destructive" });
    },
  });

  return {
    assignments: assignments ?? [],
    isLoading,
    assign: assignMutation.mutate,
    unassign: unassignMutation.mutate,
    bulkAssign: bulkAssignMutation.mutate,
    isAssigning: assignMutation.isPending,
    isUnassigning: unassignMutation.isPending,
  };
}
