import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Calendar, Clock, Phone, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { format, isSameDay, isToday, parseISO } from "date-fns";
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
  const [autoSelected, setAutoSelected] = useState(false);
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

  // Auto-select first available day on load
  useEffect(() => {
    if (availableDays.length > 0 && !autoSelected) {
      setSelectedDate(parseISO(availableDays[0].date));
      setAutoSelected(true);
    }
  }, [availableDays, autoSelected]);

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
  const step3 = config?.step3_label || "Jobsamtale";
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
    const successTitle = pageContent?.title || "Din samtale er booket! 🎉";
    const successTip = pageContent?.tip_text || "💡 Tip: Hav gerne dit CV klar";
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
              {(pageContent?.body_lines && pageContent.body_lines.length > 0
                ? pageContent.body_lines
                : [
                    `${recruiterName} ringer dig op på det aftalte tidspunkt`,
                    "Samtalen tager 5–10 minutter",
                    `Hav gerne et par spørgsmål klar – ${recruiterName} fortæller gerne om løn, arbejdstider og hverdagen`,
                  ]
              ).map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" style={{ color: CS_GREEN }} />
                  {line}
                </li>
              ))}
            </ul>
          </div>
          {pageContent?.social_links && (
            <div className="flex items-center justify-center gap-3 pt-1">
              {(pageContent.social_links as any).instagram && (
                <a href={(pageContent.social_links as any).instagram} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                  style={{ backgroundColor: CS_GREEN }}>
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                </a>
              )}
              {(pageContent.social_links as any).linkedin && (
                <a href={(pageContent.social_links as any).linkedin} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                  style={{ backgroundColor: CS_GREEN }}>
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                </a>
              )}
              {(pageContent.social_links as any).tiktok && (
                <a href={(pageContent.social_links as any).tiktok} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                  style={{ backgroundColor: CS_GREEN }}>
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                </a>
              )}
              {(pageContent.social_links as any).website && (
                <a href={(pageContent.social_links as any).website} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
                  style={{ backgroundColor: CS_GREEN }}>
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                </a>
              )}
            </div>
          )}
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
        </div>

        <div className="flex items-center justify-center gap-2 text-xs" style={{ color: "#888" }}>
          <span className="flex items-center gap-1"><span>📅</span> {step1}</span>
          <span style={{ color: "#ddd" }}>→</span>
          <span className="flex items-center gap-1"><span>📞</span> {step2}</span>
          <span style={{ color: "#ddd" }}>→</span>
          <span className="flex items-center gap-1"><span>🚀</span> {step3}</span>
          <span style={{ color: "#ddd" }}>→</span>
          <span className="flex items-center gap-1"><span>🎉</span> Ansættelse</span>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium" style={{ color: "#888" }}>
            <Calendar className="h-4 w-4" />
            Hvornår passer det dig?
          </div>
          <div className="rounded-xl px-4 py-2.5 text-center text-sm" style={{ backgroundColor: "#FFF8E1", color: "#8B6914" }}>
            ⚡ Jo hurtigere du booker, jo hurtigere kommer du i gang
          </div>
          {availableDays.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: "#999" }}>Ingen ledige dage lige nu.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {availableDays.map((day, index) => {
                const date = parseISO(day.date);
                const isSelected = selectedDate && isSameDay(date, selectedDate);
                const todayDate = isToday(date);
                const isFirst = index === 0;
                const isFaded = index >= 3;
                const badgeText = todayDate ? "I dag ✓" : (isFirst ? "Anbefalet" : null);
                return (
                  <button key={day.date} onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border px-3 py-3 text-sm font-medium transition-all ${isFirst && !isSelected ? "ring-2 ring-offset-1 scale-[1.03]" : ""} ${isFaded && !isSelected ? "opacity-60" : ""}`}
                    style={{
                      backgroundColor: isSelected ? CS_GREEN : "#fff",
                      color: isSelected ? "#fff" : CS_DARK,
                      borderColor: isSelected ? CS_GREEN : isFirst ? CS_GREEN : "#e5e7eb",
                    }}>
                    {badgeText && (
                      <span className="text-[9px] font-semibold uppercase tracking-wide rounded px-1.5 py-0.5"
                        style={{ backgroundColor: isSelected ? "rgba(255,255,255,0.25)" : CS_GREEN_LIGHT, color: isSelected ? "#fff" : CS_GREEN }}>
                        {badgeText}
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
                      {slot.start}
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
