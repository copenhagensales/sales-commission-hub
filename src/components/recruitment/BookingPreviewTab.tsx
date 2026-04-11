import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Phone, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isBefore, startOfDay, addDays, isWeekend } from "date-fns";
import { da } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TimeSlot { start: string; end: string; }
interface AvailabilityDay { date: string; slots: TimeSlot[]; }

export function BookingPreviewTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  // Fetch a real candidate for realistic preview
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

  // Fetch real availability using the edge function
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

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = (getDay(monthStart) + 6) % 7;

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

  const today = startOfDay(new Date());

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
            <div className="max-w-2xl mx-auto p-4 py-8 space-y-6">
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
                  Vælg en dato og et tidspunkt der passer dig — vi ringer dig op.
                </p>
                <Badge variant="secondary" className="text-xs">Sælger</Badge>
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
                    {isLoading && (
                      <div className="flex justify-center py-3">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
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
                      <Button className="w-full mt-4" size="lg" disabled>
                        <Calendar className="h-4 w-4 mr-2" />
                        Book møde — {selectedSlot.start} (preview)
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>


              {/* Unsubscribe */}
              <div className="text-center">
                <span className="text-xs text-muted-foreground underline cursor-default">
                  Jeg ønsker ikke at blive kontaktet — afmeld min ansøgning
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
