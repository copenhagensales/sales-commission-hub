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
import { toast } from "sonner";
import { ExternalLink, Copy, Search, CalendarIcon, Save, X, Settings, Eye } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i + 6); // 6-18

export function BookingSettingsTab() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [blockDate, setBlockDate] = useState<Date>();

  // Fetch settings
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

  // Local state for form
  const [formState, setFormState] = useState<{
    work_start_hour: number;
    work_end_hour: number;
    slot_duration_minutes: number;
    lookahead_days: number;
    blocked_dates: string[];
  } | null>(null);

  const form = formState ?? settings ?? {
    work_start_hour: 9,
    work_end_hour: 17,
    slot_duration_minutes: 15,
    lookahead_days: 14,
    blocked_dates: [],
  };

  const updateForm = (updates: Partial<typeof form>) => {
    setFormState({ ...form, ...updates });
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const { error } = await supabase
        .from("booking_settings")
        .update({
          work_start_hour: values.work_start_hour,
          work_end_hour: values.work_end_hour,
          slot_duration_minutes: values.slot_duration_minutes,
          lookahead_days: values.lookahead_days,
          blocked_dates: values.blocked_dates,
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

  // Fetch candidates for preview
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
    if (bookingUrl) {
      window.open(bookingUrl, "_blank");
    }
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
    updateForm({
      blocked_dates: (form.blocked_dates || []).filter((d) => d !== dateStr),
    });
  };

  const hasChanges = formState !== null;

  return (
    <div className="space-y-6">
      {/* Section A: Preview booking page */}
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
                  <span className="font-medium">
                    {c.first_name} {c.last_name}
                  </span>
                  <span className="text-muted-foreground ml-2">{c.email}</span>
                </button>
              ))}
            </div>
          )}

          {selectedCandidate && bookingUrl && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm truncate flex-1 font-mono">{bookingUrl}</span>
              <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Kopiér
              </Button>
              <Button size="sm" onClick={openBookingPage} className="gap-1.5">
                <ExternalLink className="h-3.5 w-3.5" />
                Åbn
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
              {/* Work hours */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Starttidspunkt</Label>
                  <Select
                    value={String(form.work_start_hour)}
                    onValueChange={(v) => updateForm({ work_start_hour: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sluttidspunkt</Label>
                  <Select
                    value={String(form.work_end_hour)}
                    onValueChange={(v) => updateForm({ work_end_hour: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {String(h).padStart(2, "0")}:00
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
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
                      <SelectItem key={m} value={String(m)}>
                        {m} minutter
                      </SelectItem>
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
                        <CalendarIcon className="h-3.5 w-3.5" />
                        Tilføj dato
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
                        <button
                          onClick={() => removeBlockedDate(dateStr)}
                          className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                        >
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
