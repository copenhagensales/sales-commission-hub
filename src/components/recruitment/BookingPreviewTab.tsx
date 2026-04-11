import { useState, useMemo } from "react";
import { Calendar, Clock, Phone } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface TimeSlot { start: string; end: string; }
interface AvailabilityDay { date: string; slots: TimeSlot[]; }

const CS_GREEN = "#52c68d";
const CS_GREEN_LIGHT = "#e8f8f0";
const CS_DARK = "#2e3136";

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

  const fontStyle = { fontFamily: "'Figtree', sans-serif" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Kandidat-visning (preview)</h3>
          <p className="text-xs text-muted-foreground">
            Sådan ser booking-siden ud for kandidaten — med live data fra dine indstillinger
          </p>
        </div>
        <span
          className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
          style={{ backgroundColor: CS_DARK, color: "#e6f0f1" }}
        >
          <Phone className="h-3 w-3" />
          Live preview
        </span>
      </div>

      {/* Simulated booking page */}
      <div className="overflow-hidden border-2 border-dashed rounded-2xl">
        <div className="bg-white" style={fontStyle}>
          <div className="max-w-lg mx-auto p-4 py-8 space-y-6">
            {/* Header */}
            <div className="text-center space-y-3">
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
                style={{ backgroundColor: CS_DARK, color: "#e6f0f1" }}
              >
                <Phone className="h-4 w-4" />
                Copenhagen Sales
              </div>
              <h1 className="text-2xl font-semibold tracking-[-0.02em]" style={{ color: CS_DARK }}>
                Hej {firstName} 👋
              </h1>
              <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
                Book en kort snak med <strong style={{ color: CS_DARK }}>Oscar</strong>, vores rekrutteringsansvarlige.
                På 5–10 minutter tager I en uforpligtende snak om jobbet — og Oscar svarer gerne på spørgsmål om løn, arbejdstider og hverdagen i salg.
              </p>
              <span
                className="inline-block rounded-full px-3 py-1 text-xs font-medium"
                style={{ backgroundColor: CS_GREEN_LIGHT, color: CS_GREEN }}
              >
                Sælger
              </span>
            </div>

            {/* 3-step flow */}
            <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "#888" }}>
              <span className="flex items-center gap-1"><span>📅</span> Vælg tid</span>
              <span style={{ color: "#ddd" }}>→</span>
              <span className="flex items-center gap-1"><span>📞</span> Oscar ringer dig</span>
              <span style={{ color: "#ddd" }}>→</span>
              <span className="flex items-center gap-1"><span>🚀</span> Start dit nye job</span>
            </div>

            {/* Day selector */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#888" }}>
                <Calendar className="h-4 w-4" />
                Hvornår passer det dig?
              </div>
              {isLoading ? (
                <div className="flex justify-center py-3">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: `${CS_GREEN} transparent ${CS_GREEN} ${CS_GREEN}` }} />
                </div>
              ) : availableDays.length === 0 ? (
                <p className="text-sm text-center py-4" style={{ color: "#999" }}>
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
                        className="flex flex-col items-center gap-0.5 rounded-xl border px-3 py-3 text-sm font-medium transition-all"
                        style={{
                          backgroundColor: isSelected ? CS_GREEN : "#fff",
                          color: isSelected ? "#fff" : CS_DARK,
                          borderColor: isSelected ? CS_GREEN : "#e5e7eb",
                        }}
                      >
                        {index === 0 && (
                          <span
                            className="text-[9px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5"
                            style={{
                              backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : CS_GREEN_LIGHT,
                              color: isSelected ? "#fff" : CS_GREEN,
                            }}
                          >
                            Anbefalet
                          </span>
                        )}
                        <span className="text-xs capitalize">
                          {format(date, "EEEE", { locale: da })}
                        </span>
                        <span className="text-base font-semibold">
                          {format(date, "d")}
                        </span>
                        <span className="text-[10px]" style={{ opacity: 0.6 }}>
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
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#888" }}>
                    <Clock className="h-4 w-4" />
                    Vælg et tidspunkt — {format(selectedDate, "EEEE d. MMM", { locale: da })}
                  </div>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium"
                    style={{ backgroundColor: CS_GREEN_LIGHT, color: CS_GREEN }}
                  >
                    <Clock className="h-3 w-3" />
                    5–10 min · uforpligtende
                  </span>
                </div>
                {slotsForDate.length === 0 ? (
                  <p className="text-sm text-center py-4" style={{ color: "#999" }}>
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
                          className="px-3 py-2.5 rounded-xl border text-sm font-medium transition-all"
                          style={{
                            backgroundColor: isActive ? CS_GREEN : "#fff",
                            color: isActive ? "#fff" : CS_DARK,
                            borderColor: isActive ? CS_GREEN : "#e5e7eb",
                          }}
                        >
                          {slot.start} – {slot.end}
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedSlot && (
                  <button
                    className="w-full rounded-full py-3 text-sm font-semibold transition-all cursor-default opacity-80"
                    style={{ backgroundColor: CS_GREEN, color: "#fff" }}
                    disabled
                  >
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Book snak med Oscar kl. {selectedSlot.start} → (preview)
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Unsubscribe */}
            <div className="text-center">
              <span className="text-xs underline cursor-default" style={{ color: "#aaa" }}>
                Ikke interesseret længere? Det er helt okay
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
