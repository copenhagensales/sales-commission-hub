import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInDays, format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import {
  Calendar,
  Users,
  UserPlus,
  UserMinus,
  ThumbsUp,
  ThumbsDown,
  Info,
  Pencil,
  Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { HomeCard, HomeCardEmpty } from "@/components/home/HomeCard";
import { AddEventDialog } from "@/components/home/AddEventDialog";
import { EventDetailDialog } from "@/components/home/EventDetailDialog";
import { EditEventDialog } from "@/components/home/EditEventDialog";
import { cn } from "@/lib/utils";

interface UpcomingEventsCardProps {
  employeeId?: string;
  isOwner: boolean;
  userId?: string;
}

export function UpcomingEventsCard({ employeeId, isOwner, userId }: UpcomingEventsCardProps) {
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const { data: companyEvents = [] } = useQuery({
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

  const { data: eventAttendees = [] } = useQuery({
    queryKey: ["event-attendees", companyEvents.map((e) => e.id)],
    queryFn: async () => {
      const eventIds = companyEvents.map((e) => e.id);
      if (eventIds.length === 0) return [];
      const { data } = await supabase
        .from("event_attendees")
        .select("*, employee:employee_id(id, first_name, last_name)")
        .in("event_id", eventIds);
      return data || [];
    },
    enabled: companyEvents.length > 0,
    staleTime: 30000,
  });

  const toggleAttendanceMutation = useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: string;
      status: "attending" | "not_attending";
    }) => {
      if (!employeeId) throw new Error("Ikke logget ind");
      const { error } = await supabase.from("event_attendees").upsert(
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

  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("company_events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["home-company-events"] });
      toast.success("Begivenhed slettet");
    },
  });

  const getEventAttendees = (eventId: string) =>
    eventAttendees.filter((a) => a.event_id === eventId && a.status === "attending");

  const getMyAttendance = (eventId: string): "attending" | "not_attending" | null => {
    if (!employeeId) return null;
    const mine = eventAttendees.find(
      (a) => a.event_id === eventId && a.employee_id === employeeId
    );
    return (mine?.status as "attending" | "not_attending" | null) ?? null;
  };

  const selectedEvent = companyEvents.find((e) => e.id === selectedEventId);
  const selectedEventAttendees = selectedEventId
    ? eventAttendees.filter((a) => a.event_id === selectedEventId)
    : [];

  return (
    <>
      <EventDetailDialog
        event={
          selectedEvent
            ? {
                id: selectedEvent.id,
                title: selectedEvent.title,
                event_date: selectedEvent.event_date,
                event_time: selectedEvent.event_time,
                location: selectedEvent.location,
                description: selectedEvent.description,
                requires_registration: (selectedEvent as any).requires_registration,
              }
            : null
        }
        open={!!selectedEventId}
        onOpenChange={(open) => !open && setSelectedEventId(null)}
        attendees={selectedEventAttendees.map((a) => ({
          id: a.id,
          event_id: a.event_id,
          employee_id: a.employee_id,
          status: a.status,
          employee: (a.employee as any)
            ? {
                id: (a.employee as any).id,
                first_name: (a.employee as any).first_name,
                last_name: (a.employee as any).last_name,
              }
            : null,
        }))}
        myStatus={selectedEventId ? getMyAttendance(selectedEventId) : null}
        onToggleAttendance={(status) => {
          if (selectedEventId) {
            toggleAttendanceMutation.mutate({ eventId: selectedEventId, status });
          }
        }}
        isLoading={toggleAttendanceMutation.isPending}
      />

      <EditEventDialog
        event={editingEventId ? companyEvents.find((e) => e.id === editingEventId) ?? null : null}
        open={!!editingEventId}
        onOpenChange={(open) => !open && setEditingEventId(null)}
      />

      <HomeCard
        icon={Calendar}
        title="Kommende begivenheder"
        titleShort="Begivenheder"
        action={<AddEventDialog />}
        contentClassName="p-3 md:p-4"
      >
        {companyEvents.length === 0 ? (
          <HomeCardEmpty
            icon={Calendar}
            title="Ingen kommende begivenheder"
            hint="Tilføj en begivenhed med plus-knappen ovenfor"
          />
        ) : (
          <div className="space-y-1.5">
            {companyEvents.slice(0, 3).map((event, index) => {
              const attendees = getEventAttendees(event.id);
              const myStatus = getMyAttendance(event.id);
              const daysUntil = differenceInDays(parseISO(event.event_date), new Date());

              return (
                <div
                  key={event.id}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg border px-2.5 py-2 transition-colors",
                    index === 0
                      ? "border-primary/30 bg-primary/10"
                      : "border-border/50 bg-background/30"
                  )}
                >
                  <div className="min-w-[40px] rounded-md border border-border/50 bg-background/60 px-1.5 py-1 text-center">
                    <div className="text-base font-semibold tabular-nums leading-none text-foreground">
                      {format(parseISO(event.event_date), "d")}
                    </div>
                    <div className="mt-0.5 text-[10px] uppercase leading-none text-muted-foreground">
                      {format(parseISO(event.event_date), "MMM", { locale: da })}
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                        onClick={() => setSelectedEventId(event.id)}
                      >
                        {event.title}
                      </button>
                      {index === 0 && daysUntil >= 0 && (
                        <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[10px]">
                          {daysUntil === 0
                            ? "I dag"
                            : daysUntil === 1
                              ? "I morgen"
                              : `om ${daysUntil} dage`}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {event.event_time && `Kl. ${event.event_time.slice(0, 5)}`}
                        {event.event_time && event.location && " · "}
                        {event.location}
                      </p>
                      {attendees.length > 0 && (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <Badge
                              variant="outline"
                              className="cursor-pointer gap-0.5 px-1.5 py-0 text-[10px]"
                            >
                              <Users className="h-2.5 w-2.5" />
                              {attendees.length}
                            </Badge>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-56 p-3">
                            <p className="mb-2 text-sm font-medium">Deltagere</p>
                            <div className="max-h-40 space-y-2 overflow-y-auto">
                              {attendees.map((a) => (
                                <div key={a.id} className="flex items-center gap-2 text-sm">
                                  <Avatar className="h-5 w-5">
                                    <AvatarFallback className="text-[10px]">
                                      {(a.employee as any)?.first_name?.[0]}
                                      {(a.employee as any)?.last_name?.[0]}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="truncate">
                                    {(a.employee as any)?.first_name}{" "}
                                    {(a.employee as any)?.last_name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {(event as any).requires_registration ? (
                      <>
                        <Button
                          variant={myStatus === "attending" ? "default" : "outline"}
                          size="sm"
                          className="h-8 gap-1 px-2 text-xs md:px-3"
                          onClick={() =>
                            toggleAttendanceMutation.mutate({
                              eventId: event.id,
                              status: "attending",
                            })
                          }
                          disabled={toggleAttendanceMutation.isPending}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">
                            {myStatus === "attending" ? "Tilmeldt" : "Tilmeld"}
                          </span>
                        </Button>
                        {myStatus === "attending" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
                            onClick={() =>
                              toggleAttendanceMutation.mutate({
                                eventId: event.id,
                                status: "not_attending",
                              })
                            }
                            disabled={toggleAttendanceMutation.isPending}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Afmeld</span>
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button
                          variant={myStatus === "attending" ? "default" : "ghost"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            toggleAttendanceMutation.mutate({
                              eventId: event.id,
                              status: "attending",
                            })
                          }
                          disabled={toggleAttendanceMutation.isPending}
                        >
                          <ThumbsUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant={myStatus === "not_attending" ? "secondary" : "ghost"}
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() =>
                            toggleAttendanceMutation.mutate({
                              eventId: event.id,
                              status: "not_attending",
                            })
                          }
                          disabled={toggleAttendanceMutation.isPending}
                        >
                          <ThumbsDown className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden h-8 w-8 p-0 sm:flex"
                      onClick={() => setSelectedEventId(event.id)}
                      title="Læs mere"
                    >
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    {(isOwner || event.created_by === userId) && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hidden h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 md:flex"
                          onClick={() => setEditingEventId(event.id)}
                          title="Rediger"
                        >
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hidden h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100 md:flex"
                          onClick={() => deleteEventMutation.mutate(event.id)}
                          title="Slet"
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </HomeCard>
    </>
  );
}
