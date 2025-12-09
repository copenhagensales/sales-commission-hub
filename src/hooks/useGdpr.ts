import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useGdprConsents() {
  const { user } = useAuth();

  // Use the same RPC function as useGiveConsent for consistency
  const { data: employeeId } = useQuery({
    queryKey: ["current-employee-id-gdpr-rpc", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_employee_id");
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  return useQuery({
    queryKey: ["gdpr-consents", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data, error } = await supabase
        .from("gdpr_consents")
        .select("*")
        .eq("employee_id", employeeId)
        .is("revoked_at", null)
        .order("consented_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId,
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

      // Check if consent already exists
      const { data: existingConsent } = await supabase
        .from("gdpr_consents")
        .select("id")
        .eq("employee_id", employeeData)
        .eq("consent_type", consentType)
        .is("revoked_at", null)
        .limit(1)
        .maybeSingle();

      // If consent already exists, just return without inserting
      if (existingConsent) {
        return;
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
