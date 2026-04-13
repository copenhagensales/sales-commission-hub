import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Toggle } from "@/components/ui/toggle";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { ExternalLink, Copy, Search, CalendarIcon, Save, X, Settings, Eye, Plus, Trash2, CopyPlus } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TimeWindow {
  start: string;
  end: string;
}

type DayTimeWindows = Record<string, TimeWindow[]>;

const TIME_OPTIONS: string[] = [];
for (let h = 6; h <= 20; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 20 && m > 0) break;
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

const WEEKDAY_LABELS = [
  { value: 1, label: "Ma", full: "Mandag" },
  { value: 2, label: "Ti", full: "Tirsdag" },
  { value: 3, label: "On", full: "Onsdag" },
  { value: 4, label: "To", full: "Torsdag" },
  { value: 5, label: "Fr", full: "Fredag" },
  { value: 6, label: "Lø", full: "Lørdag" },
  { value: 7, label: "Sø", full: "Søndag" },
];

interface FormState {
  slot_duration_minutes: number;
  lookahead_days: number;
  blocked_dates: string[];
  day_time_windows: DayTimeWindows;
  available_weekdays: number[];
}

function buildDayTimeWindows(
  dayTimeWindows: DayTimeWindows | null | undefined,
  timeWindows: TimeWindow[] | null | undefined,
  weekdays: number[]
): DayTimeWindows {
  if (dayTimeWindows && Object.keys(dayTimeWindows).length > 0) {
    // Ensure all active weekdays have entries
    const result: DayTimeWindows = {};
    for (const d of weekdays) {
      result[String(d)] = dayTimeWindows[String(d)] ?? timeWindows ?? [{ start: "09:00", end: "17:00" }];
    }
    return result;
  }
  // Fallback: apply flat time_windows to all active weekdays
  const fallback = timeWindows ?? [{ start: "09:00", end: "17:00" }];
  const result: DayTimeWindows = {};
  for (const d of weekdays) {
    result[String(d)] = [...fallback.map(tw => ({ ...tw }))];
  }
  return result;
}

export function BookingSettingsTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [blockDate, setBlockDate] = useState<Date>();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["booking-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_settings")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const [formState, setFormState] = useState<FormState | null>(null);

  const defaultForm: FormState = {
    slot_duration_minutes: 15,
    lookahead_days: 14,
    blocked_dates: [],
    day_time_windows: buildDayTimeWindows(null, null, [1, 2, 3, 4, 5]),
    available_weekdays: [1, 2, 3, 4, 5],
  };

  const settingsForm: FormState | null = settings
    ? (() => {
        const weekdays = (settings.available_weekdays as number[] | null) ?? [1, 2, 3, 4, 5];
        const timeWindows = (settings.time_windows as unknown as TimeWindow[] | null) ?? [
          { start: `${String(settings.work_start_hour).padStart(2, "0")}:00`, end: `${String(settings.work_end_hour).padStart(2, "0")}:00` },
        ];
        return {
          slot_duration_minutes: settings.slot_duration_minutes,
          lookahead_days: settings.lookahead_days,
          blocked_dates: (settings.blocked_dates as string[] | null) ?? [],
          day_time_windows: buildDayTimeWindows(
            settings.day_time_windows as unknown as DayTimeWindows | null,
            timeWindows,
            weekdays
          ),
          available_weekdays: weekdays,
        };
      })()
    : null;

  const form = formState ?? settingsForm ?? defaultForm;

  const updateForm = (updates: Partial<FormState>) => {
    setFormState({ ...form, ...updates });
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormState) => {
      // Also update legacy time_windows for backward compat (use first active day's windows)
      const firstDay = values.available_weekdays[0];
      const legacyWindows = values.day_time_windows[String(firstDay)] ?? [{ start: "09:00", end: "17:00" }];

      const { error } = await supabase
        .from("booking_settings")
        .update({
          slot_duration_minutes: values.slot_duration_minutes,
          lookahead_days: values.lookahead_days,
          blocked_dates: values.blocked_dates,
          time_windows: legacyWindows as any,
          day_time_windows: values.day_time_windows as any,
          available_weekdays: values.available_weekdays,
          work_start_hour: parseInt(legacyWindows[0]?.start?.split(":")[0] ?? "9"),
          work_end_hour: parseInt(legacyWindows[legacyWindows.length - 1]?.end?.split(":")[0] ?? "17"),
        })
        .eq("id", settings?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
      setFormState(null);
      toast.success("Indstillinger gemt");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  // Candidates
  const { data: candidates } = useQuery({
    queryKey: ["booking-candidates-search", searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("candidates")
        .select("id, first_name, last_name, email, phone")
        .order("created_at", { ascending: false })
        .limit(20);
      if (searchTerm.length > 1) {
        query = query.or(
          `first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const selectedCandidate = candidates?.find((c) => c.id === selectedCandidateId);
  const bookingUrl = selectedCandidateId
    ? `${window.location.origin}/book/${selectedCandidateId}`
    : null;

  const copyLink = () => {
    if (bookingUrl) {
      navigator.clipboard.writeText(bookingUrl);
      toast.success("Link kopieret");
    }
  };

  const openBookingPage = () => {
    if (bookingUrl) window.open(bookingUrl, "_blank");
  };

  const addBlockedDate = (date: Date | undefined) => {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const current = form.blocked_dates || [];
    if (!current.includes(dateStr)) {
      updateForm({ blocked_dates: [...current, dateStr].sort() });
    }
    setBlockDate(undefined);
  };

  const removeBlockedDate = (dateStr: string) => {
    updateForm({ blocked_dates: (form.blocked_dates || []).filter((d) => d !== dateStr) });
  };

  // Per-day time window helpers
  const addDayTimeWindow = (day: number) => {
    const key = String(day);
    const current = form.day_time_windows[key] ?? [];
    updateForm({
      day_time_windows: {
        ...form.day_time_windows,
        [key]: [...current, { start: "09:00", end: "12:00" }],
      },
    });
  };

  const removeDayTimeWindow = (day: number, index: number) => {
    const key = String(day);
    const current = form.day_time_windows[key] ?? [];
    if (current.length <= 1) return;
    updateForm({
      day_time_windows: {
        ...form.day_time_windows,
        [key]: current.filter((_, i) => i !== index),
      },
    });
  };

  const updateDayTimeWindow = (day: number, index: number, field: "start" | "end", value: string) => {
    const key = String(day);
    const current = form.day_time_windows[key] ?? [];
    updateForm({
      day_time_windows: {
        ...form.day_time_windows,
        [key]: current.map((w, i) => (i === index ? { ...w, [field]: value } : w)),
      },
    });
  };

  const copyToAllDays = (sourceDay: number) => {
    const sourceWindows = form.day_time_windows[String(sourceDay)] ?? [];
    const updated: DayTimeWindows = {};
    for (const d of form.available_weekdays) {
      updated[String(d)] = sourceWindows.map(tw => ({ ...tw }));
    }
    updateForm({ day_time_windows: updated });
    toast.success("Tidsvinduer kopieret til alle aktive dage");
  };

  // Weekday toggle – also manage day_time_windows
  const toggleWeekday = (day: number) => {
    const current = form.available_weekdays;
    const isActive = current.includes(day);
    const updated = isActive
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    if (updated.length === 0) return;

    const newDayWindows = { ...form.day_time_windows };
    if (!isActive) {
      // Adding day – give it default windows
      newDayWindows[String(day)] = [{ start: "09:00", end: "17:00" }];
    } else {
      // Removing day
      delete newDayWindows[String(day)];
    }
    updateForm({ available_weekdays: updated, day_time_windows: newDayWindows });
  };

  const hasChanges = formState !== null;

  return (
    <div className="space-y-6">
      {/* Section A: Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Åbn booking-side
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Søg efter kandidat</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Søg på navn eller email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {candidates && candidates.length > 0 && (
            <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCandidateId(c.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors",
                    selectedCandidateId === c.id && "bg-accent"
                  )}
                >
                  <span className="font-medium">{c.first_name} {c.last_name}</span>
                  <span className="text-muted-foreground ml-2">{c.email}</span>
                </button>
              ))}
            </div>
          )}

          {selectedCandidate && bookingUrl && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm truncate flex-1 font-mono">{bookingUrl}</span>
              <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" /> Kopiér
              </Button>
              <Button size="sm" onClick={openBookingPage} className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" /> Åbn
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section B: Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Indstillinger for ledige tider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {settingsLoading ? (
            <p className="text-sm text-muted-foreground">Indlæser...</p>
          ) : (
            <>
              {/* Weekdays */}
              <div className="space-y-3">
                <Label>Åbne ugedage</Label>
                <div className="flex gap-2">
                  {WEEKDAY_LABELS.map(({ value, label }) => (
                    <Toggle
                      key={value}
                      pressed={form.available_weekdays.includes(value)}
                      onPressedChange={() => toggleWeekday(value)}
                      variant="outline"
                      size="sm"
                      className="w-10"
                    >
                      {label}
                    </Toggle>
                  ))}
                </div>
              </div>

              {/* Per-day time windows */}
              <div className="space-y-3">
                <Label>Tidsvinduer per dag</Label>
                <Accordion type="multiple" className="w-full">
                  {form.available_weekdays.map((day) => {
                    const dayInfo = WEEKDAY_LABELS.find(w => w.value === day)!;
                    const windows = form.day_time_windows[String(day)] ?? [{ start: "09:00", end: "17:00" }];
                    const summary = windows.map(w => `${w.start}–${w.end}`).join(", ");

                    return (
                      <AccordionItem key={day} value={String(day)}>
                        <AccordionTrigger className="text-sm hover:no-underline py-3">
                          <div className="flex items-center gap-3">
                            <span className="font-medium w-16 text-left">{dayInfo.full}</span>
                            <span className="text-muted-foreground text-xs">{summary}</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-2 pt-1">
                            {windows.map((tw, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <Select value={tw.start} onValueChange={(v) => updateDayTimeWindow(day, idx, "start", v)}>
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_OPTIONS.map((t) => (
                                      <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <span className="text-muted-foreground">–</span>
                                <Select value={tw.end} onValueChange={(v) => updateDayTimeWindow(day, idx, "end", v)}>
                                  <SelectTrigger className="w-28">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {TIME_OPTIONS.map((t) => (
                                      <SelectItem key={t} value={t}>{t}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeDayTimeWindow(day, idx)}
                                  disabled={windows.length <= 1}
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                            <div className="flex gap-2 pt-1">
                              <Button type="button" variant="outline" size="sm" onClick={() => addDayTimeWindow(day)} className="gap-1.5">
                                <Plus className="h-3.5 w-3.5" /> Tilføj
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => copyToAllDays(day)} className="gap-1.5 text-muted-foreground">
                                <CopyPlus className="h-3.5 w-3.5" /> Kopiér til alle dage
                              </Button>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>

              {/* Slot duration */}
              <div className="space-y-2">
                <Label>Slot-varighed</Label>
                <Select
                  value={String(form.slot_duration_minutes)}
                  onValueChange={(v) => updateForm({ slot_duration_minutes: Number(v) })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[15, 30, 45, 60].map((m) => (
                      <SelectItem key={m} value={String(m)}>{m} minutter</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Lookahead days */}
              <div className="space-y-3">
                <Label>Antal dage frem: {form.lookahead_days} dage</Label>
                <Slider
                  value={[form.lookahead_days]}
                  onValueChange={([v]) => updateForm({ lookahead_days: v })}
                  min={1}
                  max={30}
                  step={1}
                  className="w-72"
                />
              </div>

              {/* Blocked dates */}
              <div className="space-y-3">
                <Label>Blokerede datoer</Label>
                <div className="flex items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" /> Tilføj dato
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={blockDate}
                        onSelect={(d) => addBlockedDate(d)}
                        disabled={(d) => d < new Date()}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                {form.blocked_dates && form.blocked_dates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.blocked_dates.map((dateStr) => (
                      <Badge key={dateStr} variant="secondary" className="gap-1 pr-1">
                        {dateStr}
                        <button onClick={() => removeBlockedDate(dateStr)} className="ml-1 hover:bg-destructive/20 rounded-full p-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Save */}
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={!hasChanges || saveMutation.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? "Gemmer..." : "Gem indstillinger"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
