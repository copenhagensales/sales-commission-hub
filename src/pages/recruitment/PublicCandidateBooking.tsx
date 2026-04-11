import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar, Clock, Phone, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Info, XCircle } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isWeekend, isBefore, startOfDay, addDays } from "date-fns";
import { da } from "date-fns/locale";

interface TimeSlot {
  start: string;
  end: string;
}

interface AvailabilityDay {
  date: string;
  slots: TimeSlot[];
}

export default function PublicCandidateBooking() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [booked, setBooked] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);

  // Fetch availability + candidate + application from edge function (bypasses RLS)
  const { data: availability, isLoading: availLoading } = useQuery({
    queryKey: ["public-availability", candidateId],
    queryFn: async () => {
      const res = await supabase.functions.invoke("get-public-availability", {
        body: { candidateId },
      });
      if (res.error) throw res.error;
      return res.data as {
        days: AvailabilityDay[];
        candidate: { id: string; first_name: string; last_name: string; email: string; phone: string } | null;
        application: { role: string; status: string } | null;
      };
    },
    enabled: !!candidateId,
  });

  const candidate = availability?.candidate ?? null;
  const application = availability?.application ?? null;

  // Book mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate || !selectedSlot) throw new Error("Vælg dato og tid");
      const res = await supabase.functions.invoke("public-book-candidate", {
        body: {
          candidateId,
          date: format(selectedDate, "yyyy-MM-dd"),
          startTime: selectedSlot.start,
          endTime: selectedSlot.end,
        },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => setBooked(true),
    onError: (err: any) => toast.error(err.message || "Booking fejlede"),
  });

  // Unsubscribe mutation
  const unsubMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("unsubscribe-candidate", {
        body: { candidateId },
      });
      if (res.error) throw res.error;
      return res.data;
    },
    onSuccess: () => setUnsubscribed(true),
    onError: (err: any) => toast.error(err.message || "Afmelding fejlede"),
  });

  // Calendar logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = (getDay(monthStart) + 6) % 7; // Monday = 0

  const availableDates = useMemo(() => {
    if (!availability?.days) return new Set<string>();
    return new Set(availability.days.filter(d => d.slots.length > 0).map(d => d.date));
  }, [availability]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate || !availability?.days) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const day = availability.days.find(d => d.date === dateStr);
    return day?.slots || [];
  }, [selectedDate, availability]);

  if (unsubscribed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Du er afmeldt</h2>
            <p className="text-muted-foreground text-sm">
              Din ansøgning er trukket tilbage, og du vil ikke modtage flere beskeder fra os.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8 space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-semibold">Du er booket! 🎉</h2>
            <p className="text-muted-foreground text-sm">
              Vi har booket en samtale med dig {selectedDate && format(selectedDate, "EEEE 'd.' d. MMMM", { locale: da })} kl. {selectedSlot?.start}–{selectedSlot?.end}.
            </p>
            <p className="text-muted-foreground text-sm">
              Du modtager en bekræftelse på SMS. Vi glæder os til at tale med dig!
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (candidateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-8 pb-8">
            <p className="text-muted-foreground">Kandidat ikke fundet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const today = startOfDay(new Date());

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-2xl mx-auto p-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium">
            <Phone className="h-4 w-4" />
            Copenhagen Sales
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Book en samtale, {candidate.first_name}
          </h1>
          <p className="text-muted-foreground text-sm">
            Vælg en dato og et tidspunkt der passer dig — vi ringer dig op.
          </p>
          {application?.role && (
            <Badge variant="secondary" className="text-xs">
              {application.role}
            </Badge>
          )}
        </div>

        {/* Calendar + Slots */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* Calendar */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <CardTitle className="text-sm font-medium capitalize">
                  {format(currentMonth, "MMMM yyyy", { locale: da })}
                </CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {["Ma", "Ti", "On", "To", "Fr", "Lø", "Sø"].map(d => (
                  <div key={d} className="text-[10px] font-medium text-muted-foreground py-1">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} />
                ))}
                {daysInMonth.map(day => {
                  const dateStr = format(day, "yyyy-MM-dd");
                  const isAvail = availableDates.has(dateStr);
                  const isPast = isBefore(day, today);
                  const isWknd = isWeekend(day);
                  const isSelected = selectedDate && isSameDay(day, selectedDate);

                  return (
                    <button
                      key={dateStr}
                      disabled={!isAvail || isPast}
                      onClick={() => {
                        setSelectedDate(day);
                        setSelectedSlot(null);
                      }}
                      className={`
                        h-9 w-full rounded-md text-sm transition-all
                        ${isSelected ? "bg-primary text-primary-foreground font-semibold" : ""}
                        ${isAvail && !isPast && !isSelected ? "bg-primary/10 text-primary hover:bg-primary/20 font-medium cursor-pointer" : ""}
                        ${isPast || isWknd ? "text-muted-foreground/40" : ""}
                        ${!isAvail && !isPast && !isWknd ? "text-muted-foreground" : ""}
                        disabled:cursor-default
                      `}
                    >
                      {format(day, "d")}
                    </button>
                  );
                })}
              </div>
              {availLoading && (
                <div className="flex justify-center py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Time Slots */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                {selectedDate
                  ? `Ledige tider — ${format(selectedDate, "EEEE d. MMM", { locale: da })}`
                  : "Vælg en dato"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedDate ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Vælg en dag i kalenderen for at se ledige tider.
                </p>
              ) : slotsForDate.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Ingen ledige tider denne dag.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto">
                  {slotsForDate.map(slot => {
                    const isActive = selectedSlot?.start === slot.start;
                    return (
                      <button
                        key={slot.start}
                        onClick={() => setSelectedSlot(slot)}
                        className={`
                          px-3 py-2 rounded-lg border text-sm font-medium transition-all
                          ${isActive
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card hover:bg-muted/50 border-border text-foreground"}
                        `}
                      >
                        {slot.start} – {slot.end}
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedSlot && (
                <Button
                  className="w-full mt-4"
                  size="lg"
                  onClick={() => bookMutation.mutate()}
                  disabled={bookMutation.isPending}
                >
                  {bookMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Calendar className="h-4 w-4 mr-2" />
                  )}
                  Book møde — {selectedSlot.start}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info box */}
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-3">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Mødet oprettes direkte i vores kalender — ingen dobbeltbooking.</p>
                <p>Du modtager automatisk bekræftelse via SMS.</p>
                <p>Vi ringer dig op på det valgte tidspunkt.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Unsubscribe */}
        <div className="text-center">
          <button
            onClick={() => {
              if (confirm("Er du sikker på at du vil afmelde din ansøgning? Du vil ikke modtage flere beskeder.")) {
                unsubMutation.mutate();
              }
            }}
            className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            disabled={unsubMutation.isPending}
          >
            {unsubMutation.isPending ? "Afmelder..." : "Jeg ønsker ikke at blive kontaktet — afmeld min ansøgning"}
          </button>
        </div>
      </div>
    </div>
  );
}
