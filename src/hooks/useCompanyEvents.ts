/**
 * Fælles begivenheds-logik for forsiden og Pulsen.
 * Flyttet uændret fra src/pages/Home.tsx (samme forespørgsler, query-keys og toasts),
 * så tilmelding ét sted altid ses det andet sted.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type AttendanceStatus = "attending" | "maybe" | "not_attending";

export interface NewCompanyEvent {
  title: string;
  event_date: string;
  event_time: string;
  location: string;
  description: string;
  show_popup: boolean;
  requires_registration: boolean;
  invited_teams: string[];
}

export const EMPTY_NEW_EVENT: NewCompanyEvent = {
  title: "",
  event_date: "",
  event_time: "",
  location: "",
  description: "",
  show_popup: false,
  requires_registration: false,
  invited_teams: [],
};

/** Kommende begivenheder (de næste 5) – samme visning som forsiden altid har haft. */
export function useUpcomingCompanyEvents() {
  return useQuery({
    queryKey: ["home-company-events"],
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await supabase
        .from("company_events")
        .select("*")
        .gte("event_date", today)
        .order("event_date", { ascending: true })
        .limit(5);
      return data || [];
    },
    staleTime: 60000,
  });
}

export function useEventAttendees(eventIds: string[]) {
  return useQuery({
    queryKey: ["event-attendees", eventIds],
    queryFn: async () => {
      if (eventIds.length === 0) return [];
      const { data } = await supabase
        .from("event_attendees")
        .select(`
          *,
          employee:employee_id(id, first_name, last_name)
        `)
        .in("event_id", eventIds);
      return data || [];
    },
    enabled: eventIds.length > 0,
    staleTime: 30000,
  });
}

export function useToggleEventAttendance(employeeId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: AttendanceStatus }) => {
      if (!employeeId) throw new Error("Ikke logget ind");
      const { error } = await supabase
        .from("event_attendees")
        .upsert(
          { event_id: eventId, employee_id: employeeId, status },
          { onConflict: "event_id,employee_id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-attendees"] });
      toast.success("Din deltagelse er opdateret");
    },
    onError: () => {
      toast.error("Kunne ikke opdatere deltagelse");
    },
  });
}

export function useAddCompanyEvent(createdBy: string | null | undefined, onCreated?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (event: NewCompanyEvent) => {
      const { data: createdEvent, error } = await supabase
        .from("company_events")
        .insert({
          title: event.title,
          event_date: event.event_date,
          event_time: event.event_time || null,
          location: event.location || null,
          description: event.description || null,
          show_popup: event.show_popup,
          requires_registration: event.requires_registration,
          created_by: createdBy,
        })
        .select()
        .single();
      if (error) throw error;

      if (event.invited_teams.length > 0 && createdEvent) {
        const { error: invError } = await supabase
          .from("event_team_invitations")
          .insert(event.invited_teams.map((teamId) => ({ event_id: createdEvent.id, team_id: teamId })));
        if (invError) throw invError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-company-events"] });
      onCreated?.();
      toast.success("Begivenhed tilføjet");
    },
    onError: () => {
      toast.error("Kunne ikke tilføje begivenhed");
    },
  });
}

export function useDeleteCompanyEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("company_events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-company-events"] });
      toast.success("Begivenhed slettet");
    },
  });
}
