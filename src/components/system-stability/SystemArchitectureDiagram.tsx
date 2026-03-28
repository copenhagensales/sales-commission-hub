import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Server, Database, Clock, BarChart3, Monitor, Webhook,
  ArrowRight, AlertTriangle, Zap, Phone, Receipt, Users, Radio
} from "lucide-react";

interface IntegrationData {
  id: string;
  name: string;
  provider: string;
  last_sync_at: string | null;
  last_status: string | null;
  is_active: boolean;
}

interface MetricData {
  id?: string;
  name?: string;
  successRate1h: number;
  rateLimitRate15m: number;
  avgDurationMs: number;
  totalApiCalls15m: number;
}

interface BudgetData {
  provider: string;
  providerType: string;
  used1m: number;
  used60m: number;
  calls1m: number;
  calls60m: number;
  limit1m: number;
  limit60m: number;
}

interface SyncRunData {
  records_processed: number;
  api_calls_made: number;
  rate_limit_hits: number;
  started_at: string;
}

interface Props {
  integrations: IntegrationData[];
  metrics: MetricData[];
  budgets: BudgetData[];
  syncRuns: SyncRunData[];
}

function statusColor(ok: boolean, warn?: boolean): string {
  if (!ok) return "border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.15)]";
  if (warn) return "border-amber-500/60 shadow-[0_0_15px_rgba(245,158,11,0.15)]";
  return "border-emerald-500/60 shadow-[0_0_15px_rgba(16,185,129,0.15)]";
}

function statusDot(ok: boolean, warn?: boolean): string {
  if (!ok) return "bg-red-500";
  if (warn) return "bg-amber-500";
  return "bg-emerald-500";
}

function DiagramCard({
  icon: Icon,
  title,
  items,
  ok = true,
  warn = false,
  badge,
  className = "",
}: {
  icon: React.ElementType;
  title: string;
  items: { label: string; detail?: string; ok?: boolean; warn?: boolean; pulse?: boolean }[];
  ok?: boolean;
  warn?: boolean;
  badge?: string;
  className?: string;
}) {
  return (
    <div
      className={`relative backdrop-blur-xl bg-card/60 border rounded-xl p-4 transition-all hover:scale-[1.02] hover:bg-card/80 ${statusColor(ok, warn)} ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg ${ok ? (warn ? "bg-amber-500/10" : "bg-emerald-500/10") : "bg-red-500/10"}`}>
          <Icon className={`h-4 w-4 ${ok ? (warn ? "text-amber-500" : "text-emerald-500") : "text-red-500"}`} />
        </div>
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {badge && (
          <Badge variant="secondary" className="text-[10px] ml-auto">
            {badge}
          </Badge>
        )}
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="relative">
              <div className={`h-1.5 w-1.5 rounded-full ${statusDot(item.ok !== false, item.warn)}`} />
              {item.pulse && (
                <div className={`absolute inset-0 h-1.5 w-1.5 rounded-full animate-ping ${statusDot(item.ok !== false, item.warn)}`} />
              )}
            </div>
            <span className="text-muted-foreground">{item.label}</span>
            {item.detail && (
              <span className="ml-auto font-mono text-foreground">{item.detail}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowArrow({ overloaded = false }: { overloaded?: boolean }) {
  return (
    <div className="flex items-center justify-center py-1 lg:py-0 lg:px-1">
      <div className="relative">
        <ArrowRight className={`h-5 w-5 ${overloaded ? "text-red-500 animate-pulse" : "text-muted-foreground/40"}`} />
        {overloaded && (
          <div className="absolute -top-1 -right-1">
            <AlertTriangle className="h-3 w-3 text-red-500" />
          </div>
        )}
      </div>
    </div>
  );
}

function ThroughputGauge({ usage, label }: { usage: number; label: string }) {
  const color = usage > 80 ? "bg-red-500" : usage > 50 ? "bg-amber-500" : "bg-emerald-500";
  const textColor = usage > 80 ? "text-red-500" : usage > 50 ? "text-amber-500" : "text-emerald-500";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <div className="flex-1 bg-muted rounded-full h-2 min-w-[80px]">
        <div
          className={`h-2 rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${Math.min(usage, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-semibold ${textColor}`}>
        {usage.toFixed(0)}%
      </span>
    </div>
  );
}

export function SystemArchitectureDiagram({ integrations, metrics, budgets, syncRuns }: Props) {
  const computed = useMemo(() => {
    // System-wide throughput
    const totalCalls1m = budgets.reduce((s, b) => s + b.calls1m, 0);
    const totalLimit1m = budgets.reduce((s, b) => s + b.limit1m, 0);
    const systemUsage1m = totalLimit1m > 0 ? (totalCalls1m / totalLimit1m) * 100 : 0;

    const totalCalls60m = budgets.reduce((s, b) => s + b.calls60m, 0);
    const totalLimit60m = budgets.reduce((s, b) => s + b.limit60m, 0);
    const systemUsage60m = totalLimit60m > 0 ? (totalCalls60m / totalLimit60m) * 100 : 0;

    // Records last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recordsLastHour = syncRuns
      .filter((r) => new Date(r.started_at).getTime() > oneHourAgo)
      .reduce((s, r) => s + (r.records_processed || 0), 0);

    const apiCallsLastHour = syncRuns
      .filter((r) => new Date(r.started_at).getTime() > oneHourAgo)
      .reduce((s, r) => s + (r.api_calls_made || 0), 0);

    // Per-provider aggregation
    const adversusInts = integrations.filter((i) => i.provider?.toLowerCase() === "adversus");
    const enreachInts = integrations.filter((i) => i.provider?.toLowerCase() === "enreach");

    const adversusBudgets = budgets.filter((b) => b.providerType === "adversus");
    const enreachBudgets = budgets.filter((b) => b.providerType === "enreach");

    const adversusOverloaded = adversusBudgets.some((b) => b.used1m > 80 || b.used60m > 80);
    const enreachOverloaded = enreachBudgets.some((b) => b.used1m > 80 || b.used60m > 80);

    const adversusMetrics = metrics.filter((m) => adversusInts.some((i) => i.id === (m as any).id));
    const enreachMetrics = metrics.filter((m) => enreachInts.some((i) => i.id === (m as any).id));

    const adversusOk = adversusMetrics.every((m) => m.successRate1h >= 80);
    const adversusWarn = adversusMetrics.some((m) => m.successRate1h < 95 || m.rateLimitRate15m > 5);
    const enreachOk = enreachMetrics.every((m) => m.successRate1h >= 80);
    const enreachWarn = enreachMetrics.some((m) => m.successRate1h < 95 || m.rateLimitRate15m > 5);

    const anyOverloaded = adversusOverloaded || enreachOverloaded;

    return {
      systemUsage1m,
      systemUsage60m,
      recordsLastHour,
      apiCallsLastHour,
      adversusInts,
      enreachInts,
      adversusOverloaded,
      enreachOverloaded,
      adversusOk,
      adversusWarn,
      enreachOk,
      enreachWarn,
      anyOverloaded,
      totalCalls1m,
      totalLimit1m,
      totalCalls60m,
      totalLimit60m,
    };
  }, [integrations, metrics, budgets, syncRuns]);

  return (
    <div className="space-y-6">
      {/* System Throughput Header */}
      <Card className="backdrop-blur-xl bg-card/60 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            System Throughput
            {computed.systemUsage1m > 80 && (
              <Badge variant="destructive" className="text-[10px] animate-pulse">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Nærmer sig kapacitetsgrænse
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ThroughputGauge usage={computed.systemUsage1m} label="Burst (1 min)" />
          <ThroughputGauge usage={computed.systemUsage60m} label="Time (60 min)" />
          <div className="flex gap-6 pt-2 text-xs text-muted-foreground">
            <span>API-kald/time: <span className="font-mono text-foreground">{computed.apiCallsLastHour}</span></span>
            <span>Records/time: <span className="font-mono text-foreground">{computed.recordsLastHour}</span></span>
            <span>Kapacitet: <span className="font-mono text-foreground">{computed.totalCalls1m}/{computed.totalLimit1m} pr. min</span></span>
          </div>
        </CardContent>
      </Card>

      {/* Architecture Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_1fr] gap-3 items-start">
        {/* Layer 1: External Sources */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
            <div className="h-px flex-1 bg-gradient-to-r from-blue-500/40 to-transparent" />
            Eksterne Kilder
            <div className="h-px flex-1 bg-gradient-to-l from-blue-500/40 to-transparent" />
          </div>

          {/* APIs */}
          <DiagramCard
            icon={Server}
            title="Adversus API"
            ok={computed.adversusOk}
            warn={computed.adversusWarn}
            badge={computed.adversusOverloaded ? "⚠ Overbelastet" : undefined}
            items={computed.adversusInts.map((i) => {
              const m = metrics.find((mm) => (mm as any).id === i.id);
              return {
                label: i.name,
                detail: m ? `${m.successRate1h.toFixed(0)}%` : "–",
                ok: m ? m.successRate1h >= 80 : true,
                warn: m ? m.successRate1h < 95 : false,
                pulse: i.last_status === "running",
              };
            })}
          />

          <DiagramCard
            icon={Server}
            title="Enreach API"
            ok={computed.enreachOk}
            warn={computed.enreachWarn}
            badge={computed.enreachOverloaded ? "⚠ Overbelastet" : undefined}
            items={computed.enreachInts.map((i) => {
              const m = metrics.find((mm) => (mm as any).id === i.id);
              return {
                label: i.name,
                detail: m ? `${m.successRate1h.toFixed(0)}%` : "–",
                ok: m ? m.successRate1h >= 80 : true,
                warn: m ? m.successRate1h < 95 : false,
                pulse: i.last_status === "running",
              };
            })}
          />

          {/* Webhooks */}
          <DiagramCard
            icon={Webhook}
            title="Webhooks (passiv)"
            ok={true}
            items={[
              { label: "Adversus Webhook", ok: true },
              { label: "Dialer Webhook", ok: true },
              { label: "e-conomic Webhook", ok: true },
              { label: "Zapier Webhook", ok: true },
            ]}
            badge="Indgående"
          />

          <DiagramCard
            icon={Phone}
            title="Twilio"
            ok={true}
            items={[
              { label: "Opkald / SMS", ok: true },
            ]}
            badge="Passiv"
          />
        </div>

        {/* Arrow 1 */}
        <div className="hidden lg:flex flex-col items-center justify-center gap-4 pt-20">
          <FlowArrow overloaded={computed.adversusOverloaded} />
          <FlowArrow overloaded={computed.enreachOverloaded} />
          <FlowArrow />
          <FlowArrow />
        </div>

        {/* Layer 2: Processing + Database */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
            <div className="h-px flex-1 bg-gradient-to-r from-purple-500/40 to-transparent" />
            Processing & Data
            <div className="h-px flex-1 bg-gradient-to-l from-purple-500/40 to-transparent" />
          </div>

          <DiagramCard
            icon={Zap}
            title="Integration Engine"
            ok={!computed.anyOverloaded}
            warn={computed.anyOverloaded}
            items={[
              { label: "Adversus Adapter", ok: computed.adversusOk, warn: computed.adversusWarn },
              { label: "Enreach Adapter", ok: computed.enreachOk, warn: computed.enreachWarn },
              { label: "Rate Limiter", ok: !computed.anyOverloaded, warn: computed.anyOverloaded },
              { label: "Smart Backfill", ok: true },
            ]}
            badge="Edge Function"
          />

          <DiagramCard
            icon={Radio}
            title="Webhook Processors"
            ok={true}
            items={[
              { label: "adversus-webhook", ok: true },
              { label: "dialer-webhook", ok: true },
              { label: "economic-webhook", ok: true },
              { label: "zapier-webhook", ok: true },
              { label: "twilio-voice-token", ok: true },
            ]}
            badge="Edge Functions"
          />

          <DiagramCard
            icon={Database}
            title="Database"
            ok={true}
            items={[
              { label: "sales + sale_items", ok: true },
              { label: "integration_logs", ok: true },
              { label: "integration_sync_runs", ok: true },
              { label: "adversus_events", ok: true },
            ]}
            badge={`${computed.recordsLastHour} rec/time`}
          />
        </div>

        {/* Arrow 2 */}
        <div className="hidden lg:flex flex-col items-center justify-center gap-4 pt-20">
          <FlowArrow />
          <FlowArrow />
        </div>

        {/* Layer 3: KPI Engine + Output */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-1.5">
            <div className="h-px flex-1 bg-gradient-to-r from-emerald-500/40 to-transparent" />
            KPI & Output
            <div className="h-px flex-1 bg-gradient-to-l from-emerald-500/40 to-transparent" />
          </div>

          <DiagramCard
            icon={Clock}
            title="pg_cron Scheduler"
            ok={true}
            items={[
              { label: "Integration triggers", ok: true, pulse: true },
              { label: "KPI-beregning triggers", ok: true, pulse: true },
            ]}
            badge="Scheduler"
          />

          <DiagramCard
            icon={BarChart3}
            title="KPI Engine"
            ok={true}
            items={[
              { label: "calculate-kpi-incremental", ok: true },
              { label: "calculate-kpi-values", ok: true },
              { label: "calculate-leaderboard-incremental", ok: true },
            ]}
            badge="Edge Functions"
          />

          <DiagramCard
            icon={Database}
            title="Cache Tabeller"
            ok={true}
            items={[
              { label: "kpi_cached_values", ok: true },
              { label: "kpi_leaderboard_cache", ok: true },
            ]}
            badge="Cache"
          />

          <DiagramCard
            icon={Monitor}
            title="Klient Dashboards"
            ok={true}
            items={[
              { label: "Eesy TM / FM", ok: true },
              { label: "TDC Erhverv", ok: true },
              { label: "Relatel / Tryg", ok: true },
              { label: "TV Boards", ok: true },
            ]}
            badge="Frontend"
          />
        </div>
      </div>

      {/* Mobile flow arrows */}
      <div className="lg:hidden flex justify-center">
        <p className="text-xs text-muted-foreground">↑ Dataflow: Kilder → Processing → KPI → Dashboards ↓</p>
      </div>
    </div>
  );
}
