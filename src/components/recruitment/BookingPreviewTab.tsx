import { useState, useMemo } from "react";
import { Calendar, Clock, Phone, Pencil } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { da } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface TimeSlot { start: string; end: string; }
interface AvailabilityDay { date: string; slots: TimeSlot[]; }

interface BookingPageConfig {
  id: string;
  greeting_template: string;
  description: string;
  recruiter_name: string;
  role_label: string;
  unsubscribe_text: string;
  step1_label: string;
  step2_label: string;
  step3_label: string;
}

const CS_GREEN = "#52c68d";
const CS_GREEN_LIGHT = "#e8f8f0";
const CS_DARK = "#2e3136";

export function BookingPreviewTab() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<BookingPageConfig>>({});

  const { data: config } = useQuery({
    queryKey: ["booking-page-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_page_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as BookingPageConfig | null;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<BookingPageConfig>) => {
      if (!config?.id) return;
      const { error } = await supabase
        .from("booking_page_config")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-page-config"] });
      setEditing(false);
      toast.success("Booking-side opdateret");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

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
  const recruiterName = config?.recruiter_name || "Oscar";

  const greeting = (config?.greeting_template || "Hej {{firstName}} 👋").replace("{{firstName}}", firstName);
  const description = (config?.description || "Book en kort snak med **{{recruiterName}}**, vores rekrutteringsansvarlige. På 5–10 minutter tager I en uforpligtende snak om jobbet – og {{recruiterName}} svarer gerne på spørgsmål om løn, arbejdstider og hverdagen i salg.")
    .replace(/\{\{recruiterName\}\}/g, recruiterName);
  const step1 = (config?.step1_label || "Vælg tid");
  const step2 = (config?.step2_label || "{{recruiterName}} ringer dig").replace("{{recruiterName}}", recruiterName);
  const step3 = (config?.step3_label || "Start dit nye job");
  const unsubText = config?.unsubscribe_text || "Ikke interesseret længere? Klik her – det er helt okay";
  const roleLabel = config?.role_label || "Sælger";

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

  const openEdit = () => {
    setEditForm({
      greeting_template: config?.greeting_template || "Hej {{firstName}} 👋",
      description: config?.description || "Book en kort snak med **{{recruiterName}}**, vores rekrutteringsansvarlige. På 5–10 minutter tager I en uforpligtende snak om jobbet – og {{recruiterName}} svarer gerne på spørgsmål om løn, arbejdstider og hverdagen i salg.",
      recruiter_name: config?.recruiter_name || "Oscar",
      role_label: config?.role_label || "Sælger",
      unsubscribe_text: config?.unsubscribe_text || "Ikke interesseret længere? Klik her – det er helt okay",
      step1_label: config?.step1_label || "Vælg tid",
      step2_label: config?.step2_label || "{{recruiterName}} ringer dig",
      step3_label: config?.step3_label || "Start dit nye job",
    });
    setEditing(true);
  };

  // Render description with **bold** support
  const renderDescription = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={i} style={{ color: CS_DARK }}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Kandidat-visning (preview)</h3>
          <p className="text-xs text-muted-foreground">
            Sådan ser booking-siden ud for kandidaten – med live data fra dine indstillinger
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openEdit} className="gap-1.5">
            <Pencil className="h-3 w-3" />
            Rediger tekster
          </Button>
          <span
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium"
            style={{ backgroundColor: CS_DARK, color: "#e6f0f1" }}
          >
            <Phone className="h-3 w-3" />
            Live preview
          </span>
        </div>
      </div>

      {/* Simulated booking page */}
      <div className="overflow-hidden border-2 border-dashed rounded-2xl">
        <div className="bg-white" style={fontStyle}>
          <div className="max-w-lg mx-auto p-4 py-8 space-y-6">
            <div className="text-center space-y-3">
              <div
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium"
                style={{ backgroundColor: CS_DARK, color: "#e6f0f1" }}
              >
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
            </div>

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
                <p className="text-sm text-center py-4" style={{ color: "#999" }}>Ingen ledige dage lige nu.</p>
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
                  <button className="w-full rounded-full py-3 text-sm font-semibold transition-all cursor-default opacity-80"
                    style={{ backgroundColor: CS_GREEN, color: "#fff" }} disabled>
                    <span className="inline-flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Book snak med {recruiterName} kl. {selectedSlot.start} → (preview)
                    </span>
                  </button>
                )}
              </div>
            )}

            <div className="text-center">
              <span className="text-xs underline cursor-default" style={{ color: "#aaa" }}>{unsubText}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editing} onOpenChange={(open) => !open && setEditing(false)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rediger booking-side tekster</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rekrutteringsansvarlig (navn)</Label>
              <Input value={editForm.recruiter_name || ""} onChange={e => setEditForm(f => ({ ...f, recruiter_name: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Bruges i beskrivelse og trin-labels via {"{{recruiterName}}"}</p>
            </div>
            <div className="space-y-2">
              <Label>Overskrift</Label>
              <Input value={editForm.greeting_template || ""} onChange={e => setEditForm(f => ({ ...f, greeting_template: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Brug {"{{firstName}}"} som pladsholder for kandidatens navn</p>
            </div>
            <div className="space-y-2">
              <Label>Beskrivelse</Label>
              <Textarea value={editForm.description || ""} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} rows={4} />
              <p className="text-xs text-muted-foreground">Brug {"{{recruiterName}}"} og **fed tekst** til fremhævning</p>
            </div>
            <div className="space-y-2">
              <Label>Rolle-label</Label>
              <Input value={editForm.role_label || ""} onChange={e => setEditForm(f => ({ ...f, role_label: e.target.value }))} placeholder="F.eks. Sælger" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Trin 1</Label>
                <Input value={editForm.step1_label || ""} onChange={e => setEditForm(f => ({ ...f, step1_label: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Trin 2</Label>
                <Input value={editForm.step2_label || ""} onChange={e => setEditForm(f => ({ ...f, step2_label: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Trin 3</Label>
                <Input value={editForm.step3_label || ""} onChange={e => setEditForm(f => ({ ...f, step3_label: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Afmeldings-tekst</Label>
              <Input value={editForm.unsubscribe_text || ""} onChange={e => setEditForm(f => ({ ...f, unsubscribe_text: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(false)}>Annuller</Button>
              <Button onClick={() => updateMutation.mutate(editForm)} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Gemmer..." : "Gem ændringer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
