import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";

export interface FmAgentSettings {
  target_db_pct: number;
  seller_cost_pct: number;
  data_window_weeks: number;
  min_observations: number;
  business_context: string;
  focus_priority: string;
}

const DEFAULTS: FmAgentSettings = {
  target_db_pct: 30,
  seller_cost_pct: 12.5,
  data_window_weeks: 12,
  min_observations: 5,
  business_context: "",
  focus_priority: "profitability",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSettingsLoaded?: (settings: FmAgentSettings) => void;
}

export default function AgentSettingsDrawer({ open, onOpenChange, onSettingsLoaded }: Props) {
  const [settings, setSettings] = useState<FmAgentSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("fm_agent_settings")
      .select("target_db_pct, seller_cost_pct, data_window_weeks, min_observations, business_context, focus_priority")
      .limit(1)
      .single();

    if (data) {
      const s: FmAgentSettings = {
        target_db_pct: data.target_db_pct ?? DEFAULTS.target_db_pct,
        seller_cost_pct: data.seller_cost_pct ?? DEFAULTS.seller_cost_pct,
        data_window_weeks: data.data_window_weeks ?? DEFAULTS.data_window_weeks,
        min_observations: data.min_observations ?? DEFAULTS.min_observations,
        business_context: data.business_context ?? "",
        focus_priority: data.focus_priority ?? DEFAULTS.focus_priority,
      };
      setSettings(s);
      onSettingsLoaded?.(s);
    }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    // Get the singleton row id
    const { data: existing } = await supabase
      .from("fm_agent_settings")
      .select("id")
      .limit(1)
      .single();

    if (!existing) {
      toast.error("Kunne ikke finde indstillinger");
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("fm_agent_settings")
      .update({
        ...settings,
        updated_by: userData?.user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);

    if (error) {
      toast.error("Kunne ikke gemme indstillinger");
    } else {
      toast.success("Indstillinger gemt");
      onSettingsLoaded?.(settings);
      onOpenChange(false);
    }
    setSaving(false);
  };

  const update = <K extends keyof FmAgentSettings>(key: K, value: FmAgentSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Agent Indstillinger</SheetTitle>
          <SheetDescription>Konfigurér AI'ens forretningsforståelse og beregningsparametre</SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-6">
            {/* Target DB% */}
            <div className="space-y-2">
              <Label>Mål-DB% (minimum dækningsbidrag)</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.target_db_pct]}
                  onValueChange={([v]) => update("target_db_pct", v)}
                  min={0}
                  max={60}
                  step={5}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-12 text-right">{settings.target_db_pct}%</span>
              </div>
              <p className="text-xs text-muted-foreground">Lokationer under denne grænse flagges som risiko</p>
            </div>

            {/* Seller cost % */}
            <div className="space-y-2">
              <Label>Sælgeromkostning % (feriepenge/tillæg)</Label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  value={settings.seller_cost_pct}
                  onChange={(e) => update("seller_cost_pct", parseFloat(e.target.value) || 0)}
                  min={0}
                  max={50}
                  step={0.5}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">% oveni provision</span>
              </div>
            </div>

            {/* Data window */}
            <div className="space-y-2">
              <Label>Datavindue (uger)</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.data_window_weeks]}
                  onValueChange={([v]) => update("data_window_weeks", v)}
                  min={4}
                  max={26}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-12 text-right">{settings.data_window_weeks}u</span>
              </div>
              <p className="text-xs text-muted-foreground">Hvor mange uger bagud AI'en analyserer</p>
            </div>

            {/* Min observations */}
            <div className="space-y-2">
              <Label>Min. observationer for sikker konklusion</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[settings.min_observations]}
                  onValueChange={([v]) => update("min_observations", v)}
                  min={1}
                  max={20}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-12 text-right">{settings.min_observations}</span>
              </div>
            </div>

            {/* Focus priority */}
            <div className="space-y-2">
              <Label>Fokus-prioritet</Label>
              <Select value={settings.focus_priority} onValueChange={(v) => update("focus_priority", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="profitability">Profitabilitet (DB%)</SelectItem>
                  <SelectItem value="volume">Volumen (antal salg)</SelectItem>
                  <SelectItem value="consistency">Konsistens (lav varians)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Hvad AI'en vægter højest i sine anbefalinger</p>
            </div>

            {/* Business context */}
            <div className="space-y-2">
              <Label>Forretningskontekst</Label>
              <Textarea
                value={settings.business_context}
                onChange={(e) => update("business_context", e.target.value)}
                rows={5}
                placeholder={"Eksempler:\n• Vi prioriterer Eesy-produkter over andre\n• Aarhus-lokationer har sæsonudsving om vinteren\n• Nye sælgere skal altid starte på etablerede lokationer\n• Budget for hotel er max 700 kr/nat"}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">Fritekst som AI'en bruger til at forstå jeres forretning bedre</p>
            </div>

            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Gem indstillinger
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
