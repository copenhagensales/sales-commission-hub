import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { PartyPopper, Calendar, MapPin, ThumbsUp, ThumbsDown, Clock } from "lucide-react";
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
    mutationFn: async ({ eventId, status }: { eventId: string; status: 'attending' | 'not_attending' }) => {
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
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl">
            <PartyPopper className="w-6 h-6 text-primary" />
            Du er inviteret!
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <h3 className="text-lg font-semibold text-foreground">{currentEvent.title}</h3>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <Calendar className="w-4 h-4 text-primary shrink-0" />
                  <span>
                    {format(parseISO(currentEvent.event_date), "EEEE d. MMMM yyyy", { locale: da })}
                    {currentEvent.event_time && `, kl. ${currentEvent.event_time.slice(0, 5)}`}
                  </span>
                </div>
                
                {currentEvent.location && (
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span>{currentEvent.location}</span>
                  </div>
                )}
              </div>
              
              {currentEvent.description && (
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {currentEvent.description}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="default"
            className="flex-1 gap-2"
            onClick={handleAttend}
            disabled={isProcessing}
          >
            <ThumbsUp className="w-4 h-4" />
            Deltager
          </Button>
          <Button
            variant="outline"
            className="flex-1 gap-2"
            onClick={handleDecline}
            disabled={isProcessing}
          >
            <ThumbsDown className="w-4 h-4" />
            Nej tak
          </Button>
          <Button
            variant="ghost"
            className="flex-1"
            onClick={handleLater}
            disabled={isProcessing}
          >
            Senere
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
