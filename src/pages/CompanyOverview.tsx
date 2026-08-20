import { useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TeamAvgTenureChart } from "@/components/company-overview/TeamAvgTenureChart";
import { HeadcountTrendChart } from "@/components/company-overview/HeadcountTrendChart";
import { RevenuePerEmployeeChart } from "@/components/company-overview/RevenuePerEmployeeChart";
import { ChurnConclusion } from "@/components/company-overview/churn/ChurnConclusion";
import { ChurnKpiCards } from "@/components/company-overview/churn/ChurnKpiCards";
import { ChurnSinceLast } from "@/components/company-overview/churn/ChurnSinceLast";
import { ChurnHeatmap } from "@/components/company-overview/churn/ChurnHeatmap";
import { ChurnTeamTable } from "@/components/company-overview/churn/ChurnTeamTable";
import { ChurnDrilldown } from "@/components/company-overview/churn/ChurnDrilldown";
import { ChurnActionsTab } from "@/components/company-overview/churn/ChurnActionsTab";
import { ChurnActionDialog } from "@/components/company-overview/churn/ChurnActionDialog";
import { ChurnMethodTab } from "@/components/company-overview/churn/ChurnMethodTab";
import { useChurnMetrics, useChurnActions } from "@/hooks/useChurnDashboard";
import { useCanManageChurn } from "@/hooks/useCanManageChurn";
import { deriveCompany, deriveTeams, fmtMonth, fmtPct } from "@/lib/churn/metrics";

export default function CompanyOverview() {
  const { data: payload, isLoading, error, dataUpdatedAt } = useChurnMetrics();
  const { data: canEdit = false } = useCanManageChurn();
  const { data: actions = [] } = useChurnActions();

  const [dimension, setDimension] = useState<"teams" | "leaders">("teams");
  const [drilldown, setDrilldown] = useState<{ teamKey: string | null; month: string | null; open: boolean }>({
    teamKey: null,
    month: null,
    open: false,
  });
  const [actionTeam, setActionTeam] = useState<string | null>(null);
  const [actionOpen, setActionOpen] = useState(false);

  const company = useMemo(() => (payload ? deriveCompany(payload) : null), [payload]);
  const teams = useMemo(() => (payload ? deriveTeams(payload) : []), [payload]);
  /** Sidste 6 modne startmåneder pr. team — bruges til tabellens andel. */
  const TABLE_WINDOW_MONTHS = 6;
  const windowByTeam = useMemo(() => {
    const map = new Map<string, { starters: number; exits: number }>();
    if (!payload) return map;
    const months = new Set(payload.mature_months.slice(-TABLE_WINDOW_MONTHS));
    payload.team_months
      .filter((c) => months.has(c.m))
      .forEach((c) => {
        const cur = map.get(c.team_key) ?? { starters: 0, exits: 0 };
        map.set(c.team_key, { starters: cur.starters + c.starters, exits: cur.exits + c.exits });
      });
    return map;
  }, [payload]);

  /** Løbende vindue: startere de seneste 60 dage pr. team + hvor mange af dem der er stoppet. */
  const rollingByTeam = useMemo(() => {
    const map = new Map<string, { starters: number; exits: number }>();
    (payload?.rolling_window?.teams ?? []).forEach((t) => {
      map.set(t.team_key, { starters: t.starters, exits: t.exits });
    });
    return map;
  }, [payload]);
  const selectedTeam = teams.find((t) => t.key === drilldown.teamKey) ?? null;

  const openAction = (teamKey: string) => {
    setActionTeam(teamKey);
    setActionOpen(true);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (error || !payload || !company) {
    return (
      <MainLayout>
        <Alert variant="destructive">
          <AlertDescription>
            Kunne ikke indlæse churn-datagrundlaget. {error instanceof Error ? error.message : "Ukendt fejl."}
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  const s = payload.settings;
  const monthsShown = payload.mature_months.length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Virksomhedsoverblik</h1>
          <p className="text-muted-foreground">
            CEO-overblik over tidligt medarbejderfrafald, bemanding og handlinger
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Dataskæringsdato: {payload.as_of_date}</Badge>
            <Badge variant="outline">
              Seneste opdatering: {new Date(dataUpdatedAt).toLocaleString("da-DK")}
            </Badge>
            <Badge variant="outline">Organisationsscope: alle teams ekskl. stab</Badge>
            <Badge variant="outline">
              Seneste fuldt modne startmåned:{" "}
              {payload.latest_mature_month ? fmtMonth(payload.latest_mature_month) : "Data mangler"}
            </Badge>
            <Badge variant="outline">
              {s.target_60d_rate === null ? "Mål ikke sat" : `Mål: ${fmtPct(s.target_60d_rate)}`}
            </Badge>
          </div>
          {monthsShown < s.official_month_count && (
            <Alert>
              <AlertDescription>
                Kun {monthsShown} fuldt modne startmåneder tilgængelige — perioden udfyldes ikke kunstigt.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Tabs defaultValue="ceo" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ceo">CEO-overblik</TabsTrigger>
            <TabsTrigger value="teams">Team &amp; ledere</TabsTrigger>
            <TabsTrigger value="actions">Handlinger</TabsTrigger>
            <TabsTrigger value="method">Metode &amp; datakvalitet</TabsTrigger>
          </TabsList>

          <TabsContent value="ceo" className="space-y-4">
            <ChurnConclusion payload={payload} company={company} teams={teams} />
            <ChurnKpiCards payload={payload} company={company} />
            <ChurnSinceLast teams={teams} settings={s} onCreateAction={canEdit ? openAction : undefined} />
            <ChurnHeatmap
              payload={payload}
              teams={teams}
              dimension="teams"
              onSelectCell={(teamKey, month) => setDrilldown({ teamKey, month, open: true })}
            />
            <ChurnTeamTable
              teams={teams}
              settings={s}
              immatureTeams={payload.immature_teams}
              latestMatureMonth={payload.latest_mature_month}
              rollingByTeam={rollingByTeam}
              windowByTeam={windowByTeam}
              windowMonths={TABLE_WINDOW_MONTHS}
              rollingWindowStart={payload.rolling_window?.window_start ?? null}
              rollingDays={payload.rolling_window?.days ?? 60}
              onSelectTeam={(teamKey) => setDrilldown({ teamKey, month: null, open: true })}
              onCreateAction={canEdit ? openAction : undefined}
            />

            <Card>
              <CardHeader>
                <CardTitle>Kapacitet og økonomi</CardTitle>
                <CardDescription>
                  Sekundær sektion. Bemanding og indtjening pr. hoved — populationen er ikke identisk med
                  churn-nævneren, se Metode &amp; datakvalitet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <HeadcountTrendChart />
                <RevenuePerEmployeeChart />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="teams" className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Visning:</span>
              <Button
                size="sm"
                variant={dimension === "teams" ? "default" : "outline"}
                onClick={() => setDimension("teams")}
              >
                Teams
              </Button>
              <Button
                size="sm"
                variant={dimension === "leaders" ? "default" : "outline"}
                onClick={() => setDimension("leaders")}
              >
                Ledere
              </Button>
            </div>

            <ChurnHeatmap
              payload={payload}
              teams={teams}
              dimension={dimension}
              onSelectCell={(teamKey, month) => setDrilldown({ teamKey, month, open: true })}
            />

            {dimension === "teams" && (
              <ChurnTeamTable
                teams={teams}
                settings={s}
                immatureTeams={payload.immature_teams}
                latestMatureMonth={payload.latest_mature_month}
                rollingByTeam={rollingByTeam}
                windowByTeam={windowByTeam}
                windowMonths={TABLE_WINDOW_MONTHS}
                rollingWindowStart={payload.rolling_window?.window_start ?? null}
                rollingDays={payload.rolling_window?.days ?? 60}
                onSelectTeam={(teamKey) => setDrilldown({ teamKey, month: null, open: true })}
                onCreateAction={canEdit ? openAction : undefined}
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Anciennitet pr. team</CardTitle>
                <CardDescription>
                  Population: nuværende og stoppede medarbejdere pr. team — ikke den officielle churn-nævner.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TeamAvgTenureChart />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="actions">
            <ChurnActionsTab payload={payload} canEdit={canEdit} />
          </TabsContent>

          <TabsContent value="method">
            <ChurnMethodTab payload={payload} teams={teams} canEdit={canEdit} />
          </TabsContent>
        </Tabs>

        <ChurnDrilldown
          open={drilldown.open}
          onOpenChange={(open) => setDrilldown((d) => ({ ...d, open }))}
          teamKey={drilldown.teamKey}
          month={drilldown.month}
          payload={payload}
          team={selectedTeam}
          actions={actions}
          onCreateAction={canEdit ? openAction : undefined}
        />

        <ChurnActionDialog open={actionOpen} onOpenChange={setActionOpen} teamKey={actionTeam} canEdit={canEdit} />
      </div>
    </MainLayout>
  );
}
