import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Info, Lock, Save, Settings2, History } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import {
  useCalculationSettings,
  useCalculationSettingsAudit,
  useUpdateCalculationSetting,
} from "@/hooks/useCalculationSettings";
import {
  SETTING_LIMITS,
  clampSettingNumber,
  clampWorkdays,
  formatRatePercent,
  normalizeVacationRate,
  type CalculationSettingKey,
  type CalculationSettings,
} from "@/lib/calculations/calculationSettings";
import { useHasPermission } from "@/hooks/usePositionPermissions";

/**
 * Beregningsindstillinger — de globale satser der tidligere lå hardkodet i koden.
 *
 * Satserne læses ÉT sted fra (`calculation_settings`) og bruges i alle faner:
 * DB Oversigt, DB per klient, assistent- og stabsløn samt rapporter.
 * Alle ændringer logges i `calculation_settings_audit`.
 */

const AUDIT_KEY_LABELS: Record<string, string> = {
  vacation_pay_rates: "Feriepengesatser",
  workdays_per_month: "Arbejdsdage pr. måned",
  atp_barsel_rate: "ATP + barsel pr. medarbejder",
  stab_team_id: "Stab-team",
};

function formatAuditValue(key: string, value: Record<string, unknown> | null): string {
  if (!value) return "–";
  switch (key) {
    case "vacation_pay_rates":
      return (["seller", "assistant", "staff", "leader"] as const)
        .map((k) => `${k}: ${formatRatePercent(normalizeVacationRate(value[k], 0))}`)
        .join(" · ");
    case "workdays_per_month":
      return `${value.days} dage`;
    case "atp_barsel_rate":
      return `${value.amount} kr.`;
    case "stab_team_id":
      return value.team_id ? String(value.team_id) : "Intet team";
    default:
      return JSON.stringify(value);
  }
}

export function CalculationSettingsTab() {
  const { settings, rows, isLoading, isFallback } = useCalculationSettings();
  const canEdit = useHasPermission("menu_salary_calculation_settings", "edit");
  const updateSetting = useUpdateCalculationSetting();
  const { data: auditRows = [] } = useCalculationSettingsAudit(25);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams-for-calculation-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Lokal formstate — nulstilles når de gemte satser ændres
  const [draft, setDraft] = useState<CalculationSettings>(settings);
  const savedFingerprint = useMemo(
    () => JSON.stringify(settings),
    [settings]
  );
  useEffect(() => {
    setDraft(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedFingerprint]);

  const teamName = (teamId: string | null) =>
    teamId ? teams.find((t) => t.id === teamId)?.name ?? teamId : "Intet team valgt";

  const save = async (key: CalculationSettingKey, next: CalculationSettings) => {
    try {
      await updateSetting.mutateAsync({ key, settings: next });
      toast.success("Indstilling gemt — alle beregninger opdateres");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Kunne ikke gemme indstillingen"
      );
    }
  };

  const vacationDirty = (["seller", "assistant", "staff", "leader"] as const).some(
    (k) => draft.vacationPayRates[k] !== settings.vacationPayRates[k]
  );

  const percentValue = (rate: number) =>
    Number.isFinite(rate) ? String(Math.round(rate * 10000) / 100) : "0";

  const setVacationRate = (
    key: keyof CalculationSettings["vacationPayRates"],
    raw: string
  ) => {
    const percent = clampSettingNumber(
      raw === "" ? 0 : Number(raw.replace(",", ".")),
      SETTING_LIMITS.vacationPayPercent,
      settings.vacationPayRates[key] * 100
    );
    setDraft((prev) => ({
      ...prev,
      vacationPayRates: { ...prev.vacationPayRates, [key]: percent / 100 },
    }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Settings2 className="h-5 w-5 text-primary" />
                Beregningsindstillinger
              </CardTitle>
              <CardDescription>
                Satserne bruges i alle DB- og lønberegninger. Ændringer slår igennem med
                det samme i alle faner og logges nedenfor.
              </CardDescription>
            </div>
            {!canEdit && (
              <Badge variant="outline" className="gap-1 shrink-0">
                <Lock className="h-3 w-3" /> Kun læseadgang
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isFallback && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Satserne kunne ikke læses</AlertTitle>
              <AlertDescription>
                Systemet bruger indtil videre standardsatserne (12,5 % / 1 %, 22 arbejdsdage,
                381 kr. ATP). Beregningerne kører derfor som før, men ændringer her får ingen
                effekt før forbindelsen virker igen.
              </AlertDescription>
            </Alert>
          )}

          {/* Feriepenge */}
          <section className="space-y-3">
            <div>
              <h3 className="font-medium">Feriepengesatser</h3>
              <p className="text-sm text-muted-foreground">
                Lægges oveni grundlønnen som omkostning. Sælgere, assistenter og stab får
                udbetalt feriegodtgørelse (typisk 12,5 %), mens teamledere har ferie med løn
                og derfor kun en lille hensættelse (typisk 1 %).
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  { key: "seller", label: "Sælgere (provision)" },
                  { key: "assistant", label: "Assisterende teamledere" },
                  { key: "staff", label: "Stab" },
                  { key: "leader", label: "Teamledere" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label htmlFor={`vacation-${key}`}>{label}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`vacation-${key}`}
                      type="number"
                      step="0.1"
                      min={SETTING_LIMITS.vacationPayPercent.min}
                      max={SETTING_LIMITS.vacationPayPercent.max}
                      value={percentValue(draft.vacationPayRates[key])}
                      onChange={(e) => setVacationRate(key, e.target.value)}
                      disabled={!canEdit || isLoading}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Gemt: {formatRatePercent(settings.vacationPayRates[key])}
                  </p>
                </div>
              ))}
            </div>
            {canEdit && (
              <Button
                size="sm"
                onClick={() => save("vacation_pay_rates", draft)}
                disabled={!vacationDirty || updateSetting.isPending}
              >
                <Save className="h-4 w-4 mr-1.5" />
                Gem feriepengesatser
              </Button>
            )}
          </section>

          {/* Arbejdsdage */}
          <section className="space-y-3 border-t pt-6">
            <div>
              <h3 className="font-medium">Arbejdsdage pr. måned</h3>
              <p className="text-sm text-muted-foreground">
                Normtal der bruges til at proratere faste beløb (minimumsløn for teamledere,
                faste teamudgifter og ATP) når en periode ikke dækker en hel måned. 22 svarer
                til en normal måned uden helligdage.
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-1.5 w-40">
                <Label htmlFor="workdays">Arbejdsdage</Label>
                <Input
                  id="workdays"
                  type="number"
                  min={SETTING_LIMITS.workdaysPerMonth.min}
                  max={SETTING_LIMITS.workdaysPerMonth.max}
                  value={draft.workdaysPerMonth}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      workdaysPerMonth: clampWorkdays(e.target.value, prev.workdaysPerMonth),
                    }))
                  }
                  disabled={!canEdit || isLoading}
                />
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => save("workdays_per_month", draft)}
                  disabled={draft.workdaysPerMonth === settings.workdaysPerMonth || updateSetting.isPending}
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  Gem
                </Button>
              )}
            </div>
          </section>

          {/* ATP */}
          <section className="space-y-3 border-t pt-6">
            <div>
              <h3 className="font-medium">ATP + barsel pr. medarbejder</h3>
              <p className="text-sm text-muted-foreground">
                Fast beløb pr. AKTIV medarbejder pr. måned (sælgere, assistenter og leder).
                Fordeles ud på teamets klienter efter omsætningsandel. Deaktiverede
                medarbejdere tælles ikke med.
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-1.5 w-40">
                <Label htmlFor="atp">Kr. pr. måned</Label>
                <Input
                  id="atp"
                  type="number"
                  min={SETTING_LIMITS.atpBarselRate.min}
                  max={SETTING_LIMITS.atpBarselRate.max}
                  value={draft.atpBarselRate}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      atpBarselRate: clampSettingNumber(
                        e.target.value === "" ? 0 : Number(e.target.value),
                        SETTING_LIMITS.atpBarselRate,
                        prev.atpBarselRate
                      ),
                    }))
                  }
                  disabled={!canEdit || isLoading}
                />
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => save("atp_barsel_rate", draft)}
                  disabled={draft.atpBarselRate === settings.atpBarselRate || updateSetting.isPending}
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  Gem
                </Button>
              )}
            </div>
          </section>

          {/* Stab-team */}
          <section className="space-y-3 border-t pt-6">
            <div>
              <h3 className="font-medium">Stab-team (fællesomkostninger)</h3>
              <p className="text-sm text-muted-foreground">
                Teamet der bærer fællesomkostninger. Dets udgifter indgår IKKE i team-DB,
                men trækkes som overhead efter samlet DB sammen med stabslønninger.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="space-y-1.5 w-full sm:w-80">
                <Label htmlFor="stab-team">Team</Label>
                <Select
                  value={draft.stabTeamId ?? "none"}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      stabTeamId: value === "none" ? null : value,
                    }))
                  }
                  disabled={!canEdit || isLoading}
                >
                  <SelectTrigger id="stab-team">
                    <SelectValue placeholder="Vælg team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Intet team</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Gemt: {teamName(settings.stabTeamId)}
                </p>
              </div>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => save("stab_team_id", draft)}
                  disabled={draft.stabTeamId === settings.stabTeamId || updateSetting.isPending}
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  Gem
                </Button>
              )}
            </div>
          </section>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Hvor bruges satserne?</AlertTitle>
            <AlertDescription className="text-sm">
              Feriepenge indgår i sælger-, assistent-, stabs- og lederomkostningen.
              Arbejdsdage og ATP bruges i DB pr. klient og DB Oversigt. Klienter med
              lokationsudgifter (centre/boder) markeres i klientadministrationen under MG →
              Kunder, så udgifterne følger klienten frem for et hardkodet navn.
              {rows.length > 0 && (
                <span className="block mt-1 text-muted-foreground">
                  Sidst opdateret:{" "}
                  {format(
                    new Date(
                      rows.reduce(
                        (latest, r) =>
                          r.updated_at && r.updated_at > latest ? r.updated_at : latest,
                        rows[0].updated_at ?? new Date().toISOString()
                      )
                    ),
                    "d. MMMM yyyy HH:mm",
                    { locale: da }
                  )}
                </span>
              )}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Ændringslog */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-muted-foreground" />
            Ændringslog
          </CardTitle>
          <CardDescription>Hvem ændrede hvad hvornår.</CardDescription>
        </CardHeader>
        <CardContent>
          {auditRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Ingen ændringer registreret endnu.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tidspunkt</TableHead>
                    <TableHead>Indstilling</TableHead>
                    <TableHead>Fra</TableHead>
                    <TableHead>Til</TableHead>
                    <TableHead>Ændret af</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {format(new Date(row.created_at), "d/M yyyy HH:mm", { locale: da })}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {AUDIT_KEY_LABELS[row.key] ?? row.key}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatAuditValue(row.key, row.old_value)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatAuditValue(row.key, row.new_value)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.changed_by_email ?? "System"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
