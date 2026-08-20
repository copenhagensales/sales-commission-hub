import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { actionEffect, fmtPct, fmtPp, type ChurnMetricsPayload } from "@/lib/churn/metrics";
import { useChurnActions, useDeleteChurnAction, type ChurnActionRow } from "@/hooks/useChurnDashboard";
import { ChurnActionDialog } from "./ChurnActionDialog";

interface Props {
  payload: ChurnMetricsPayload;
  canEdit: boolean;
}

export function ChurnActionsTab({ payload, canEdit }: Props) {
  const { data: actions = [], isLoading } = useChurnActions();
  const del = useDeleteChurnAction();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ChurnActionRow | null>(null);

  const monthly = payload.monthly.map((m) => ({ ...m, m: m.m.slice(0, 10) }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Handlingsregister</CardTitle>
            <CardDescription>
              Aftalte handlinger pr. team med forventet effekt, første målbare kohorte og faktisk målt effekt.
              {!canEdit && " Du har læseadgang."}
            </CardDescription>
          </div>
          {canEdit && (
            <Button
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Opret handling
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Indlæser handlinger…</p>
          ) : actions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ingen handlinger registreret endnu.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3">Team/leder</th>
                    <th className="py-2 pr-3">Problem</th>
                    <th className="py-2 pr-3">Handling</th>
                    <th className="py-2 pr-3">Ansvarlig</th>
                    <th className="py-2 pr-3">Startdato</th>
                    <th className="py-2 pr-3">Deadline</th>
                    <th className="py-2 pr-3">Forventet effekt</th>
                    <th className="py-2 pr-3">Første målbare kohorte</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Faktisk effekt</th>
                    <th className="py-2 pr-3">Beslutning</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => {
                    const effect = a.first_measurable_cohort_month
                      ? actionEffect(monthly, a.first_measurable_cohort_month, payload.as_of_date, payload.settings.official_horizon_days)
                      : null;
                    return (
                      <tr
                        key={a.id}
                        className="border-b last:border-0 hover:bg-muted/40 cursor-pointer"
                        onClick={() => {
                          if (!canEdit) return;
                          setEditing(a);
                          setDialogOpen(true);
                        }}
                      >
                        <td className="py-2 pr-3 whitespace-nowrap">{a.team_key ?? "Virksomheden"}</td>
                        <td className="py-2 pr-3 max-w-[16rem]">{a.problem_statement}</td>
                        <td className="py-2 pr-3 max-w-[16rem]">{a.action_description}</td>
                        <td className="py-2 pr-3">{a.owner_name ?? "–"}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{a.start_date}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{a.due_date ?? "–"}</td>
                        <td className="py-2 pr-3">{a.expected_effect_pp === null ? "–" : fmtPp(a.expected_effect_pp)}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{a.first_measurable_cohort_month ?? "–"}</td>
                        <td className="py-2 pr-3">
                          <Badge variant="outline">{a.status}</Badge>
                        </td>
                        <td className="py-2 pr-3">
                          {a.actual_effect_pp !== null
                            ? fmtPp(a.actual_effect_pp)
                            : effect?.measurable
                              ? `${fmtPp(effect.deltaPp)} (målt: ${fmtPct(effect.baseline.rate)} → ${fmtPct(effect.after.rate)}, ${effect.baseline.n}→${effect.after.n} startere, ≈ ${Math.round(effect.peopleImpact ?? 0)} personer)`
                              : "Effekten kan endnu ikke vurderes"}
                        </td>
                        <td className="py-2 pr-3">{a.decision}</td>
                        <td className="py-2">
                          {canEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                del.mutate(a.id);
                              }}
                              aria-label="Slet handling"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <ChurnActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        teamKey={editing?.team_key ?? null}
        action={editing}
        canEdit={canEdit}
      />
    </div>
  );
}
