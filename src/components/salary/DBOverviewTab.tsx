import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  TrendingUp,
  Calendar,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
} from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";
import { DBTeamDetailCard } from "./DBTeamDetailCard";
import { DBPeriodSelector } from "./DBPeriodSelector";
import { DBDailyBreakdown } from "./DBDailyBreakdown";
import { useClientDbData, type DbPeriodMode, type TeamDbSummary } from "@/hooks/useClientDbData";
import { useCalculationSettings } from "@/hooks/useCalculationSettings";

/**
 * DB Oversigt pr. team.
 *
 * Læser fra `useClientDbData` — SAMME kilde som "DB per klient" — så et team
 * altid får samme lederløn, assistentløn og ATP i begge faner. Omsætningen
 * følger klientens team (`team_clients`), jf. ejerskabsreglen for salg.
 */
export function DBOverviewTab() {
  const [periodStart, setPeriodStart] = useState(() => startOfMonth(new Date()));
  const [periodEnd, setPeriodEnd] = useState(() => endOfMonth(new Date()));
  const [periodMode, setPeriodMode] = useState<DbPeriodMode>("month");
  const [selectedPresetLabel, setSelectedPresetLabel] = useState<string | undefined>("Denne måned");
  const [selectedTeam, setSelectedTeam] = useState<TeamDbSummary | null>(null);
  const [dailyViewTeam, setDailyViewTeam] = useState<TeamDbSummary | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [hideInactiveTeams, setHideInactiveTeams] = useState(true);

  const { settings } = useCalculationSettings();

  const handlePeriodChange = (start: Date, end: Date) => {
    setPeriodStart(start);
    setPeriodEnd(end);
  };

  const { teamSummaries, isLoading, isCapped } = useClientDbData({
    periodStart,
    periodEnd,
    periodMode,
    capAtToday: true,
  });

  const teams = useMemo(() => {
    const list = hideInactiveTeams
      ? teamSummaries.filter(
          (t) =>
            t.adjustedRevenue !== 0 ||
            t.assistantCost !== 0 ||
            t.atpCost !== 0 ||
            t.teamExpenses !== 0
        )
      : teamSummaries;
    return [...list].sort((a, b) => b.finalDb - a.finalDb);
  }, [teamSummaries, hideInactiveTeams]);

  const hiddenCount = teamSummaries.length - teams.length;

  const totals = teams.reduce(
    (acc, t) => ({
      revenue: acc.revenue + t.adjustedRevenue,
      sellerSalaryCosts: acc.sellerSalaryCosts + t.sellerSalaryCost,
      assistantSalary: acc.assistantSalary + t.assistantCost,
      atpCost: acc.atpCost + t.atpCost,
      otherCosts: acc.otherCosts + t.locationCosts + t.teamExpenses + t.sickPayAmount,
      leaderSalary: acc.leaderSalary + t.leader.totalCost,
      db: acc.db + t.finalDb,
    }),
    {
      revenue: 0,
      sellerSalaryCosts: 0,
      assistantSalary: 0,
      atpCost: 0,
      otherCosts: 0,
      leaderSalary: 0,
      db: 0,
    }
  );

  const missingBasisTeams = teams.filter(
    (t) => !t.leader.hasBasis || t.assistantsMissingBasis.length > 0
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle>Dækningsbidrag (DB) oversigt</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="hide-inactive-teams"
              checked={hideInactiveTeams}
              onCheckedChange={setHideInactiveTeams}
            />
            <Label htmlFor="hide-inactive-teams" className="text-sm text-muted-foreground">
              Skjul teams uden aktivitet
              {hiddenCount > 0 && <span className="text-xs"> ({hiddenCount})</span>}
            </Label>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <DBPeriodSelector
            periodStart={periodStart}
            periodEnd={periodEnd}
            onChange={handlePeriodChange}
            mode={periodMode}
            onModeChange={setPeriodMode}
            selectedPresetLabel={selectedPresetLabel}
            onPresetLabelChange={setSelectedPresetLabel}
          />

          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            <span>
              Omsætningen følger klientens team. Samme grundlag som "DB per klient" — lederløn
              og assistentløn er derfor identiske i de to faner.
            </span>
            {isCapped && <Badge variant="outline">Periode skåret ved i dag</Badge>}
          </div>

          {missingBasisTeams.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-destructive">
                <AlertTriangle className="h-4 w-4" />
                {missingBasisTeams.length} team(s) mangler grundlag
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {missingBasisTeams.map((t) => t.teamName).join(", ")} — beløbet er ikke 0 kr., det
                kan ikke beregnes. Ret lønrække eller procentsats under Opsætning → Personale løn.
              </p>
            </div>
          )}

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Team</TableHead>
                  <TableHead className="text-right">Omsætning</TableHead>
                  <TableHead className="text-right">Sælgerløn</TableHead>
                  <TableHead className="text-right">Assist.løn</TableHead>
                  <TableHead className="text-right">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger className="flex items-center gap-1 ml-auto">
                          Øvrige
                          <HelpCircle className="h-3 w-3 opacity-60" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Sygefravær + lokationsudgifter + teamudgifter
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableHead>
                  <TableHead className="text-right">ATP/barsel</TableHead>
                  <TableHead className="text-right">Lederløn</TableHead>
                  <TableHead className="text-right">DB</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Indlæser...
                    </TableCell>
                  </TableRow>
                ) : teams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Ingen teams med aktivitet i perioden
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {teams.map((team) => {
                      const isExpanded = expandedTeamId === team.teamId;
                      const otherCosts =
                        team.locationCosts + team.teamExpenses + team.sickPayAmount;

                      return (
                        <>
                          <TableRow
                            key={team.teamId}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setExpandedTeamId(isExpanded ? null : team.teamId)}
                          >
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-1">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                )}
                                {team.teamName}
                                {(!team.leader.hasBasis ||
                                  team.assistantsMissingBasis.length > 0) && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        {!team.leader.hasBasis
                                          ? "Lederlønnen mangler grundlag"
                                          : "En eller flere assistenter mangler lønrække"}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(team.adjustedRevenue)}
                            </TableCell>
                            <TableCell className="text-right text-destructive tabular-nums">
                              -{formatCurrency(team.sellerSalaryCost)}
                            </TableCell>
                            <TableCell className="text-right text-destructive tabular-nums">
                              {team.assistantsMissingBasis.length > 0 && team.assistantCost === 0
                                ? "mangler grundlag"
                                : `-${formatCurrency(team.assistantCost)}`}
                            </TableCell>
                            <TableCell className="text-right text-destructive tabular-nums">
                              -{formatCurrency(otherCosts)}
                            </TableCell>
                            <TableCell className="text-right text-destructive tabular-nums">
                              -{formatCurrency(team.atpCost)}
                            </TableCell>
                            <TableCell className="text-right text-destructive tabular-nums">
                              {team.leader.hasBasis
                                ? `-${formatCurrency(team.leader.totalCost)}`
                                : "mangler grundlag"}
                            </TableCell>
                            <TableCell className="text-right font-medium tabular-nums">
                              {formatCurrency(team.finalDb)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedTeam(team);
                                  }}
                                >
                                  <HelpCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDailyViewTeam(team);
                                  }}
                                >
                                  <Calendar className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow
                              key={`${team.teamId}-expanded`}
                              className="bg-muted/30 hover:bg-muted/30"
                            >
                              <TableCell colSpan={9} className="py-3 px-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">Teamleder</p>
                                    <p className="font-medium">{team.leaderName}</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Procentsats</p>
                                    <p className="font-medium">{team.percentageRate} %</p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      Minimumsløn (prorateret)
                                    </p>
                                    <p className="font-medium">
                                      {formatCurrency(team.leader.proratedMinimum)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">DB før lederløn</p>
                                    <p className="font-medium">
                                      {formatCurrency(team.dbBeforeLeader)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      Beregnet ({team.percentageRate} % af DB)
                                    </p>
                                    <p className="font-medium">
                                      {formatCurrency(team.leader.calculated)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Endelig lederløn</p>
                                    <p className="font-medium text-destructive">
                                      {team.leader.hasBasis ? (
                                        <>
                                          {formatCurrency(team.leader.salary)}{" "}
                                          {team.leader.usesMinimum && (
                                            <span className="text-xs text-muted-foreground">
                                              (minimum)
                                            </span>
                                          )}
                                        </>
                                      ) : (
                                        "mangler grundlag"
                                      )}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">Aktive medarbejdere</p>
                                    <p className="font-medium">{team.activeMemberCount}</p>
                                  </div>
                                  {team.assistantNames.length > 0 && (
                                    <div>
                                      <p className="text-muted-foreground">Assistenter</p>
                                      <p className="font-medium">
                                        {team.assistantNames.join(", ")}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      );
                    })}
                    <TableRow className="bg-muted/50 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(totals.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-destructive tabular-nums">
                        -{formatCurrency(totals.sellerSalaryCosts)}
                      </TableCell>
                      <TableCell className="text-right text-destructive tabular-nums">
                        -{formatCurrency(totals.assistantSalary)}
                      </TableCell>
                      <TableCell className="text-right text-destructive tabular-nums">
                        -{formatCurrency(totals.otherCosts)}
                      </TableCell>
                      <TableCell className="text-right text-destructive tabular-nums">
                        -{formatCurrency(totals.atpCost)}
                      </TableCell>
                      <TableCell className="text-right text-destructive tabular-nums">
                        -{formatCurrency(totals.leaderSalary)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(totals.db)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground">Klik på et team for at se detaljer</p>
        </CardContent>
      </Card>

      {selectedTeam && (
        <DBTeamDetailCard
          team={selectedTeam}
          leaderVacationRate={settings.vacationPayRates.leader}
          onClose={() => setSelectedTeam(null)}
        />
      )}

      {dailyViewTeam && (
        <DBDailyBreakdown
          teamId={dailyViewTeam.teamId}
          teamName={dailyViewTeam.teamName}
          periodStart={periodStart}
          periodEnd={periodEnd}
          onClose={() => setDailyViewTeam(null)}
        />
      )}
    </div>
  );
}
