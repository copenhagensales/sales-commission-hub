import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SecurityIncident {
  id: string;
  incident_date: string;
  title: string;
  description: string | null;
  affected_categories: string[];
  affected_count: number | null;
  reported_to_authority: boolean;
  reported_at: string | null;
  remedial_actions: string | null;
  status: string;
  severity: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useSecurityIncidents() {
  return useQuery({
    queryKey: ["security-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_incidents")
        .select("*")
        .order("incident_date", { ascending: false });
      if (error) throw error;
      return (data || []) as SecurityIncident[];
    },
  });
}

export function useCreateSecurityIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (incident: {
      title: string;
      description?: string;
      incident_date: string;
      affected_categories?: string[];
      affected_count?: number;
      severity?: string;
      remedial_actions?: string;
      reported_to_authority?: boolean;
      reported_at?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("security_incidents").insert({
        ...incident,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-incidents"] });
    },
  });
}

export function useUpdateSecurityIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SecurityIncident> & { id: string }) => {
      const { error } = await supabase
        .from("security_incidents")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security-incidents"] });
    },
  });
}
