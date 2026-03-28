import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCcw, Activity, AlertTriangle, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow, format } from "date-fns";
import { da } from "date-fns/locale";
import { ScheduleEditor } from "@/components/system-stability/ScheduleEditor";
import { TimelineOverlap } from "@/components/system-stability/TimelineOverlap";
import { AuditLog } from "@/components/system-stability/AuditLog";
import { DataHealthChecks } from "@/components/system-stability/DataHealthChecks";
import { AlertBanner } from "@/components/system-stability/AlertBanner";
import { SystemArchitectureDiagram } from "@/components/system-stability/SystemArchitectureDiagram";
import { LiveCronStatus } from "@/components/system-stability/LiveCronStatus";
import { WebhookActivity } from "@/components/system-stability/WebhookActivity";
import { SystemStatusMap } from "@/components/system-stability/SystemStatusMap";
import { useStabilityAlerts, type ProviderBudget } from "@/hooks/useStabilityAlerts";
import { MainLayout } from "@/components/layout/MainLayout";

interface SyncRun {
  id: string;
  integration_id: string;
  integration_name?: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: string;
  actions: string[] | null;
  records_processed: number;
  api_calls_made: number;
  retries: number;
  rate_limit_hits: number;
  error_message: string | null;
}

interface AuditEntry {
  id: string;
  integration_id: string;
  changed_by: string | null;
  change_type: string;
  old_config: any;
  new_config: any;
  old_schedule: string | null;
  new_schedule: string | null;
  created_at: string;
}

function getStatusColor(successRate: number, rateLimitRate: number): "green" | "yellow" | "red" {
  if (successRate < 80 || rateLimitRate > 10) return "red";
  if (successRate < 95 || rateLimitRate > 5) return "yellow";
  return "green";
}

const statusColorMap = {
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-red-500",
};

const statusLabelMap = {
  green: "OK",
  yellow: "Advarsel",
  red: "Kritisk",
};

export default function SystemStability() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch integrations
  const { data: integrations = [], refetch: refetchIntegrations } = useQuery({
    queryKey: ["system-stability-integrations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dialer_integrations")
        .select("id, name, provider, last_sync_at, last_status, is_active, config, sync_frequency_minutes")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Fetch recent sync runs (last 24h)
  const { data: syncRuns = [], refetch: refetchRuns } = useQuery({
    queryKey: ["system-stability-sync-runs"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("integration_sync_runs")
        .select("*")
        .gte("started_at", since)
        .order("started_at", { ascending: false })
        .limit(200);
      return (data || []) as SyncRun[];
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Fetch integration logs as fallback metrics (last 24h)
  const { data: recentLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ["system-stability-logs"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("integration_logs")
        .select("id, integration_id, integration_name, status, message, created_at, duration_ms, api_calls, retries, rate_limit_hits")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Fetch actual cron jobs for timeline
  const { data: cronJobs = [] } = useQuery({
    queryKey: ["system-stability-cron-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_cron_jobs" as any);
      if (error) {
        console.warn("Could not fetch cron jobs:", error.message);
        return [];
      }
      return (data || []) as unknown as { jobname: string; schedule: string }[];
    },
    staleTime: 60000,
  });

  // Fetch audit log
  const { data: auditLog = [], refetch: refetchAudit } = useQuery({
    queryKey: ["system-stability-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_schedule_audit")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as AuditEntry[];
    },
    refetchInterval: 60000,
  });

  // Compute metrics per integration
  const integrationMetrics = integrations.map((int: any) => {
    const now = Date.now();
    const fifteenMinAgo = now - 15 * 60 * 1000;
    const oneHourAgo = now - 60 * 60 * 1000;

    const intRuns = syncRuns.filter(r => r.integration_id === int.id);
    const intLogs = recentLogs.filter((l: any) => l.integration_id === int.id);

    const runs1h = intRuns.length > 0
      ? intRuns.filter(r => new Date(r.started_at).getTime() > oneHourAgo)
      : intLogs.filter((l: any) => new Date(l.created_at).getTime() > oneHourAgo);
    // Count success + partial_success as non-errors; skipped_locked is neutral (excluded from denominator)
    const meaningfulRuns = runs1h.filter((r: any) => r.status !== "skipped_locked" && r.status !== "skipped");
    const successCount = meaningfulRuns.filter((r: any) => r.status === "success" || r.status === "partial_success").length;
    const successRate1h = meaningfulRuns.length > 0 ? (successCount / meaningfulRuns.length) * 100 : 100;

    const runs15m = intRuns.length > 0
      ? intRuns.filter(r => new Date(r.started_at).getTime() > fifteenMinAgo)
      : intLogs.filter((l: any) => new Date(l.created_at).getTime() > fifteenMinAgo);
    const totalApiCalls = runs15m.reduce((sum: number, r: any) => sum + (r.api_calls_made || r.api_calls || 0), 0);
    const totalRateLimitHits = runs15m.reduce((sum: number, r: any) => sum + (r.rate_limit_hits || 0), 0);
    const rateLimitRate15m = totalApiCalls > 0 ? (totalRateLimitHits / totalApiCalls) * 100 : 0;

    const withDuration = intRuns.length > 0
      ? intRuns.filter(r => r.duration_ms != null)
      : intLogs.filter((l: any) => l.duration_ms != null);
    const avgDurationMs = withDuration.length > 0
      ? withDuration.reduce((sum: number, r: any) => sum + (r.duration_ms || 0), 0) / withDuration.length
      : 0;

    return {
      ...int,
      successRate1h,
      rateLimitRate15m,
      avgDurationMs,
      totalApiCalls15m: totalApiCalls,
      lastRuns: intRuns.slice(0, 5),
    };
  });

  // Per-provider rate limit budget
  const PROVIDER_LIMITS: Record<string, { limitPerMin: number; limitPerHour: number }> = {
    adversus: { limitPerMin: 60, limitPerHour: 1000 },
    enreach: { limitPerMin: 240, limitPerHour: 10000 },
  };
  const DEFAULT_LIMITS = { limitPerMin: 60, limitPerHour: 1000 };

  const now1m = Date.now() - 60 * 1000;
  const now60m = Date.now() - 60 * 60 * 1000;
  const allRuns = syncRuns.length > 0 ? syncRuns : recentLogs;

  // Per-integration rate limit budget (each integration has its own API credentials)
  const integrationBudgets: (ProviderBudget & { providerType: string; calls1m: number; limit1m: number; calls60m: number; limit60m: number })[] = [];
  for (const int of integrations as any[]) {
    const provider = (int.provider || "unknown").toLowerCase();
    const limits = PROVIDER_LIMITS[provider] || DEFAULT_LIMITS;
    const intRuns = allRuns.filter((r: any) => r.integration_id === int.id);
    const calls1m = intRuns
      .filter((r: any) => new Date(r.started_at || r.created_at).getTime() > now1m)
      .reduce((sum: number, r: any) => sum + (r.api_calls_made || r.api_calls || 0), 0);
    const calls60m = intRuns
      .filter((r: any) => new Date(r.started_at || r.created_at).getTime() > now60m)
      .reduce((sum: number, r: any) => sum + (r.api_calls_made || r.api_calls || 0), 0);

    integrationBudgets.push({
      provider: int.name,
      providerType: provider,
      calls1m,
      limit1m: limits.limitPerMin,
      used1m: Math.min((calls1m / limits.limitPerMin) * 100, 100),
      calls60m,
      limit60m: limits.limitPerHour,
      used60m: Math.min((calls60m / limits.limitPerHour) * 100, 100),
    });
  }

  // Runs table data
  const runsTableData = syncRuns.length > 0
    ? syncRuns.slice(0, 30).map(r => ({
        ...r,
        integration_name: integrations.find((i: any) => i.id === r.integration_id)?.name || "Ukendt",
      }))
    : recentLogs.slice(0, 30).map((l: any) => ({
        id: l.id,
        integration_id: l.integration_id,
        integration_name: l.integration_name || "Ukendt",
        started_at: l.created_at,
        completed_at: null,
        duration_ms: l.duration_ms,
        status: l.status,
        actions: null,
        records_processed: 0,
        api_calls_made: l.api_calls || 0,
        retries: l.retries || 0,
        rate_limit_hits: l.rate_limit_hits || 0,
        error_message: l.status === "error" ? l.message : null,
      }));

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refetchRuns(), refetchLogs(), refetchAudit(), refetchIntegrations()]);
    setIsRefreshing(false);
  };

  const alerts = useStabilityAlerts({
    integrationMetrics,
    providerBudgets: integrationBudgets,
  });

  return (
    <MainLayout>
      <div className="container mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Systemstabilitet</h1>
            <p className="text-sm text-muted-foreground">Realtids-overblik over integrationers sundhed</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
            Opdater
          </Button>
        </div>

        {/* Alert Banner */}
        <AlertBanner alerts={alerts} />

        {/* Tabs */}
        <Tabs defaultValue="stability" className="space-y-4">
          <TabsList>
            <TabsTrigger value="stability">Systemstabilitet</TabsTrigger>
            <TabsTrigger value="setup">System Opsætning</TabsTrigger>
            <TabsTrigger value="map">System Kort</TabsTrigger>
          </TabsList>

          {/* Tab 1: Existing stability content */}
          <TabsContent value="stability" className="space-y-6">
            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {integrationMetrics.map((int: any) => {
                const color = getStatusColor(int.successRate1h, int.rateLimitRate15m);
                return (
                  <Card key={int.id} className="relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${statusColorMap[color]}`} />
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-semibold">{int.name}</CardTitle>
                        <Badge variant={color === "green" ? "default" : color === "yellow" ? "secondary" : "destructive"} className="text-xs">
                          {statusLabelMap[color]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">429-rate (15m)</span>
                        <span className={int.rateLimitRate15m > 5 ? "text-destructive font-medium" : "text-foreground"}>
                          {int.rateLimitRate15m.toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Succes (1t)</span>
                        <span className={int.successRate1h < 95 ? "text-amber-500 font-medium" : "text-foreground"}>
                          {int.successRate1h.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sidste sync</span>
                        <span className="text-foreground">
                          {int.last_sync_at ? formatDistanceToNow(new Date(int.last_sync_at), { addSuffix: true, locale: da }) : "Aldrig"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Gns. varighed</span>
                        <span className="text-foreground">
                          {int.avgDurationMs > 0 ? `${(int.avgDurationMs / 1000).toFixed(1)}s` : "–"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Provider</span>
                        <span className="text-foreground capitalize">{int.provider}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Rate Limit Budget per Integration */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrationBudgets.map((pb) => (
                <Card key={pb.provider}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      {pb.provider}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground capitalize">
                      {pb.providerType} – {pb.limit1m}/min, {pb.limit60m}/time
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Burst (1 min)</span>
                        <span className="font-medium">{pb.calls1m} / {pb.limit1m} ({pb.used1m.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${pb.used1m > 80 ? "bg-destructive" : pb.used1m > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${pb.used1m}%` }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Time (60 min)</span>
                        <span className="font-medium">{pb.calls60m} / {pb.limit60m} ({pb.used60m.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${pb.used60m > 80 ? "bg-destructive" : pb.used60m > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${pb.used60m}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Timeline Overlap Visualization */}
            <TimelineOverlap integrations={integrations as any} cronJobs={cronJobs} />

            {/* Schedule Editor */}
            <ScheduleEditor integrations={integrations as any} onScheduleUpdated={handleRefresh} />

            {/* Recent Runs Table */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Seneste Sync Runs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tid</TableHead>
                      <TableHead>Integration</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Data</TableHead>
                      <TableHead className="text-right">Varighed</TableHead>
                      <TableHead className="text-right">API</TableHead>
                      <TableHead className="text-right">429s</TableHead>
                      <TableHead className="text-right">Retries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runsTableData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          Ingen sync runs endnu.
                        </TableCell>
                      </TableRow>
                    ) : (
                      runsTableData.map((run: any) => (
                        <TableRow key={run.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(run.started_at), "dd/MM HH:mm:ss")}
                          </TableCell>
                          <TableCell className="text-xs font-medium">{run.integration_name}</TableCell>
                          <TableCell>
                            {(() => {
                              const actions: string[] = run.actions || [];
                              const hasMeta = actions.some((a: string) => a === "campaigns" || a === "users");
                              const hasSales = actions.includes("sales");
                              const hasCalls = actions.includes("calls");
                              const hasData = hasSales || hasCalls || actions.includes("sessions");
                              if (hasMeta && hasData) return <Badge variant="secondary" className="text-xs bg-indigo-500/10 text-indigo-600 border-indigo-200">Fuld</Badge>;
                              if (hasMeta) return <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 border-blue-200">Meta</Badge>;
                              if (hasSales) return <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200">Sales</Badge>;
                              if (hasCalls) return <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 border-purple-200">Calls</Badge>;
                              if (actions.length > 0) return <Badge variant="secondary" className="text-xs">{actions.join(", ")}</Badge>;
                              return <span className="text-xs text-muted-foreground">–</span>;
                            })()}
                          </TableCell>
                          <TableCell>
                          {run.status === "success" && ((run.rate_limit_hits || 0) > 0 || (run.retries || 0) > 0) ? (
                              <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Degraderet
                              </Badge>
                            ) : run.status === "success" ? (
                              <Badge variant="default" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                              </Badge>
                            ) : run.status === "error" ? (
                              <Badge variant="destructive" className="text-xs">
                                <XCircle className="h-3 w-3 mr-1" /> Fejl
                              </Badge>
                            ) : run.status === "partial_success" ? (
                              <Badge variant="secondary" className="text-xs bg-amber-500/10 text-amber-600 border-amber-200">
                                <AlertTriangle className="h-3 w-3 mr-1" /> Delvis
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" /> {run.status}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className={`text-xs text-right ${(run.records_processed || 0) === 0 ? "text-muted-foreground" : (run.records_processed || 0) > 1000 ? "font-semibold text-foreground" : "text-foreground"}`}>
                            {(run.records_processed || 0).toLocaleString("da-DK")}
                          </TableCell>
                          <TableCell className="text-xs text-right">
                            {run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : "–"}
                          </TableCell>
                          <TableCell className="text-xs text-right">{run.api_calls_made || 0}</TableCell>
                          <TableCell className={`text-xs text-right ${(run.rate_limit_hits || 0) > 0 ? "text-destructive font-medium" : ""}`}>
                            {run.rate_limit_hits || 0}
                          </TableCell>
                          <TableCell className={`text-xs text-right ${(run.retries || 0) > 0 ? "text-amber-500 font-medium" : ""}`}>
                            {run.retries || 0}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Data Health Checks */}
            <DataHealthChecks />

            {/* Audit Log with Rollback */}
            <AuditLog
              auditLog={auditLog}
              integrations={integrations as any}
              onRollback={handleRefresh}
            />
          </TabsContent>

          {/* Tab 2: System Setup */}
          <TabsContent value="setup" className="space-y-6">
            <SystemArchitectureDiagram
              integrations={integrations as any}
              metrics={integrationMetrics}
              budgets={integrationBudgets}
              syncRuns={syncRuns}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <LiveCronStatus integrations={integrations as any} />
              <WebhookActivity />
            </div>
          </TabsContent>

          {/* Tab 3: System Map */}
          <TabsContent value="map" className="space-y-6">
            <SystemStatusMap
              integrations={integrations as any}
              metrics={integrationMetrics}
              budgets={integrationBudgets}
              syncRuns={syncRuns}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
