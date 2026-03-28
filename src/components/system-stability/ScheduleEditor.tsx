import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, Save, Settings2, Lightbulb, CheckCircle2, ChevronDown, Code } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  parseCronMinutes,
  buildCronExpression,
  detectOverlaps,
  estimateFrequencyFromCron,
  findBestOffset,
} from "@/utils/cronOverlapDetector";

interface Integration {
  id: string;
  name: string;
  provider: string;
  config: any;
  sync_frequency_minutes?: number;
}

interface ScheduleEditorProps {
  integrations: Integration[];
  onScheduleUpdated: () => void;
}

const FREQUENCY_OPTIONS = [
  { value: "5", label: "Hvert 5. minut", timesPerHour: 12 },
  { value: "10", label: "Hvert 10. minut", timesPerHour: 6 },
  { value: "15", label: "Hvert 15. minut", timesPerHour: 4 },
  { value: "30", label: "Hvert 30. minut", timesPerHour: 2 },
  { value: "60", label: "Én gang i timen", timesPerHour: 1 },
];

function generateMinutesFromOffset(frequency: number, offset: number): number[] {
  const mins: number[] = [];
  for (let m = offset; m < 60; m += frequency) {
    mins.push(m);
  }
  return mins;
}

export function ScheduleEditor({ integrations, onScheduleUpdated }: ScheduleEditorProps) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>(integrations[0]?.id || "");
  const [frequency, setFrequency] = useState<string>("10");
  const [startMinute, setStartMinute] = useState<string>("0");
  const [saving, setSaving] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);

  // Sync local state when integrations prop updates (after refetch)
  useEffect(() => {
    const int = integrations.find(i => i.id === selectedId);
    if (int?.config?.sync_schedule) {
      const freq = estimateFrequencyFromCron(int.config.sync_schedule);
      setFrequency(String(freq));
      const mins = parseCronMinutes(int.config.sync_schedule);
      setStartMinute(String(mins[0] ?? 0));
    }
  }, [integrations, selectedId]);

  const selected = integrations.find(i => i.id === selectedId);

  // Other integrations on the same provider (for recommendations)
  const sameProviderIntegrations = useMemo(() => {
    if (!selected) return [];
    return integrations.filter(i => i.id !== selectedId && i.provider === selected.provider);
  }, [integrations, selectedId, selected]);

  const otherSchedules = useMemo(() => {
    return sameProviderIntegrations.map(int =>
      int.config?.sync_schedule || `*/${int.sync_frequency_minutes || 10} * * * *`
    );
  }, [sameProviderIntegrations]);

  // Recommended offset
  const recommendation = useMemo(() => {
    const freq = parseInt(frequency);
    return findBestOffset(freq, otherSchedules);
  }, [frequency, otherSchedules]);

  // When integration changes, load its current schedule
  const handleIntegrationChange = (id: string) => {
    setSelectedId(id);
    const int = integrations.find(i => i.id === id);
    if (int) {
      const currentSchedule = int.config?.sync_schedule;
      if (currentSchedule) {
        const freq = estimateFrequencyFromCron(currentSchedule);
        setFrequency(String(freq));
        const mins = parseCronMinutes(currentSchedule);
        setStartMinute(String(mins[0] ?? 0));
      } else {
        const freq = int.sync_frequency_minutes || 10;
        setFrequency(String(freq));
        setStartMinute("0");
      }
    }
  };

  // Start minute options based on frequency
  const startMinuteOptions = useMemo(() => {
    const freq = parseInt(frequency);
    return Array.from({ length: freq }, (_, i) => i);
  }, [frequency]);

  // Ensure startMinute is valid when frequency changes
  useEffect(() => {
    const freq = parseInt(frequency);
    const current = parseInt(startMinute);
    if (current >= freq) {
      setStartMinute("0");
    }
  }, [frequency]);

  // The fire minutes and cron expression
  const freq = parseInt(frequency);
  const offset = parseInt(startMinute);
  const fireMinutes = generateMinutesFromOffset(freq, offset);
  const newCronExpression = fireMinutes.length > 0 ? `${fireMinutes.join(",")} * * * *` : `*/${freq} * * * *`;

  // Always-on conflict check
  const overlapWarnings = useMemo(() => {
    if (sameProviderIntegrations.length === 0) return [];

    const jobs = [
      { id: selectedId, name: selected?.name || "", schedule: newCronExpression, provider: selected?.provider },
      ...sameProviderIntegrations.map(int => ({
        id: int.id,
        name: int.name,
        schedule: int.config?.sync_schedule || `*/${int.sync_frequency_minutes || 10} * * * *`,
        provider: int.provider,
      })),
    ];

    return detectOverlaps(jobs, 2, true);
  }, [sameProviderIntegrations, selectedId, selected, newCronExpression]);

  const handleUseRecommended = () => {
    setStartMinute(String(recommendation.offset));
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);

    try {
      const { error } = await supabase.functions.invoke("update-cron-schedule", {
        body: {
          integration_type: "dialer",
          integration_id: selected.id,
          provider: selected.provider,
          frequency_minutes: freq,
          is_active: true,
          custom_schedule: newCronExpression,
        },
      });

      if (error) throw error;

      toast.success(`Tidsplan opdateret for ${selected.name}`, {
        description: `Kører ${fireMinutes.length} gange i timen fra minut :${String(offset).padStart(2, "0")}`,
      });
      queryClient.invalidateQueries({ queryKey: ["system-stability-integrations"] });
      onScheduleUpdated();
    } catch (err: any) {
      toast.error("Kunne ikke opdatere tidsplan", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const freqOption = FREQUENCY_OPTIONS.find(o => o.value === frequency);
  const humanSchedule = `Kører ${fireMinutes.length} gang${fireMinutes.length !== 1 ? "e" : ""} i timen: ${fireMinutes.map(m => `:${String(m).padStart(2, "0")}`).join(", ")}`;

  const recommendedMinutes = generateMinutesFromOffset(freq, recommendation.offset);
  const recommendedLabel = `Hvert ${freq}. min fra :${String(recommendation.offset).padStart(2, "0")} – giver ${recommendation.minGap} minutters afstand${sameProviderIntegrations.length > 0 ? ` til ${sameProviderIntegrations.map(i => i.name).join(", ")}` : ""}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Planlæg synkronisering
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Vælg hvor ofte data skal hentes, og hvornår. Systemet anbefaler automatisk en tidsplan der undgår konflikter.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Controls row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Integration</label>
            <Select value={selectedId} onValueChange={handleIntegrationChange}>
              <SelectTrigger>
                <SelectValue placeholder="Vælg integration" />
              </SelectTrigger>
              <SelectContent>
                {integrations.map(int => (
                  <SelectItem key={int.id} value={int.id}>{int.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Hvor ofte skal data hentes?</label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Start ved minut
            </label>
            <Select value={startMinute} onValueChange={setStartMinute}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {startMinuteOptions.map(m => (
                  <SelectItem key={m} value={String(m)}>
                    :{String(m).padStart(2, "0")}
                    {m === recommendation.offset && sameProviderIntegrations.length > 0 ? " (anbefalet)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground leading-tight">
              Hvilket minut i timen synkroniseringen begynder
            </p>
          </div>
        </div>

        {/* Recommendation */}
        {sameProviderIntegrations.length > 0 && (
          <div className="flex items-center justify-between bg-accent/50 rounded-md p-3 border border-accent">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-foreground">Anbefalet tidsplan</p>
                <p className="text-xs text-muted-foreground">{recommendedLabel}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 text-xs"
              onClick={handleUseRecommended}
              disabled={parseInt(startMinute) === recommendation.offset}
            >
              Brug anbefalet
            </Button>
          </div>
        )}

        {/* Human-readable schedule */}
        <div className="bg-muted/50 rounded-md p-3 space-y-2">
          <p className="text-sm font-medium">{humanSchedule}</p>

          {/* Conflict status – always visible */}
          {overlapWarnings.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {sameProviderIntegrations.length > 0
                ? "Ingen konflikter med andre integrationer på dette API"
                : "Ingen andre integrationer på dette API"}
            </div>
          ) : (
            overlapWarnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Kører samtidig med <strong>{w.jobA === selected?.name ? w.jobB : w.jobA}</strong> ved minut {w.conflictMinutes.map(m => `:${String(m).padStart(2, "0")}`).join(", ")}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Technical details (collapsible) */}
        <Collapsible open={showTechnical} onOpenChange={setShowTechnical}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1 px-0">
              <Code className="h-3 w-3" />
              Tekniske detaljer
              <ChevronDown className={`h-3 w-3 transition-transform ${showTechnical ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="bg-muted/30 rounded-md p-3 mt-1 space-y-1">
              <p className="text-xs text-muted-foreground">Cron expression</p>
              <p className="text-sm font-mono">{newCronExpression}</p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Save */}
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Gemmer..." : "Gem tidsplan"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
