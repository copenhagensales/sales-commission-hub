import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface EmployeeClientAssignment {
  id: string;
  employee_id: string;
  client_id: string;
  is_primary: boolean;
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

  // Set primary client for an employee — swaps is_primary and logs the change
  const setPrimaryMutation = useMutation({
    mutationFn: async (params: { employeeId: string; newClientId: string }) => {
      // Get current primary
      const { data: currentPrimary } = await supabase
        .from("employee_client_assignments")
        .select("id, client_id")
        .eq("employee_id", params.employeeId)
        .eq("is_primary", true)
        .maybeSingle();

      const oldClientId = currentPrimary?.client_id || null;

      // Remove old primary flag
      if (currentPrimary) {
        const { error: unsetErr } = await supabase
          .from("employee_client_assignments")
          .update({ is_primary: false })
          .eq("id", currentPrimary.id);
        if (unsetErr) throw unsetErr;
      }

      // Set new primary
      const { error: setErr } = await supabase
        .from("employee_client_assignments")
        .update({ is_primary: true })
        .eq("employee_id", params.employeeId)
        .eq("client_id", params.newClientId);
      if (setErr) throw setErr;

      // Log the change
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("employee_client_change_log").insert({
        employee_id: params.employeeId,
        old_client_id: oldClientId,
        new_client_id: params.newClientId,
        changed_by: user?.id || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-client-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["employee-client-change-log"] });
      toast({ title: "Primær kunde opdateret" });
    },
    onError: () => {
      toast({ title: "Fejl", description: "Kunne ikke skifte primær kunde", variant: "destructive" });
    },
  });

  // Add secondary client + auto-create override time clock
  const addSecondaryMutation = useMutation({
    mutationFn: async (params: { employeeId: string; clientId: string }) => {
      // Insert assignment as non-primary
      const { error: assignErr } = await supabase
        .from("employee_client_assignments")
        .insert({ employee_id: params.employeeId, client_id: params.clientId, is_primary: false });
      if (assignErr) throw assignErr;

      // Auto-create override time clock for this employee+client
      const { data: { user } } = await supabase.auth.getUser();
      const { error: clockErr } = await supabase
        .from("employee_time_clocks")
        .insert({
          employee_id: params.employeeId,
          client_id: params.clientId,
          clock_type: "override",
          hourly_rate: 0,
          created_by: user?.id || null,
        });
      // Ignore duplicate clock error (23505)
      if (clockErr && clockErr.code !== "23505") throw clockErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-client-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["employee-time-clocks"] });
      toast({ title: "Sekundær kunde tilføjet", description: "Stempelur oprettet automatisk" });
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast({ title: "Allerede tildelt", variant: "destructive" });
      } else {
        toast({ title: "Fejl", description: "Kunne ikke tilføje sekundær kunde", variant: "destructive" });
      }
    },
  });

  // Remove secondary client + auto-delete the override time clock
  const removeSecondaryMutation = useMutation({
    mutationFn: async (params: { employeeId: string; clientId: string }) => {
      // Delete assignment
      const { error: delErr } = await supabase
        .from("employee_client_assignments")
        .delete()
        .eq("employee_id", params.employeeId)
        .eq("client_id", params.clientId);
      if (delErr) throw delErr;

      // Delete auto-created time clock
      await supabase
        .from("employee_time_clocks")
        .delete()
        .eq("employee_id", params.employeeId)
        .eq("client_id", params.clientId)
        .eq("clock_type", "override");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-client-assignments"] });
      queryClient.invalidateQueries({ queryKey: ["employee-time-clocks"] });
      toast({ title: "Sekundær kunde fjernet" });
    },
    onError: () => {
      toast({ title: "Fejl", description: "Kunne ikke fjerne sekundær kunde", variant: "destructive" });
    },
  });

  return {
    assignments: assignments ?? [],
    isLoading,
    assign: assignMutation.mutate,
    unassign: unassignMutation.mutate,
    bulkAssign: bulkAssignMutation.mutate,
    setPrimary: setPrimaryMutation.mutate,
    addSecondary: addSecondaryMutation.mutate,
    removeSecondary: removeSecondaryMutation.mutate,
    isAssigning: assignMutation.isPending,
    isUnassigning: unassignMutation.isPending,
    isSettingPrimary: setPrimaryMutation.isPending,
  };
}
