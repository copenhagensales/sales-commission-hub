import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useGdprConsents() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["gdpr-consents", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gdpr_consents")
        .select("*")
        .is("revoked_at", null)
        .order("consented_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useHasDataProcessingConsent() {
  const { data: consents, isLoading } = useGdprConsents();
  
  const hasConsent = consents?.some(
    (c) => c.consent_type === "data_processing" && !c.revoked_at
  ) ?? false;

  return { hasConsent, isLoading };
}

export function useGiveConsent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ consentType }: { consentType: string }) => {
      // Get current employee id
      const { data: employeeData, error: empError } = await supabase
        .rpc("get_current_employee_id");
      
      if (empError || !employeeData) {
        throw new Error("Kunne ikke finde medarbejder");
      }

      const { error } = await supabase.from("gdpr_consents").insert({
        employee_id: employeeData,
        consent_type: consentType,
        ip_address: null, // Could be captured server-side
        user_agent: navigator.userAgent,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gdpr-consents"] });
    },
  });
}

export function useGdprDataRequests() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["gdpr-data-requests", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gdpr_data_requests")
        .select("*")
        .order("requested_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useRequestDataExport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Get current employee id
      const { data: employeeData, error: empError } = await supabase
        .rpc("get_current_employee_id");
      
      if (empError || !employeeData) {
        throw new Error("Kunne ikke finde medarbejder");
      }

      // Check for existing pending request
      const { data: existing } = await supabase
        .from("gdpr_data_requests")
        .select("id")
        .eq("employee_id", employeeData)
        .eq("request_type", "export")
        .eq("status", "pending")
        .single();

      if (existing) {
        throw new Error("Du har allerede en afventende eksportanmodning");
      }

      const { error } = await supabase.from("gdpr_data_requests").insert({
        employee_id: employeeData,
        request_type: "export",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gdpr-data-requests"] });
    },
  });
}

export function useRequestDataDeletion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Get current employee id
      const { data: employeeData, error: empError } = await supabase
        .rpc("get_current_employee_id");
      
      if (empError || !employeeData) {
        throw new Error("Kunne ikke finde medarbejder");
      }

      // Check for existing pending request
      const { data: existing } = await supabase
        .from("gdpr_data_requests")
        .select("id")
        .eq("employee_id", employeeData)
        .eq("request_type", "deletion")
        .eq("status", "pending")
        .single();

      if (existing) {
        throw new Error("Du har allerede en afventende sletteanmodning");
      }

      const { error } = await supabase.from("gdpr_data_requests").insert({
        employee_id: employeeData,
        request_type: "deletion",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gdpr-data-requests"] });
    },
  });
}
