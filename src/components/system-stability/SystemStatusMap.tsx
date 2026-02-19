import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Cloud, Server, Database, BarChart3, Monitor,
  Phone, Webhook, Zap, Activity, AlertTriangle,
  CheckCircle2, XCircle, ArrowRight
} from "lucide-react";

interface Integration {
  id: string;
  name: string;
  provider: string;
  last_sync_at: string | null;
  last_status: string | null;
  is_active: boolean;
}

interface Metric {
  id: string;
  name: string;
  provider: string;
  successRate1h: number;
  rateLimitRate15m: number;
  avgDurationMs: number;
  totalApiCalls15m: number;
}

interface Budget {
  provider: string;
  providerType: string;
  calls1m: number;
  limit1m: number;
  used1m: number;
  calls60m: number;
  limit60m: number;
  used60m: number;
}

interface SyncRun {
  records_processed: number;
  api_calls_made: number;
  rate_limit_hits: number;
  started_at: string;
}

interface Props {
  integrations: Integration[];
  metrics: Metric[];
  budgets: Budget[];
  syncRuns: SyncRun[];
}

type NodeStatus = "ok" | "warning" | "error";

function getNodeStatus(successRate?: number, used1m?: number, used60m?: number): NodeStatus {
  if (used1m !== undefined && used1m > 80) return "error";
  if (used60m !== undefined && used60m > 80) return "error";
  if (successRate !== undefined && successRate < 80) return "error";
  if (used1m !== undefined && used1m > 50) return "warning";
  if (used60m !== undefined && used60m > 50) return "warning";
  if (successRate !== undefined && successRate < 95) return "warning";
  return "ok";
}

const statusStyles: Record<NodeStatus, { border: string; glow: string; badge: string; text: string }> = {
  ok: {
    border: "border-emerald-500/40",
    glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    text: "OK",
  },
  warning: {
    border: "border-amber-500/50",
    glow: "shadow-[0_0_25px_rgba(245,158,11,0.2)]",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    text: "ADVARSEL",
  },
  error: {
    border: "border-red-500/60 animate-pulse",
    glow: "shadow-[0_0_30px_rgba(239,68,68,0.25)]",
    badge: "bg-red-500/10 text-red-400 border-red-500/30",
    text: "OVERLOAD",
  },
};

function StatusNode({
  icon: Icon,
  title,
  subtitle,
  status,
  stats,
  children,
  isHovered,
  onHover,
  onLeave,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  status: NodeStatus;
  stats?: { label: string; value: string }[];
  children?: React.ReactNode;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const s = statusStyles[status];
  return (
    <div
      className={`relative rounded-2xl border backdrop-blur-xl bg-card/60 p-4 transition-all duration-300 cursor-default
        ${s.border} ${s.glow}
        ${isHovered ? "scale-[1.03] z-10" : ""}
      `}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
    >
      {/* Status indicator dot */}
      <div className={`absolute -top-1.5 -right-1.5 h-3.5 w-3.5 rounded-full border-2 border-background
        ${status === "ok" ? "bg-emerald-500" : status === "warning" ? "bg-amber-500" : "bg-red-500"}
        ${status === "error" ? "animate-pulse" : ""}
      `} />

      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2.5 shrink-0
          ${status === "ok" ? "bg-emerald-500/10 text-emerald-400" : status === "warning" ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}
        `}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
            {status !== "ok" && (
              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${s.badge}`}>
                {status === "error" ? <XCircle className="h-2.5 w-2.5 mr-0.5" /> : <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />}
                {s.text}
              </Badge>
            )}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {/* Stats on hover */}
      {stats && stats.length > 0 && (
        <div className={`mt-3 space-y-1 transition-all duration-200 ${isHovered ? "opacity-100 max-h-40" : "opacity-0 max-h-0 overflow-hidden"}`}>
          {stats.map((st) => (
            <div key={st.label} className="flex justify-between text-[11px]">
              <span className="text-muted-foreground">{st.label}</span>
              <span className="text-foreground font-medium">{st.value}</span>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}

function ConnectionArrow({ status }: { status: NodeStatus }) {
  const color = status === "ok" ? "text-emerald-500/40" : status === "warning" ? "text-amber-500/50" : "text-red-500/60";
  return (
    <div className={`hidden lg:flex items-center justify-center ${color}`}>
      <ArrowRight className="h-6 w-6" />
    </div>
  );
}

export function SystemStatusMap({ integrations, metrics, budgets, syncRuns }: Props) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const computed = useMemo(() => {
    // Per-provider aggregation
    const adversusMetrics = metrics.filter(m => m.provider?.toLowerCase() === "adversus");
    const enreachMetrics = metrics.filter(m => m.provider?.toLowerCase() === "enreach");
    const adversusBudgets = budgets.filter(b => b.providerType === "adversus");
    const enreachBudgets = budgets.filter(b => b.providerType === "enreach");

    const avgSuccess = (arr: Metric[]) => arr.length > 0 ? arr.reduce((s, m) => s + m.successRate1h, 0) / arr.length : 100;
    const maxUsed = (arr: Budget[], key: "used1m" | "used60m") => arr.length > 0 ? Math.max(...arr.map(b => b[key])) : 0;
    const totalCalls = (arr: Budget[], key: "calls1m" | "calls60m") => arr.reduce((s, b) => s + b[key], 0);

    const adversusStatus = getNodeStatus(avgSuccess(adversusMetrics), maxUsed(adversusBudgets, "used1m"), maxUsed(adversusBudgets, "used60m"));
    const enreachStatus = getNodeStatus(avgSuccess(enreachMetrics), maxUsed(enreachBudgets, "used1m"), maxUsed(enreachBudgets, "used60m"));

    // Engine status = worst of all integrations
    const allSuccess = metrics.length > 0 ? metrics.reduce((s, m) => s + m.successRate1h, 0) / metrics.length : 100;
    const allUsed1m = budgets.length > 0 ? Math.max(...budgets.map(b => b.used1m)) : 0;
    const allUsed60m = budgets.length > 0 ? Math.max(...budgets.map(b => b.used60m)) : 0;
    const engineStatus = getNodeStatus(allSuccess, allUsed1m, allUsed60m);

    // Records last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recordsLastHour = syncRuns
      .filter(r => new Date(r.started_at).getTime() > oneHourAgo)
      .reduce((sum, r) => sum + (r.records_processed || 0), 0);
    const apiCallsLastHour = syncRuns
      .filter(r => new Date(r.started_at).getTime() > oneHourAgo)
      .reduce((sum, r) => sum + (r.api_calls_made || 0), 0);

    // System throughput
    const totalLimit1m = budgets.reduce((s, b) => s + b.limit1m, 0) || 1;
    const totalCalls1m = budgets.reduce((s, b) => s + b.calls1m, 0);
    const systemUsage = Math.min((totalCalls1m / totalLimit1m) * 100, 100);

    return {
      adversusStatus,
      enreachStatus,
      engineStatus,
      recordsLastHour,
      apiCallsLastHour,
      systemUsage,
      adversusMetrics,
      enreachMetrics,
      adversusBudgets,
      enreachBudgets,
      totalCalls,
      avgSuccess,
      maxUsed,
    };
  }, [metrics, budgets, syncRuns]);

  const systemStatus: NodeStatus = computed.systemUsage > 80 ? "error" : computed.systemUsage > 50 ? "warning" : "ok";

  return (
    <div className="space-y-6">
      {/* System Throughput Gauge */}
      <div className="rounded-2xl border backdrop-blur-xl bg-card/60 border-border/50 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">System Throughput</h2>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{computed.recordsLastHour.toLocaleString()} records/t</span>
            <span className="text-muted-foreground">{computed.apiCallsLastHour.toLocaleString()} API-kald/t</span>
            {systemStatus !== "ok" && (
              <Badge variant="outline" className={statusStyles[systemStatus].badge}>
                {systemStatus === "error" ? "Kapacitetsgrænse" : "Forhøjet belastning"}
              </Badge>
            )}
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-3">
          <div
            className={`h-3 rounded-full transition-all duration-500 ${
              systemStatus === "ok" ? "bg-emerald-500" : systemStatus === "warning" ? "bg-amber-500" : "bg-red-500 animate-pulse"
            }`}
            style={{ width: `${computed.systemUsage}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{computed.systemUsage.toFixed(0)}% af samlet kapacitet</p>
      </div>

      {/* Flow Map */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr_auto_0.8fr_auto_1fr_auto_1fr] gap-3 lg:gap-2 items-start">

        {/* Column 1: Sources */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Kilder</div>
          <StatusNode
            icon={Cloud}
            title="Adversus API"
            subtitle={`${computed.adversusMetrics.length} integrationer`}
            status={computed.adversusStatus}
            stats={[
              { label: "Succes", value: `${computed.avgSuccess(computed.adversusMetrics).toFixed(0)}%` },
              { label: "Burst", value: `${computed.maxUsed(computed.adversusBudgets, "used1m").toFixed(0)}%` },
            ]}
            isHovered={hoveredNode === "adversus"}
            onHover={() => setHoveredNode("adversus")}
            onLeave={() => setHoveredNode(null)}
          />
          <StatusNode
            icon={Cloud}
            title="Enreach API"
            subtitle={`${computed.enreachMetrics.length} integrationer`}
            status={computed.enreachStatus}
            stats={[
              { label: "Succes", value: `${computed.avgSuccess(computed.enreachMetrics).toFixed(0)}%` },
              { label: "Burst", value: `${computed.maxUsed(computed.enreachBudgets, "used1m").toFixed(0)}%` },
            ]}
            isHovered={hoveredNode === "enreach"}
            onHover={() => setHoveredNode("enreach")}
            onLeave={() => setHoveredNode(null)}
          />
          <StatusNode
            icon={Webhook}
            title="Webhooks"
            subtitle="Adversus · Dialer · e-conomic · Zapier"
            status="ok"
            isHovered={hoveredNode === "webhooks"}
            onHover={() => setHoveredNode("webhooks")}
            onLeave={() => setHoveredNode(null)}
          />
          <StatusNode
            icon={Phone}
            title="Twilio"
            subtitle="Opkald & SMS"
            status="ok"
            isHovered={hoveredNode === "twilio"}
            onHover={() => setHoveredNode("twilio")}
            onLeave={() => setHoveredNode(null)}
          />
        </div>

        <ConnectionArrow status={computed.engineStatus} />

        {/* Column 2: Processing */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Processing</div>
          <StatusNode
            icon={Server}
            title="Integration Engine"
            subtitle="Adversus · Enreach Adapter"
            status={computed.engineStatus}
            stats={[
              { label: "Rate Limiter", value: computed.engineStatus === "ok" ? "Idle" : "Aktiv" },
              { label: "Smart Backfill", value: "Klar" },
            ]}
            isHovered={hoveredNode === "engine"}
            onHover={() => setHoveredNode("engine")}
            onLeave={() => setHoveredNode(null)}
          />
          <StatusNode
            icon={Zap}
            title="Webhook Processors"
            subtitle="5 aktive processorer"
            status="ok"
            isHovered={hoveredNode === "webhook-proc"}
            onHover={() => setHoveredNode("webhook-proc")}
            onLeave={() => setHoveredNode(null)}
          />
        </div>

        <ConnectionArrow status="ok" />

        {/* Column 3: Database */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Database</div>
          <StatusNode
            icon={Database}
            title="Primær Database"
            subtitle="sales · logs · sync_runs"
            status="ok"
            stats={[
              { label: "Records/t", value: computed.recordsLastHour.toLocaleString() },
              { label: "API-kald/t", value: computed.apiCallsLastHour.toLocaleString() },
            ]}
            isHovered={hoveredNode === "db"}
            onHover={() => setHoveredNode("db")}
            onLeave={() => setHoveredNode(null)}
          />
        </div>

        <ConnectionArrow status="ok" />

        {/* Column 4: KPI Engine */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">KPI Engine</div>
          <StatusNode
            icon={Activity}
            title="pg_cron Scheduler"
            subtitle="Periodisk triggering"
            status="ok"
            isHovered={hoveredNode === "cron"}
            onHover={() => setHoveredNode("cron")}
            onLeave={() => setHoveredNode(null)}
          />
          <StatusNode
            icon={BarChart3}
            title="KPI Functions"
            subtitle="Incremental · Values · Leaderboard"
            status="ok"
            isHovered={hoveredNode === "kpi"}
            onHover={() => setHoveredNode("kpi")}
            onLeave={() => setHoveredNode(null)}
          />
        </div>

        <ConnectionArrow status="ok" />

        {/* Column 5: Output */}
        <div className="space-y-3">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Output</div>
          <StatusNode
            icon={Database}
            title="Cache Tabeller"
            subtitle="kpi_cached_values · leaderboard"
            status="ok"
            isHovered={hoveredNode === "cache"}
            onHover={() => setHoveredNode("cache")}
            onLeave={() => setHoveredNode(null)}
          />
          <StatusNode
            icon={Monitor}
            title="Klient Dashboards"
            subtitle="Eesy · TDC · Relatel · Tryg · TV"
            status="ok"
            isHovered={hoveredNode === "dashboards"}
            onHover={() => setHoveredNode("dashboards")}
            onLeave={() => setHoveredNode(null)}
          >
            <div className="mt-2 flex flex-wrap gap-1">
              {["Eesy TM", "Eesy FM", "TDC Erhverv", "Relatel", "Tryg", "TV Boards"].map(d => (
                <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{d}</span>
              ))}
            </div>
          </StatusNode>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> OK</div>
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Advarsel</div>
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" /> Overload / Fejl</div>
      </div>
    </div>
  );
}
