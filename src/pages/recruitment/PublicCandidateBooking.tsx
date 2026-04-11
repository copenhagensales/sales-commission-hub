import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Calendar, Clock, Phone, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { da } from "date-fns/locale";

interface TimeSlot { start: string; end: string; }
interface AvailabilityDay { date: string; slots: TimeSlot[]; }

export default function PublicCandidateBooking() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [booked, setBooked] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);

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

  // Only days with available slots
  const availableDays = useMemo(() => {
    if (!availability?.days) return [];
    return availability.days.filter(d => d.slots.length > 0).slice(0, 7);
  }, [availability]);

  const slotsForDate = useMemo(() => {
    if (!selectedDate || !availability?.days) return [];
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const day = availability.days.find(d => d.date === dateStr);
    return day?.slots || [];
  }, [selectedDate, availability]);

  if (unsubscribed) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background flex items-center justify-center p-4">
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
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background flex items-center justify-center p-4">
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

  if (availLoading) {
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      <div className="max-w-lg mx-auto p-4 py-8 space-y-6">
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

        {/* Day selector */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            Vælg en dag
          </div>
          {availableDays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Ingen ledige dage lige nu.
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableDays.map((day, index) => {
                const date = parseISO(day.date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                return (
                  <button
                    key={day.date}
                    onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                    className={`
                      flex flex-col items-center gap-0.5 rounded-lg border px-3 py-3 text-sm font-medium transition-all
                      ${isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-muted/50 border-border text-foreground"}
                    `}
                  >
                    {index === 0 && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-green-600 bg-green-100 rounded px-1.5 py-0.5">
                        Anbefalet
                      </span>
                    )}
                    <span className="text-xs capitalize">
                      {format(date, "EEEE", { locale: da })}
                    </span>
                    <span className="text-base font-semibold">
                      {format(date, "d")}
                    </span>
                    <span className="text-[10px] opacity-70">
                      {format(date, "MMM", { locale: da })}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Time Slots */}
        {selectedDate && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4" />
              Ledige tider — {format(selectedDate, "EEEE d. MMM", { locale: da })}
            </div>
            {slotsForDate.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Ingen ledige tider denne dag.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {slotsForDate.map(slot => {
                  const isActive = selectedSlot?.start === slot.start;
                  return (
                    <button
                      key={slot.start}
                      onClick={() => setSelectedSlot(slot)}
                      className={`
                        px-3 py-2.5 rounded-lg border text-sm font-medium transition-all
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
                className="w-full"
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
          </div>
        )}

        {/* Unsubscribe */}
        <div className="text-center pt-4">
          <button
            onClick={() => {
              if (confirm("Er du sikker på at du vil afmelde din ansøgning? Du vil ikke modtage flere beskeder.")) {
                unsubMutation.mutate();
              }
            }}
            className="text-xs text-muted-foreground underline hover:text-foreground transition-colors"
            disabled={unsubMutation.isPending}
          >
            {unsubMutation.isPending ? "Trækker tilbage..." : "Jeg ønsker ikke at blive kontaktet — træk min ansøgning tilbage"}
          </button>
        </div>
      </div>
    </div>
  );
}
