import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import { toast } from "sonner";

/**
 * "Se som" — en superadmin kan se Stork gennem en anden brugers oejne.
 *
 * Der udstedes ALDRIG tokens eller sessions for andre brugere. Det er en
 * serverside laesekontekst: raekken i `admin_view_as` faar databasen til at
 * svare som maalpersonen via `effective_employee_id()` / `effective_roles()`.
 *
 * Bemaerk til den naeste der bygger noget: brug de samme hjaelpere i dine
 * databasefunktioner, ellers viser din funktion fortsat superadminens egne
 * data, mens "se som" er aktiv.
 *
 * Alle skrivninger afvises af databasen, mens "se som" er aktiv.
 */

export interface ViewAsStatus {
  active: boolean;
  id?: string;
  target_employee_id?: string;
  target_name?: string;
  started_at?: string;
  expires_at?: string;
}

export interface ViewAsCandidate {
  employee_id: string;
  name: string;
  job_title: string | null;
}

export function useViewAsStatus() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["view-as-status", user?.id],
    queryFn: async (): Promise<ViewAsStatus> => {
      const { data, error } = await supabase.rpc("view_as_status");
      if (error) return { active: false };
      return (data ?? { active: false }) as unknown as ViewAsStatus;
    },
    enabled: !!user?.id,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useViewAsCandidates(enabled: boolean) {
  return useQuery({
    queryKey: ["view-as-candidates"],
    queryFn: async (): Promise<ViewAsCandidate[]> => {
      const { data, error } = await supabase.rpc("view_as_candidates");
      if (error) throw error;
      return (Array.isArray(data) ? data : []) as unknown as ViewAsCandidate[];
    },
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

export function useStartViewAs() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { isSuperadmin } = useIsSuperadmin();

  return useMutation({
    mutationFn: async (targetEmployeeId: string) => {
      if (!user?.id || !isSuperadmin) {
        throw new Error("Kun superadmins kan bruge Se som");
      }

      // Afslut en eventuel aktiv visning foerst
      await supabase
        .from("admin_view_as")
        .update({ ended_at: new Date().toISOString() })
        .eq("admin_user_id", user.id)
        .is("ended_at", null);

      const { error } = await supabase.from("admin_view_as").insert({
        admin_user_id: user.id,
        target_employee_id: targetEmployeeId,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Du ser nu Stork som en anden bruger. Læseadgang.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke starte Se som");
    },
  });
}

export function useEndViewAs() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Ingen bruger");
      const { error } = await supabase
        .from("admin_view_as")
        .update({ ended_at: new Date().toISOString() })
        .eq("admin_user_id", user.id)
        .is("ended_at", null);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Du ser Stork som dig selv igen");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke afslutte Se som");
    },
  });
}
