import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Phone } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TimeSlot { start: string; end: string; }
interface AvailabilityDay { date: string; slots: TimeSlot[]; }

export function BookingPreviewTab() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const { data: sampleCandidate } = useQuery({
    queryKey: ["preview-sample-candidate"],
    queryFn: async () => {
      const { data } = await supabase
        .from("candidates")
        .select("id, first_name")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: availability, isLoading } = useQuery({
    queryKey: ["preview-availability", sampleCandidate?.id],
    queryFn: async () => {
      const res = await supabase.functions.invoke("get-public-availability", {
        body: { candidateId: sampleCandidate!.id },
      });
      if (res.error) throw res.error;
      return res.data as { days: AvailabilityDay[] };
    },
    enabled: !!sampleCandidate?.id,
  });

  const firstName = sampleCandidate?.first_name?.split(" ")[0] || "Kandidat";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Kandidat-visning (preview)</h3>
          <p className="text-xs text-muted-foreground">
            Sådan ser booking-siden ud for kandidaten — med live data fra dine indstillinger
          </p>
        </div>
        <Badge variant="outline" className="text-xs gap-1">
          <Phone className="h-3 w-3" />
          Live preview
        </Badge>
      </div>

      {/* Simulated booking page */}
      <Card className="overflow-hidden border-2 border-dashed">
        <CardContent className="p-0">
          <div className="bg-gradient-to-b from-muted/30 to-background">
            <div className="max-w-lg mx-auto p-4 py-8 space-y-6">
              {/* Header */}
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium">
                  <Phone className="h-4 w-4" />
                  Copenhagen Sales
                </div>
                <h1 className="text-2xl font-bold tracking-tight">
                  Book en samtale, {firstName}
                </h1>
                <p className="text-muted-foreground text-sm">
                  Samtalen tager kun 10 minutter — og så finder vi ud af om det er et match.
                </p>
                <Badge variant="secondary" className="text-xs">Sælger</Badge>
              </div>

              {/* Day selector */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Vælg en dag
                </div>
                {isLoading ? (
                  <div className="flex justify-center py-3">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                  </div>
                ) : availableDays.length === 0 ? (
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
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Ledige tider — {format(selectedDate, "EEEE d. MMM", { locale: da })}
                    </div>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Clock className="h-3 w-3" />
                      Ca. 10 min
                    </Badge>
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
                    <Button className="w-full" size="lg" disabled>
                      <Calendar className="h-4 w-4 mr-2" />
                      Book møde — {selectedSlot.start} (preview)
                    </Button>
                  )}
                </div>
              )}

              {/* Unsubscribe */}
              <div className="text-center">
                <span className="text-xs text-muted-foreground underline cursor-default">
                  Jeg ønsker ikke at blive kontaktet — træk min ansøgning tilbage
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
