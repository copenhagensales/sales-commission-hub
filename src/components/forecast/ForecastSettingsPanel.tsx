import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Copy } from "lucide-react";
import { useUpdateForecastSettings, useCopyForecastFromPrevMonth, type ForecastSettings } from "@/hooks/useForecastSettings";

interface Props {
  settings: ForecastSettings;
}

export function ForecastSettingsPanel({ settings }: Props) {
  const updateMutation = useUpdateForecastSettings();
  const copyMutation = useCopyForecastFromPrevMonth();
  
  const [form, setForm] = useState({
    client_goal: settings.client_goal,
    sick_pct: settings.sick_pct,
    vacation_pct: settings.vacation_pct,
    churn_new_pct: settings.churn_new_pct,
    churn_established_pct: settings.churn_established_pct,
    new_seller_weekly_target: settings.new_seller_weekly_target,
    new_seller_threshold: settings.new_seller_threshold,
    rolling_avg_shifts: settings.rolling_avg_shifts,
  });

  useEffect(() => {
    setForm({
      client_goal: settings.client_goal,
      sick_pct: settings.sick_pct,
      vacation_pct: settings.vacation_pct,
      churn_new_pct: settings.churn_new_pct,
      churn_established_pct: settings.churn_established_pct,
      new_seller_weekly_target: settings.new_seller_weekly_target,
      new_seller_threshold: settings.new_seller_threshold,
      rolling_avg_shifts: settings.rolling_avg_shifts,
    });
  }, [settings]);

  const handleSave = () => {
    updateMutation.mutate({ id: settings.id, ...form });
  };

  const fields = [
    { key: "client_goal" as const, label: "Kundens salgsmål", type: "number" },
    { key: "new_seller_weekly_target" as const, label: "Ugentligt mål for nye sælgere", type: "number" },
    { key: "new_seller_threshold" as const, label: "Grænse for 'ny' (antal vagter)", type: "number" },
    { key: "rolling_avg_shifts" as const, label: "Antal vagter til gennemsnit", type: "number" },
    { key: "sick_pct" as const, label: "Forventet sygdom %", type: "number" },
    { key: "vacation_pct" as const, label: "Forventet ferie %", type: "number" },
    { key: "churn_new_pct" as const, label: "Churn % (nye sælgere)", type: "number" },
    { key: "churn_established_pct" as const, label: "Churn % (etablerede)", type: "number" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Indstillinger</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyMutation.mutate({ team_id: settings.team_id, month: settings.month, year: settings.year })}
              disabled={copyMutation.isPending}
            >
              <Copy className="h-4 w-4 mr-1" />
              Kopiér fra forrige md.
            </Button>
            <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              Gem
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {fields.map(f => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <Input
                type={f.type}
                value={form[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: parseFloat(e.target.value) || 0 }))}
                className="h-9"
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
