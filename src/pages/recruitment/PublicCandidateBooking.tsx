import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Clock, Phone, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { da } from "date-fns/locale";

interface TimeSlot { start: string; end: string; }
interface AvailabilityDay { date: string; slots: TimeSlot[]; }

const CS_GREEN = "#52c68d";
const CS_GREEN_LIGHT = "#e8f8f0";
const CS_DARK = "#2e3136";

export default function PublicCandidateBooking() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [booked, setBooked] = useState(false);
  const [unsubscribed, setUnsubscribed] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.href = "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); };
  }, []);

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

  const { data: pageContent } = useQuery({
    queryKey: ["booking-page-content-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_page_content")
        .select("*")
        .eq("page_key", "booking_success")
        .maybeSingle();
      return data;
    },
  });

  const { data: config } = useQuery({
    queryKey: ["booking-page-config-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_page_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      return data as { greeting_template: string; description: string; recruiter_name: string; role_label: string; unsubscribe_text: string; step1_label: string; step2_label: string; step3_label: string } | null;
    },
  });

  const candidate = availability?.candidate ?? null;
  const application = availability?.application ?? null;
  const recruiterName = config?.recruiter_name || "Oscar";

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

  const renderDescription = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: CS_DARK }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const greeting = candidate
    ? (config?.greeting_template || "Hej {{firstName}} 👋").replace("{{firstName}}", candidate.first_name)
    : "Hej 👋";
  const description = (config?.description || "Book en kort snak med **{{recruiterName}}**, vores rekrutteringsansvarlige. På 5–10 minutter tager I en uforpligtende snak om jobbet – og {{recruiterName}} svarer gerne på spørgsmål om løn, arbejdstider og hverdagen i salg.")
    .replace(/\{\{recruiterName\}\}/g, recruiterName);
  const step1 = config?.step1_label || "Vælg tid";
  const step2 = (config?.step2_label || "{{recruiterName}} ringer dig").replace("{{recruiterName}}", recruiterName);
  const step3 = config?.step3_label || "Start dit nye job";
  const unsubText = config?.unsubscribe_text || "Ikke interesseret længere? Klik her – det er helt okay";

  if (unsubscribed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4" style={fontStyle}>
        <div className="max-w-md w-full text-center rounded-2xl border border-gray-100 shadow-sm p-8 space-y-4">
          <XCircle className="h-12 w-12 mx-auto" style={{ color: "#999" }} />
          <h2 className="text-xl font-semibold tracking-[-0.02em]" style={{ color: CS_DARK }}>Du er afmeldt</h2>
          <p className="text-sm" style={{ color: "#666" }}>
            Din ansøgning er trukket tilbage, og du vil ikke modtage flere beskeder fra os.
          </p>
        </div>
      </div>
    );
  }

  if (booked) {
    const successTitle = pageContent?.title || "Perfekt – du er booket! 🎉";
    const successTip = pageContent?.tip_text || "Tip: Tænk over hvad der motiverer dig – det spørger Oscar nemlig om 😊";
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4" style={fontStyle}>
        <div className="max-w-md w-full text-center rounded-2xl border border-gray-100 shadow-sm p-8 space-y-5">
          <CheckCircle2 className="h-12 w-12 mx-auto" style={{ color: CS_GREEN }} />
          <h2 className="text-xl font-semibold tracking-[-0.02em]" style={{ color: CS_DARK }}>{successTitle}</h2>
          <p className="text-sm" style={{ color: "#666" }}>
            {recruiterName} ringer dig {selectedDate && format(selectedDate, "EEEE 'd.' d. MMMM", { locale: da })} kl. {selectedSlot?.start}. Samtalen er helt uforpligtende.
          </p>
          <div className="rounded-xl p-4 text-left space-y-2" style={{ backgroundColor: CS_GREEN_LIGHT }}>
            <p className="text-sm font-semibold" style={{ color: CS_DARK }}>Hvad sker der nu?</p>
            <ul className="text-sm space-y-1.5" style={{ color: "#444" }}>
              <li className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-0.5 shrink-0" style={{ color: CS_GREEN }} />
                {recruiterName} ringer dig op på det aftalte tidspunkt
              </li>
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 shrink-0" style={{ color: CS_GREEN }} />
                Samtalen tager 5–10 minutter
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: CS_GREEN }} />
                Hav gerne et par spørgsmål klar – {recruiterName} fortæller gerne om løn, arbejdstider og hverdagen
              </li>
            </ul>
          </div>
          <p className="text-xs" style={{ color: "#999" }}>
            {successTip}
          </p>
        </div>
      </div>
    );
  }

  if (availLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center" style={fontStyle}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: CS_GREEN }} />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4" style={fontStyle}>
        <div className="max-w-md w-full text-center rounded-2xl border border-gray-100 shadow-sm p-8">
          <p style={{ color: "#666" }}>Kandidat ikke fundet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={fontStyle}>
      <div className="max-w-lg mx-auto p-4 py-8 space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
            style={{ backgroundColor: CS_DARK, color: "#e6f0f1" }}>
            <Phone className="h-4 w-4" />
            Copenhagen Sales
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.02em]" style={{ color: CS_DARK }}>
            {greeting}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#666" }}>
            {renderDescription(description)}
          </p>
          {application?.role && (
            <span className="inline-block rounded-full px-3 py-1 text-xs font-medium"
              style={{ backgroundColor: CS_GREEN_LIGHT, color: CS_GREEN }}>
              {application.role}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "#888" }}>
          <span className="flex items-center gap-1"><span>📅</span> {step1}</span>
          <span style={{ color: "#ddd" }}>→</span>
          <span className="flex items-center gap-1"><span>📞</span> {step2}</span>
          <span style={{ color: "#ddd" }}>→</span>
          <span className="flex items-center gap-1"><span>🚀</span> {step3}</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#888" }}>
            <Calendar className="h-4 w-4" />
            Hvornår passer det dig?
          </div>
          {availableDays.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "#999" }}>Ingen ledige dage lige nu.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableDays.map((day, index) => {
                const date = parseISO(day.date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                return (
                  <button key={day.date} onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                    className="flex flex-col items-center gap-0.5 rounded-xl border px-3 py-3 text-sm font-medium transition-all"
                    style={{ backgroundColor: isSelected ? CS_GREEN : "#fff", color: isSelected ? "#fff" : CS_DARK, borderColor: isSelected ? CS_GREEN : "#e5e7eb" }}>
                    {index === 0 && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5"
                        style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : CS_GREEN_LIGHT, color: isSelected ? "#fff" : CS_GREEN }}>
                        Anbefalet
                      </span>
                    )}
                    <span className="text-xs capitalize">{format(date, "EEEE", { locale: da })}</span>
                    <span className="text-base font-semibold">{format(date, "d")}</span>
                    <span className="text-[10px]" style={{ opacity: 0.6 }}>{format(date, "MMM", { locale: da })}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {selectedDate && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#888" }}>
                <Clock className="h-4 w-4" />
                Vælg et tidspunkt – {format(selectedDate, "EEEE d. MMM", { locale: da })}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-medium"
                style={{ backgroundColor: CS_GREEN_LIGHT, color: CS_GREEN }}>
                <Clock className="h-3 w-3" />
                5–10 min · uforpligtende
              </span>
            </div>
            {slotsForDate.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "#999" }}>Ingen ledige tider denne dag.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {slotsForDate.map(slot => {
                  const isActive = selectedSlot?.start === slot.start;
                  return (
                    <button key={slot.start} onClick={() => setSelectedSlot(slot)}
                      className="px-3 py-2.5 rounded-xl border text-sm font-medium transition-all"
                      style={{ backgroundColor: isActive ? CS_GREEN : "#fff", color: isActive ? "#fff" : CS_DARK, borderColor: isActive ? CS_GREEN : "#e5e7eb" }}>
                      {slot.start} – {slot.end}
                    </button>
                  );
                })}
              </div>
            )}
            {selectedSlot && (
              <button className="w-full rounded-full py-3 text-sm font-semibold transition-all disabled:opacity-50"
                style={{ backgroundColor: CS_GREEN, color: "#fff" }}
                onClick={() => bookMutation.mutate()} disabled={bookMutation.isPending}>
                {bookMutation.isPending ? (
                  <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Booker...</span>
                ) : (
                  <span className="inline-flex items-center gap-2"><Calendar className="h-4 w-4" />Book snak med {recruiterName} kl. {selectedSlot.start} →</span>
                )}
              </button>
            )}
          </div>
        )}

        <div className="text-center pt-4">
          <button onClick={() => {
            if (confirm("Er du sikker på at du vil afmelde din ansøgning? Du vil ikke modtage flere beskeder.")) {
              unsubMutation.mutate();
            }
          }} className="text-xs underline transition-colors" style={{ color: "#aaa" }} disabled={unsubMutation.isPending}>
            {unsubMutation.isPending ? "Trækker tilbage..." : unsubText}
          </button>
        </div>
      </div>
    </div>
  );
}
