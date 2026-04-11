import { useState, useEffect, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, Check, Clock, AlertCircle, RefreshCw, Phone, ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay, isToday, isPast } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useCalendarBooking, type TimeSlot } from "@/hooks/useCalendarBooking";

interface CalendarBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    role: string;
  } | null;
  recruiterName?: string;
  recruiterEmail?: string;
  existingEventId?: string | null;
  existingBookedTime?: string | null;
  onBookingComplete?: (eventId: string, slot: TimeSlot) => void;
}

export function CalendarBookingModal({
  open,
  onOpenChange,
  candidate,
  recruiterName = "Rekrutteringsafdelingen",
  recruiterEmail,
  existingEventId,
  existingBookedTime,
  onBookingComplete,
}: CalendarBookingModalProps) {
  const {
    isLoadingSlots,
    slots,
    selectedSlot,
    isCreatingEvent,
    bookingConfirmed,
    error,
    isConfigured,
    fetchAvailability,
    createEvent,
    deleteEvent,
    executePostBookingActions,
    sendRescheduleSms,
    selectSlot,
    resetBooking,
  } = useCalendarBooking();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    if (open && isConfigured) {
      fetchAvailability(recruiterEmail);
    }
    if (!open) {
      resetBooking();
      setWeekOffset(0);
      setIsRescheduling(false);
      setShowConfirmation(false);
    }
  }, [open, isConfigured, fetchAvailability, recruiterEmail, resetBooking]);

  useEffect(() => {
    if (showConfirmation) {
      const timer = setTimeout(() => {
        setShowConfirmation(false);
        onOpenChange(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showConfirmation, onOpenChange]);

  const weekDays = useMemo(() => {
    const start = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7);
    return Array.from({ length: 5 }, (_, i) => addDays(start, i));
  }, [weekOffset]);

  const daySlots = useMemo(() => {
    return slots.filter(s => isSameDay(s.date, selectedDate));
  }, [slots, selectedDate]);

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !candidate) return;

    if (isRescheduling && existingEventId) {
      const deleted = await deleteEvent(existingEventId);
      if (!deleted) return;
    }

    const eventId = await createEvent(selectedSlot, candidate, recruiterName);
    if (!eventId) return;

    await executePostBookingActions(candidate, selectedSlot, eventId);

    if (isRescheduling) {
      await sendRescheduleSms(candidate, selectedSlot);
    }

    onBookingComplete?.(eventId, selectedSlot);
    setShowConfirmation(true);
  };

  const handleReschedule = () => {
    setIsRescheduling(true);
    selectSlot(null);
  };

  const hasEmail = Boolean(candidate?.email);

  if (!candidate) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-lg font-semibold">
            <Calendar className="h-5 w-5 text-primary" />
            {isRescheduling ? "Omlæg samtale" : "Book telefonsamtale"}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {candidate.firstName} {candidate.lastName} · {candidate.role}
          </SheetDescription>
        </SheetHeader>

        {showConfirmation && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Check className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-foreground">
                {isRescheduling ? "Samtale omlagt" : "Samtale booket"}
              </h3>
              {selectedSlot && (
                <p className="text-sm text-muted-foreground mt-1">
                  {format(selectedSlot.date, "EEEE d. MMMM", { locale: da })} kl. {selectedSlot.startTime}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Kalenderinvitation sendt · SMS bekræftelse sendt
              </p>
            </div>
          </div>
        )}

        {error && !showConfirmation && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {!isConfigured && !showConfirmation && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
            <AlertCircle className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Microsoft 365 integration er ikke konfigureret.
              <br />
              Tilføj Azure credentials i Indstillinger → Integrationer.
            </p>
          </div>
        )}

        {isConfigured && !showConfirmation && (
          <ScrollArea className="flex-1">
            <div className="px-6 py-4 space-y-4">
              {existingBookedTime && !isRescheduling && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Booket: {existingBookedTime}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleReschedule}
                      className="text-xs h-7"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Omlæg
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekOffset(prev => Math.max(0, prev - 1))}
                  disabled={weekOffset === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium text-muted-foreground">
                  Uge {format(weekDays[0], "w")} — {format(weekDays[0], "MMM yyyy", { locale: da })}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setWeekOffset(prev => prev + 1)}
                  disabled={weekOffset >= 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid grid-cols-5 gap-1">
                {weekDays.map(day => (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={cn(
                      "flex flex-col items-center py-2 px-1 rounded-lg text-xs transition-colors",
                      isSameDay(day, selectedDate)
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted",
                      isToday(day) && !isSameDay(day, selectedDate) && "ring-1 ring-primary/30",
                      isPast(day) && !isToday(day) && "opacity-50"
                    )}
                  >
                    <span className="font-medium">{format(day, "EEE", { locale: da })}</span>
                    <span className="text-lg font-semibold">{format(day, "d")}</span>
                  </button>
                ))}
              </div>

              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">
                  {format(selectedDate, "EEEE d. MMMM", { locale: da })}
                </h4>

                {isLoadingSlots ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 18 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 rounded-lg" />
                    ))}
                  </div>
                ) : daySlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Ingen tilgængelige tider denne dag
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {daySlots.map((slot, i) => (
                      <button
                        key={i}
                        disabled={!slot.isFree}
                        onClick={() => selectSlot(slot.isFree ? slot : null)}
                        className={cn(
                          "h-10 rounded-lg text-sm font-medium transition-all",
                          slot.isFree
                            ? selectedSlot === slot
                              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                              : "bg-background border border-border hover:border-primary hover:bg-primary/5"
                            : "bg-muted text-muted-foreground/50 cursor-not-allowed line-through"
                        )}
                      >
                        {slot.startTime}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedSlot && (
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {format(selectedSlot.date, "EEEE d. MMMM", { locale: da })} kl. {selectedSlot.startTime}–{selectedSlot.endTime}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Telefonopkald · {candidate.firstName} modtager kalenderinvitation
                    {candidate.phone ? " + SMS bekræftelse" : ""}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {isConfigured && !showConfirmation && (
          <div className="border-t px-6 py-4 space-y-2">
            {!hasEmail && (
              <div className="flex items-center gap-2 text-xs text-destructive mb-2">
                <AlertCircle className="h-3 w-3" />
                Tilføj kandidatens email for at sende invitation
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Annuller
              </Button>
              <Button
                className="flex-1"
                disabled={!selectedSlot || isCreatingEvent || !hasEmail}
                onClick={handleConfirmBooking}
              >
                {isCreatingEvent ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Opretter...
                  </>
                ) : isRescheduling ? (
                  "Bekræft omlægning"
                ) : (
                  "Bekræft booking"
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
