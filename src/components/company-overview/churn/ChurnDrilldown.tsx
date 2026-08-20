import { useMemo } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { fmtPct, fmtPp, rate, STATUS_CLASSES, type ChurnMetricsPayload, type DerivedGroup } from "@/lib/churn/metrics";
import { formatMonth } from "./ChurnHeatmap";
import type { ChurnActionRow } from "@/hooks/useChurnDashboard";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamKey: string | null;
  month: string | null;
  payload: ChurnMetricsPayload;
  team: DerivedGroup | null;
  actions: ChurnActionRow[];
  onCreateAction?: (teamKey: string) => void;
}

export function ChurnDrilldown({ open, onOpenChange, teamKey, month, payload, team, actions, onCreateAction }: Props) {
  const settings = payload.settings;
  const hasTarget = settings.target_60d_rate !== null && settings.target_60d_rate !== undefined;

  const monthRows = useMemo(
    () =>
      payload.team_months
        .filter((c) => c.team_key === teamKey)
        .map((c) => ({ ...c, m: c.m.slice(0, 10) }))
        .sort((a, b) => a.m.localeCompare(b.m)),
    [payload.team_months, teamKey],
  );

  const bandData = useMemo(() => {
    const src = month ? monthRows.filter((r) => r.m === month) : monthRows;
    const agg = src.reduce(
      (acc, r) => ({
        b0_7: acc.b0_7 + r.b0_7,
        b8_14: acc.b8_14 + r.b8_14,
        b15_30: acc.b15_30 + r.b15_30,
        b31_60: acc.b31_60 + r.b31_60,
        starters: acc.starters + r.starters,
        exits: acc.exits + r.exits,
      }),
      { b0_7: 0, b8_14: 0, b15_30: 0, b31_60: 0, starters: 0, exits: 0 },
    );
    return {
      agg,
      chart: [
        {
          navn: month ? formatMonth(month) : "12 modne måneder",
          "Dag 0-7": agg.b0_7,
          "Dag 8-14": agg.b8_14,
          "Dag 15-30": agg.b15_30,
          "Dag 31-60": agg.b31_60,
          "Fastholdt efter 60 dage": agg.starters - agg.exits,
        },
      ],
    };
  }, [monthRows, month]);

  const teamActions = actions.filter((a) => a.team_key === teamKey);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{teamKey ?? "Team"}</SheetTitle>
          <SheetDescription>
            {month
              ? `Startmåned ${formatMonth(month)}`
              : `${payload.mature_months.length} fuldt modne startmåneder`}
          </SheetDescription>
        </SheetHeader>

        {!team ? (
          <p className="text-sm text-muted-foreground mt-6">Data mangler for dette team.</p>
        ) : (
          <div className="space-y-5 mt-6 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Modne startere" value={String(bandData.agg.starters)} />
              <Stat
                label="60-dages rate"
                value={`${fmtPct(rate(bandData.agg.exits, bandData.agg.starters))} · ${bandData.agg.exits}/${bandData.agg.starters}`}
              />
              <Stat label="Seneste 3" value={`${fmtPct(team.recent.rate)} · ${team.recent.x}/${team.recent.n}`} />
              <Stat label="Foregående 3" value={`${fmtPct(team.previous.rate)} · ${team.previous.x}/${team.previous.n}`} />
              <Stat label="Udvikling" value={team.lowData ? "Lavt datagrundlag" : fmtPp(team.deltaPp)} />
              <Stat label="Mål-gap" value={hasTarget ? fmtPp(team.gapPp) : "Mål ikke sat"} />
              <Stat
                label="Merfrafald"
                value={team.excessExits === null ? "Mål ikke sat" : team.excessExits.toFixed(1).replace(".", ",")}
              />
              <Stat label="Startervolumen (12 mdr)" value={String(team.starters)} />
            </div>

            <Badge variant="outline" className={STATUS_CLASSES[team.status.key]}>
              {team.status.label}
            </Badge>

            <Separator />

            <div>
              <h4 className="font-semibold mb-2">Exitperioder</h4>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bandData.chart}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="navn" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Dag 0-7" stackId="a" fill="hsl(0 72% 51%)" />
                    <Bar dataKey="Dag 8-14" stackId="a" fill="hsl(25 95% 53%)" />
                    <Bar dataKey="Dag 15-30" stackId="a" fill="hsl(45 93% 47%)" />
                    <Bar dataKey="Dag 31-60" stackId="a" fill="hsl(217 91% 60%)" />
                    <Bar dataKey="Fastholdt efter 60 dage" stackId="a" fill="hsl(160 84% 39%)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-1">Historik pr. startmåned</h4>
              <div className="space-y-1">
                {monthRows.map((r) => (
                  <div key={r.m} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{formatMonth(r.m)}</span>
                    <span>
                      {fmtPct(rate(r.exits, r.starters))} · {r.exits}/{r.starters}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            <div className="space-y-1">
              <h4 className="font-semibold">Stopårsager</h4>
              <p className="text-muted-foreground text-xs">
                Ikke tilgængeligt i nuværende datakilde — der registreres ingen stopårsag på ansættelsesforløb.
              </p>
              <h4 className="font-semibold pt-2">Rekrutteringskilde og kampagne</h4>
              <p className="text-muted-foreground text-xs">Ikke tilgængeligt i nuværende datakilde.</p>
              <h4 className="font-semibold pt-2">Ledere ved start</h4>
              <p className="text-muted-foreground text-xs">Historisk lederdata mangler.</p>
              <h4 className="font-semibold pt-2">Tid til første salg</h4>
              <p className="text-muted-foreground text-xs">
                Datakilde ikke tilgængelig — salgshistorik kan ikke kobles til ansættelsesforløb uden employee-id på
                historiske ansættelser.
              </p>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">Aktive handlinger</h4>
                {onCreateAction && teamKey && (
                  <Button size="sm" variant="outline" onClick={() => onCreateAction(teamKey)}>
                    Opret handling
                  </Button>
                )}
              </div>
              {teamActions.length === 0 ? (
                <p className="text-xs text-muted-foreground">Ingen handlinger registreret for dette team.</p>
              ) : (
                teamActions.map((a) => (
                  <div key={a.id} className="text-xs border rounded p-2 mb-2">
                    <div className="font-medium">{a.action_description}</div>
                    <div className="text-muted-foreground">
                      {a.start_date} · {a.status} · første målbare kohorte: {a.first_measurable_cohort_month ?? "–"}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div>
              <h4 className="font-semibold mb-1">Datakvalitet</h4>
              <p className="text-xs text-muted-foreground">
                Ukendt team i alt: {payload.quality.unknown_team} · ukendt leder: {payload.quality.unknown_leader} ·
                ukendt stopårsag: {payload.quality.unknown_exit_reason}
              </p>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
