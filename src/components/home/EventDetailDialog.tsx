import { format, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { Calendar, Clock, MapPin, Users, ThumbsUp, ThumbsDown, UserPlus, UserMinus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

interface EventAttendee {
  id: string;
  event_id: string;
  employee_id: string;
  status: string;
  employee: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface CompanyEvent {
  id: string;
  title: string;
  event_date: string;
  event_time: string | null;
  location: string | null;
  description: string | null;
  requires_registration?: boolean;
}

interface EventDetailDialogProps {
  event: CompanyEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attendees: EventAttendee[];
  myStatus: 'attending' | 'not_attending' | null;
  onToggleAttendance: (status: 'attending' | 'not_attending') => void;
  isLoading?: boolean;
}

export function EventDetailDialog({
  event,
  open,
  onOpenChange,
  attendees,
  myStatus,
  onToggleAttendance,
  isLoading = false,
}: EventDetailDialogProps) {
  if (!event) return null;

  const attendingList = attendees.filter(a => a.status === 'attending');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">{event.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Date */}
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-primary shrink-0" />
            <span>
              {format(parseISO(event.event_date), "EEEE d. MMMM yyyy", { locale: da })}
            </span>
          </div>

          {/* Time */}
          {event.event_time && (
            <div className="flex items-center gap-3 text-sm">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span>Kl. {event.event_time.slice(0, 5)}</span>
            </div>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="w-4 h-4 text-primary shrink-0" />
              <span>{event.location}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="pt-2 border-t">
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}

          {/* Attendees */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {attendingList.length > 0 ? (
                <HoverCard>
                  <HoverCardTrigger asChild>
                    <Badge variant="outline" className="cursor-pointer gap-1">
                      {attendingList.length} deltager
                    </Badge>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-56 p-3">
                    <p className="font-medium text-sm mb-2">Deltagere</p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {attendingList.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 text-sm">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px]">
                              {a.employee?.first_name?.[0]}{a.employee?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">
                            {a.employee?.first_name} {a.employee?.last_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              ) : (
                <span className="text-sm text-muted-foreground">Ingen deltagere endnu</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              variant={myStatus === 'attending' ? "default" : "outline"}
              className="flex-1 gap-2"
              onClick={() => onToggleAttendance('attending')}
              disabled={isLoading}
            >
              <ThumbsUp className="w-4 h-4" />
              Jeg deltager
            </Button>
            <Button
              variant={myStatus === 'not_attending' ? "secondary" : "outline"}
              className="flex-1 gap-2"
              onClick={() => onToggleAttendance('not_attending')}
              disabled={isLoading}
            >
              <ThumbsDown className="w-4 h-4" />
              Deltager ikke
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
