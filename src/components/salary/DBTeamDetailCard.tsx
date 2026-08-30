import { formatCurrency } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { X, AlertTriangle } from "lucide-react";
import { formatRatePercent } from "@/lib/calculations/calculationSettings";
import type { TeamDbSummary } from "@/hooks/useClientDbData";

interface DBTeamDetailCardProps {
  team: TeamDbSummary;
  /** Feriepengesats for teamledere (bruges kun til forklarende tekst) */
  leaderVacationRate: number;
  onClose: () => void;
}

/**
 * Detaljeret DB for et team — viser den fælles beregningsrækkefølge fra
 * `dbModel.ts`, så tallene stemmer med DB per klient.
 */
export function DBTeamDetailCard({ team, leaderVacationRate, onClose }: DBTeamDetailCardProps) {
  const row = (label: string, amount: number, options?: { negative?: boolean; muted?: boolean }) => (
    <div className="flex justify-between text-sm">
      <span className={options?.muted ? "text-muted-foreground" : undefined}>{label}</span>
      <span
        className={
          options?.negative
            ? "text-destructive tabular-nums"
            : "font-medium tabular-nums"
        }
      >
        {options?.negative ? `-${formatCurrency(amount)}` : formatCurrency(amount)}
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Team: {team.teamName} — detaljeret DB</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Teamleder</p>
            <p className="font-medium flex items-center gap-2">
              {team.leaderName}
              {!team.leader.hasBasis && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> mangler grundlag
                </Badge>
              )}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Assistenter (aktive)</p>
            <p className="font-medium">
              {team.assistantNames.length > 0 ? team.assistantNames.join(", ") : "–"}
            </p>
            {team.assistantsMissingBasis.length > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                {team.assistantsMissingBasis.length} uden lønrække
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">
            Omsætning &amp; omkostninger ({team.clientCount} klienter)
          </h4>
          {row("Omsætning (klienter på teamet)", team.adjustedRevenue)}
          {row("Sælgerløn (provision + feriepenge)", team.sellerSalaryCost, { negative: true })}
          {team.sickPayAmount > 0 && row("Sygefravær", team.sickPayAmount, { negative: true })}
          {team.locationCosts > 0 &&
            row("Lokationsudgifter (centre/boder)", team.locationCosts, { negative: true })}
          {team.teamExpenses > 0 && row("Teamudgifter", team.teamExpenses, { negative: true })}
          {row("Assistentløn (inkl. feriepenge)", team.assistantCost, { negative: true })}
          {row(
            `ATP + barsel (${team.activeMemberCount} aktive)`,
            team.atpCost,
            { negative: true }
          )}
          <Separator />
          <div className="flex justify-between font-medium">
            <span>DB før lederløn</span>
            <span className="tabular-nums">{formatCurrency(team.dbBeforeLeader)}</span>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <h4 className="font-medium text-sm text-muted-foreground">Lederløn</h4>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            {team.leader.hasBasis ? (
              <>
                {row(
                  `Beregnet: ${formatCurrency(team.dbBeforeLeader)} × ${team.percentageRate} %`,
                  team.leader.calculated,
                  { muted: true }
                )}
                {row("Minimumsløn (prorateret)", team.leader.proratedMinimum, { muted: true })}
                <Separator />
                {row(
                  `Lederløn${team.leader.usesMinimum ? " (minimum)" : ""}`,
                  team.leader.salary,
                  { negative: true }
                )}
                {row(
                  `Lederens feriepenge (${formatRatePercent(leaderVacationRate)})`,
                  team.leader.vacationPay,
                  { negative: true }
                )}
              </>
            ) : (
              <p className="text-sm text-destructive">
                Lederlønnen kan ikke beregnes — teamet mangler leder, aktiv lønrække eller
                procentsats. Beløbet vises som "mangler grundlag", ikke som 0 kr.
              </p>
            )}
          </div>
        </div>

        <Separator />

        <div className="bg-primary/10 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-lg">Dækningsbidrag (DB)</span>
            <span className="font-bold text-xl text-primary tabular-nums">
              {formatCurrency(team.finalDb)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Omsætning − sælgerløn − sygefravær − lokation − teamudgifter − assistentløn − ATP −
            lederløn (inkl. feriepenge)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
