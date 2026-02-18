import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Save, Eye, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  parseCronMinutes,
  buildCronExpression,
  detectOverlaps,
  estimateFrequencyFromCron,
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
  { value: "5", label: "Hvert 5. minut" },
  { value: "10", label: "Hvert 10. minut" },
  { value: "15", label: "Hvert 15. minut" },
  { value: "30", label: "Hvert 30. minut" },
  { value: "60", label: "Hver time" },
];

export function ScheduleEditor({ integrations, onScheduleUpdated }: ScheduleEditorProps) {
  const [selectedId, setSelectedId] = useState<string>(integrations[0]?.id || "");
  const [frequency, setFrequency] = useState<string>("10");
  const [offsetInput, setOffsetInput] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const selected = integrations.find(i => i.id === selectedId);

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
        setOffsetInput(mins.join(","));
      } else {
        const freq = int.sync_frequency_minutes || 10;
        setFrequency(String(freq));
        setOffsetInput("");
      }
    }
  };

  // Build the new cron expression
  const newCronExpression = useMemo(() => {
    const offsets = offsetInput
      .split(",")
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= 0 && n < 60);
    return buildCronExpression(parseInt(frequency), offsets.length > 0 ? offsets : []);
  }, [frequency, offsetInput]);

  // Preview conflicts
  const overlapWarnings = useMemo(() => {
    if (!showPreview) return [];

    const jobs = integrations.map(int => {
      const schedule = int.id === selectedId
        ? newCronExpression
        : int.config?.sync_schedule || `*/${int.sync_frequency_minutes || 10} * * * *`;
      return { id: int.id, name: int.name, schedule, provider: int.provider };
    });

    return detectOverlaps(jobs, 2);
  }, [showPreview, integrations, selectedId, newCronExpression]);

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke("update-cron-schedule", {
        body: {
          integration_type: "dialer",
          integration_id: selected.id,
          provider: selected.provider,
          frequency_minutes: parseInt(frequency),
          is_active: true,
          custom_schedule: newCronExpression,
        },
      });

      if (error) throw error;

      toast.success(`Schedule opdateret for ${selected.name}`, {
        description: `Ny schedule: ${newCronExpression}`,
      });
      onScheduleUpdated();
    } catch (err: any) {
      toast.error("Kunne ikke opdatere schedule", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  const fireMinutes = parseCronMinutes(newCronExpression);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4" />
          Styring af Sync-schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Integration selector */}
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

          {/* Frequency */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Sync-frekvens</label>
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

          {/* Minute offset */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Minut-offset (kommasepareret)
            </label>
            <Input
              value={offsetInput}
              onChange={e => setOffsetInput(e.target.value)}
              placeholder="f.eks. 1,11,21,31,41,51"
              className="font-mono text-xs"
            />
          </div>
        </div>

        {/* Preview of cron expression */}
        <div className="flex items-center justify-between bg-muted/50 rounded-md p-3">
          <div className="space-y-0.5">
            <p className="text-xs text-muted-foreground">Ny cron expression</p>
            <p className="text-sm font-mono font-medium">{newCronExpression}</p>
            <p className="text-xs text-muted-foreground">
              Kører ved minut: {fireMinutes.slice(0, 12).join(", ")}
              {fireMinutes.length > 12 ? ` (+${fireMinutes.length - 12} mere)` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              <Eye className="h-4 w-4 mr-1" />
              {showPreview ? "Skjul" : "Preview konflikter"}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? "Gemmer..." : "Gem"}
            </Button>
          </div>
        </div>

        {/* Overlap warnings */}
        {showPreview && overlapWarnings.length > 0 && (
          <div className="space-y-2">
            {overlapWarnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 bg-destructive/10 rounded-md p-3 text-xs">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">
                    Overlap: {w.jobA} ↔ {w.jobB}
                  </p>
                  <p className="text-muted-foreground">
                    Jobs kører inden for {w.minutesApart} min af hinanden ved minut: {w.conflictMinutes.join(", ")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {showPreview && overlapWarnings.length === 0 && (
          <div className="bg-emerald-500/10 rounded-md p-3 text-xs text-emerald-600 flex items-center gap-2">
            <Badge variant="default" className="bg-emerald-500/20 text-emerald-600 border-emerald-300">✓</Badge>
            Ingen konflikter detekteret. Alle jobs har mindst 2 minutters afstand.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
