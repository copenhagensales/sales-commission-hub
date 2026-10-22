import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { PartyPopper, Calendar, MapPin, ThumbsUp, ThumbsDown, Clock, HelpCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EventInvitationPopupProps {
  employeeId: string | undefined;
  teamId: string | undefined;
}

interface PendingInvitation {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  description: string | null;
}

export function EventInvitationPopup({ employeeId, teamId }: EventInvitationPopupProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  // Fetch pending invitations for the employee's team
  const { data: pendingInvitations = [] } = useQuery({
    queryKey: ["pending-event-invitations", employeeId, teamId],
    queryFn: async () => {
      if (!employeeId || !teamId) return [];
      
      const today = new Date().toISOString().split("T")[0];
      
      // Get events with popup enabled that are invited to the employee's team
      const { data: invitedEvents } = await supabase
        .from("event_team_invitations")
        .select(`
          event_id,
          company_events!inner(
            id,
            title,
            event_date,
            event_time,
            location,
            description,
            show_popup
          )
        `)
        .eq("team_id", teamId);
      
      if (!invitedEvents || invitedEvents.length === 0) return [];
      
      // Filter to only events with show_popup = true and future dates
      const eventsWithPopup = invitedEvents
        .filter(inv => {
          const event = inv.company_events as any;
          return event?.show_popup === true && event?.event_date >= today;
        })
        .map(inv => inv.company_events as PendingInvitation);
      
      if (eventsWithPopup.length === 0) return [];
      
      // Check which ones the employee has already seen
      const eventIds = eventsWithPopup.map(e => e.id);
      const { data: viewedEvents } = await supabase
        .from("event_invitation_views")
        .select("event_id")
        .eq("employee_id", employeeId)
        .in("event_id", eventIds);
      
      const viewedIds = new Set(viewedEvents?.map(v => v.event_id) || []);
      
      // Return only unseen events
      return eventsWithPopup.filter(e => !viewedIds.has(e.id));
    },
    enabled: !!employeeId && !!teamId,
    staleTime: 60000,
  });

  // Show popup when there are pending invitations
  useEffect(() => {
    if (pendingInvitations.length > 0 && currentIndex < pendingInvitations.length) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [pendingInvitations, currentIndex]);

  // Mutation to mark invitation as seen
  const markSeenMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!employeeId) throw new Error("No employee ID");
      
      const { error } = await supabase
        .from("event_invitation_views")
        .insert({
          event_id: eventId,
          employee_id: employeeId,
        });
      
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-event-invitations"] });
    },
  });

  // Mutation to set attendance
  const attendMutation = useMutation({
    mutationFn: async ({ eventId, status }: { eventId: string; status: 'attending' | 'maybe' | 'not_attending' }) => {
      if (!employeeId) throw new Error("No employee ID");
      
      const { error } = await supabase
        .from("event_attendees")
        .upsert({
          event_id: eventId,
          employee_id: employeeId,
          status: status,
        }, { onConflict: 'event_id,employee_id' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-attendees"] });
    },
  });

  const handleAttend = async () => {
    const event = pendingInvitations[currentIndex];
    if (!event) return;
    
    try {
      await attendMutation.mutateAsync({ eventId: event.id, status: 'attending' });
      await markSeenMutation.mutateAsync(event.id);
      toast.success("Du deltager i begivenheden!");
      moveToNext();
    } catch {
      toast.error("Der opstod en fejl");
    }
  };

  const handleMaybe = async () => {
    const event = pendingInvitations[currentIndex];
    if (!event) return;

    try {
      await attendMutation.mutateAsync({ eventId: event.id, status: 'maybe' });
      await markSeenMutation.mutateAsync(event.id);
      toast.success("Svar registreret: Måske");
      moveToNext();
    } catch {
      toast.error("Der opstod en fejl");
    }
  };

  const handleDecline = async () => {
    const event = pendingInvitations[currentIndex];
    if (!event) return;
    
    try {
      await attendMutation.mutateAsync({ eventId: event.id, status: 'not_attending' });
      await markSeenMutation.mutateAsync(event.id);
      toast.success("Svar registreret");
      moveToNext();
    } catch {
      toast.error("Der opstod en fejl");
    }
  };

  const handleLater = () => {
    // Don't mark as seen, just close - will show again next time
    moveToNext();
  };

  const moveToNext = () => {
    if (currentIndex < pendingInvitations.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsOpen(false);
    }
  };

  const currentEvent = pendingInvitations[currentIndex];
  if (!currentEvent) return null;

  const isProcessing = attendMutation.isPending || markSeenMutation.isPending;

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-md gap-0 overflow-hidden rounded-3xl border-0 bg-card p-0">
        <AlertDialogHeader className="space-y-0 p-6 pb-4 text-left">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary">
            <PartyPopper className="h-4 w-4" />
            Du er inviteret
            {pendingInvitations.length > 1 && (
              <span className="ml-auto text-muted-foreground normal-case tracking-normal">
                {currentIndex + 1} af {pendingInvitations.length}
              </span>
            )}
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-muted">
              <span className="text-xl font-black leading-none text-foreground">
                {format(parseISO(currentEvent.event_date), "d")}
              </span>
              <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {format(parseISO(currentEvent.event_date), "MMM", { locale: da }).replace(".", "")}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialogTitle className="break-words text-lg font-bold leading-snug text-foreground">
                {currentEvent.title}
              </AlertDialogTitle>
              <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 shrink-0" />
                  <span className="first-letter:uppercase">
                    {format(parseISO(currentEvent.event_date), "EEEE d. MMMM", { locale: da })}
                    {currentEvent.event_time && ` · kl. ${currentEvent.event_time.slice(0, 5)}`}
                  </span>
                </div>
                {currentEvent.location && (
                  <div className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="break-words">{currentEvent.location}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <AlertDialogDescription asChild>
            <div>
              {currentEvent.description && (
                <p className="mt-4 line-clamp-4 whitespace-pre-line break-words rounded-2xl bg-muted p-4 text-sm text-foreground">
                  {currentEvent.description}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-3 p-6 pt-2 sm:flex-col sm:space-x-0">
          <div className="grid w-full grid-cols-3 gap-2">
            <Button className="gap-1.5 rounded-full px-2" onClick={handleAttend} disabled={isProcessing}>
              <ThumbsUp className="h-4 w-4 shrink-0" />
              Deltager
            </Button>
            <Button variant="outline" className="gap-1.5 rounded-full px-2" onClick={handleMaybe} disabled={isProcessing}>
              <HelpCircle className="h-4 w-4 shrink-0" />
              Måske
            </Button>
            <Button variant="outline" className="gap-1.5 rounded-full px-2" onClick={handleDecline} disabled={isProcessing}>
              <ThumbsDown className="h-4 w-4 shrink-0" />
              Nej tak
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mx-auto gap-1.5 text-muted-foreground"
            onClick={handleLater}
            disabled={isProcessing}
          >
            <Clock className="h-3.5 w-3.5" />
            Mind mig om det senere
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
