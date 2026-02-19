import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Cloud, Server, Database, BarChart3, Monitor,
  Phone, Webhook, Zap, Activity, AlertTriangle,
  CheckCircle2, XCircle, Clock
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

const statusColors = {
  ok: { border: "border-emerald-500/40", glow: "shadow-[0_0_24px_rgba(16,185,129,0.18)]", dot: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10", badgeText: "OK" },
  warning: { border: "border-amber-500/50", glow: "shadow-[0_0_28px_rgba(245,158,11,0.22)]", dot: "bg-amber-500", text: "text-amber-400", bg: "bg-amber-500/10", badgeText: "ADVARSEL" },
  error: { border: "border-red-500/60", glow: "shadow-[0_0_32px_rgba(239,68,68,0.28)]", dot: "bg-red-500", text: "text-red-400", bg: "bg-red-500/10", badgeText: "OVERLOAD" },
} as const;

/* ─────── MapNode ─────── */
function MapNode({
  id,
  icon: Icon,
  title,
  subtitle,
  status,
  stats,
  children,
  hoveredNode,
  setHoveredNode,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  status: NodeStatus;
  stats?: { label: string; value: string }[];
  children?: React.ReactNode;
  hoveredNode: string | null;
  setHoveredNode: (id: string | null) => void;
}) {
  const s = statusColors[status];
  const isHovered = hoveredNode === id;

  return (
    <div
      data-node={id}
      className={`relative rounded-2xl border backdrop-blur-xl bg-card/60 p-3.5 transition-all duration-300 cursor-default min-w-0
        ${s.border} ${s.glow}
        ${isHovered ? "scale-[1.04] z-20 ring-1 ring-white/10" : ""}
        ${status === "error" ? "animate-pulse" : ""}
      `}
      onMouseEnter={() => setHoveredNode(id)}
      onMouseLeave={() => setHoveredNode(null)}
    >
      {/* Status dot */}
      <div className={`absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full border-2 border-background ${s.dot} ${status === "error" ? "animate-ping" : ""}`} />

      <div className="flex items-start gap-2.5">
        <div className={`rounded-xl p-2 shrink-0 ${s.bg}`}>
          <Icon className={`h-4 w-4 ${s.text}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-xs font-semibold text-foreground truncate leading-tight">{title}</h3>
            {status !== "ok" && (
              <Badge variant="outline" className={`text-[9px] px-1 py-0 leading-tight ${s.bg} ${s.text} border-current/30`}>
                {status === "error" ? <XCircle className="h-2 w-2 mr-0.5" /> : <AlertTriangle className="h-2 w-2 mr-0.5" />}
                {s.badgeText}
              </Badge>
            )}
          </div>
          {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{subtitle}</p>}
        </div>
      </div>

      {/* Hover stats */}
      {stats && stats.length > 0 && (
        <div className={`mt-2 space-y-0.5 transition-all duration-200 ${isHovered ? "opacity-100 max-h-32" : "opacity-0 max-h-0 overflow-hidden"}`}>
          {stats.map((st) => (
            <div key={st.label} className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">{st.label}</span>
              <span className="text-foreground font-medium font-mono">{st.value}</span>
            </div>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

/* ─────── SVG Connections ─────── */
interface Connection {
  from: string;
  to: string;
  status: NodeStatus;
}

function SvgConnections({ connections, containerRef }: { connections: Connection[]; containerRef: React.RefObject<HTMLDivElement> }) {
  const [paths, setPaths] = useState<{ d: string; status: NodeStatus; key: string }[]>([]);

  const calcPaths = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const newPaths: { d: string; status: NodeStatus; key: string }[] = [];

    for (const conn of connections) {
      const fromEl = container.querySelector(`[data-node="${conn.from}"]`);
      const toEl = container.querySelector(`[data-node="${conn.to}"]`);
      if (!fromEl || !toEl) continue;

      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const x1 = fromRect.right - rect.left;
      const y1 = fromRect.top + fromRect.height / 2 - rect.top;
      const x2 = toRect.left - rect.left;
      const y2 = toRect.top + toRect.height / 2 - rect.top;

      const cpx = (x2 - x1) * 0.45;
      const d = `M ${x1} ${y1} C ${x1 + cpx} ${y1}, ${x2 - cpx} ${y2}, ${x2} ${y2}`;
      newPaths.push({ d, status: conn.status, key: `${conn.from}-${conn.to}` });
    }
    setPaths(newPaths);
  }, [connections, containerRef]);

  useEffect(() => {
    calcPaths();
    const timer = setTimeout(calcPaths, 100);
    window.addEventListener("resize", calcPaths);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", calcPaths);
    };
  }, [calcPaths]);

  const strokeColor = (s: NodeStatus) =>
    s === "ok" ? "rgba(16,185,129,0.35)" : s === "warning" ? "rgba(245,158,11,0.45)" : "rgba(239,68,68,0.55)";

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: "visible" }}>
      <defs>
        <filter id="glow-green"><feGaussianBlur stdDeviation="3" /><feColorMatrix values="0 0 0 0 0.06 0 0 0 0 0.72 0 0 0 0 0.50 0 0 0 0.6 0" /></filter>
        <filter id="glow-amber"><feGaussianBlur stdDeviation="3" /><feColorMatrix values="0 0 0 0 0.96 0 0 0 0 0.62 0 0 0 0 0.04 0 0 0 0.6 0" /></filter>
        <filter id="glow-red"><feGaussianBlur stdDeviation="3" /><feColorMatrix values="0 0 0 0 0.94 0 0 0 0 0.27 0 0 0 0 0.27 0 0 0 0.6 0" /></filter>
      </defs>
      {paths.map((p) => (
        <g key={p.key}>
          <path d={p.d} fill="none" stroke={strokeColor(p.status)} strokeWidth="3" filter={`url(#glow-${p.status === "ok" ? "green" : p.status === "warning" ? "amber" : "red"})`} />
          <path d={p.d} fill="none" stroke={strokeColor(p.status)} strokeWidth="1.5" strokeDasharray="6 4">
            <animate attributeName="stroke-dashoffset" from="20" to="0" dur={p.status === "error" ? "0.6s" : "1.5s"} repeatCount="indefinite" />
          </path>
        </g>
      ))}
    </svg>
  );
}

/* ─────── Main Component ─────── */
export function SystemStatusMap({ integrations, metrics, budgets, syncRuns }: Props) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const computed = useMemo(() => {
    const adversusMetrics = metrics.filter(m => m.provider?.toLowerCase() === "adversus");
    const enreachMetrics = metrics.filter(m => m.provider?.toLowerCase() === "enreach");
    const adversusBudgets = budgets.filter(b => b.providerType === "adversus");
    const enreachBudgets = budgets.filter(b => b.providerType === "enreach");

    const avgSuccess = (arr: Metric[]) => arr.length > 0 ? arr.reduce((s, m) => s + m.successRate1h, 0) / arr.length : 100;
    const maxUsed = (arr: Budget[], key: "used1m" | "used60m") => arr.length > 0 ? Math.max(...arr.map(b => b[key])) : 0;

    const adversusStatus = getNodeStatus(avgSuccess(adversusMetrics), maxUsed(adversusBudgets, "used1m"), maxUsed(adversusBudgets, "used60m"));
    const enreachStatus = getNodeStatus(avgSuccess(enreachMetrics), maxUsed(enreachBudgets, "used1m"), maxUsed(enreachBudgets, "used60m"));

    const allSuccess = metrics.length > 0 ? metrics.reduce((s, m) => s + m.successRate1h, 0) / metrics.length : 100;
    const allUsed1m = budgets.length > 0 ? Math.max(...budgets.map(b => b.used1m)) : 0;
    const allUsed60m = budgets.length > 0 ? Math.max(...budgets.map(b => b.used60m)) : 0;
    const engineStatus = getNodeStatus(allSuccess, allUsed1m, allUsed60m);

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentRuns = syncRuns.filter(r => new Date(r.started_at).getTime() > oneHourAgo);
    const recordsLastHour = recentRuns.reduce((sum, r) => sum + (r.records_processed || 0), 0);
    const apiCallsLastHour = recentRuns.reduce((sum, r) => sum + (r.api_calls_made || 0), 0);

    const totalLimit1m = budgets.reduce((s, b) => s + b.limit1m, 0) || 1;
    const totalCalls1m = budgets.reduce((s, b) => s + b.calls1m, 0);
    const systemUsage = Math.min((totalCalls1m / totalLimit1m) * 100, 100);

    return { adversusStatus, enreachStatus, engineStatus, recordsLastHour, apiCallsLastHour, systemUsage, adversusMetrics, enreachMetrics, adversusBudgets, enreachBudgets, avgSuccess, maxUsed };
  }, [metrics, budgets, syncRuns]);

  const systemStatus: NodeStatus = computed.systemUsage > 80 ? "error" : computed.systemUsage > 50 ? "warning" : "ok";
  const worstSourceStatus: NodeStatus = [computed.adversusStatus, computed.enreachStatus].includes("error") ? "error" : [computed.adversusStatus, computed.enreachStatus].includes("warning") ? "warning" : "ok";

  const connections: Connection[] = [
    // Sources → Processing
    { from: "adversus", to: "engine", status: computed.adversusStatus },
    { from: "enreach", to: "engine", status: computed.enreachStatus },
    { from: "webhooks", to: "webhook-proc", status: "ok" },
    { from: "twilio", to: "webhook-proc", status: "ok" },
    // Processing → Database
    { from: "engine", to: "db", status: computed.engineStatus },
    { from: "webhook-proc", to: "db", status: "ok" },
    // Database → KPI
    { from: "db", to: "cron", status: "ok" },
    { from: "cron", to: "kpi", status: "ok" },
    // KPI → Output
    { from: "kpi", to: "cache", status: "ok" },
    { from: "cache", to: "dashboards", status: "ok" },
  ];

  return (
    <div className="space-y-5">
      {/* Throughput Gauge */}
      <div className="rounded-2xl border backdrop-blur-xl bg-card/60 border-border/50 p-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold text-foreground">System Throughput</h2>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">{computed.recordsLastHour.toLocaleString()} records/t</span>
            <span className="text-muted-foreground">{computed.apiCallsLastHour.toLocaleString()} API-kald/t</span>
            {systemStatus !== "ok" && (
              <Badge variant="outline" className={`${statusColors[systemStatus].bg} ${statusColors[systemStatus].text}`}>
                {systemStatus === "error" ? "Kapacitetsgrænse" : "Forhøjet belastning"}
              </Badge>
            )}
          </div>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${systemStatus === "ok" ? "bg-emerald-500" : systemStatus === "warning" ? "bg-amber-500" : "bg-red-500 animate-pulse"}`}
            style={{ width: `${computed.systemUsage}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">{computed.systemUsage.toFixed(0)}% af samlet kapacitet</p>
      </div>

      {/* ─── THE MAP ─── */}
      <div ref={containerRef} className="relative rounded-2xl border border-border/30 bg-card/30 backdrop-blur-sm p-6 overflow-x-auto">
        {/* SVG connection lines */}
        <SvgConnections connections={connections} containerRef={containerRef as React.RefObject<HTMLDivElement>} />

        {/* 5-column grid */}
        <div className="relative z-10 grid grid-cols-[1fr_1fr_0.9fr_1fr_1fr] gap-x-12 gap-y-3 min-w-[1100px]">
          {/* Headers */}
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] pb-2 text-center border-b border-border/20">Kilder</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] pb-2 text-center border-b border-border/20">Processing</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] pb-2 text-center border-b border-border/20">Database</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] pb-2 text-center border-b border-border/20">KPI Engine</div>
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em] pb-2 text-center border-b border-border/20">Output</div>

          {/* Row 1 */}
          <MapNode id="adversus" icon={Cloud} title="Adversus API" subtitle={`${computed.adversusMetrics.length} integrationer`} status={computed.adversusStatus}
            stats={[{ label: "Succes", value: `${computed.avgSuccess(computed.adversusMetrics).toFixed(0)}%` }, { label: "Burst", value: `${computed.maxUsed(computed.adversusBudgets, "used1m").toFixed(0)}%` }]}
            hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} />
          <MapNode id="engine" icon={Server} title="Integration Engine" subtitle="Adversus · Enreach Adapter" status={computed.engineStatus}
            stats={[{ label: "Rate Limiter", value: computed.engineStatus === "ok" ? "Idle" : "Aktiv" }, { label: "Smart Backfill", value: "Klar" }]}
            hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} />
          <MapNode id="db" icon={Database} title="Primær Database" subtitle="sales · logs · sync_runs" status="ok"
            stats={[{ label: "Records/t", value: computed.recordsLastHour.toLocaleString() }, { label: "API-kald/t", value: computed.apiCallsLastHour.toLocaleString() }]}
            hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} />
          <MapNode id="cron" icon={Clock} title="pg_cron Scheduler" subtitle="Periodisk triggering" status="ok"
            hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} />
          <MapNode id="cache" icon={Database} title="Cache Tabeller" subtitle="kpi_cached_values · leaderboard" status="ok"
            hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} />

          {/* Row 2 */}
          <MapNode id="enreach" icon={Cloud} title="Enreach API" subtitle={`${computed.enreachMetrics.length} integrationer`} status={computed.enreachStatus}
            stats={[{ label: "Succes", value: `${computed.avgSuccess(computed.enreachMetrics).toFixed(0)}%` }, { label: "Burst", value: `${computed.maxUsed(computed.enreachBudgets, "used1m").toFixed(0)}%` }]}
            hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} />
          <MapNode id="webhook-proc" icon={Zap} title="Webhook Processors" subtitle="5 aktive processorer" status="ok"
            hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} />
          <div /> {/* empty cell */}
          <MapNode id="kpi" icon={BarChart3} title="KPI Functions" subtitle="Incremental · Values · Leaderboard" status="ok"
            hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} />
          <MapNode id="dashboards" icon={Monitor} title="Klient Dashboards" subtitle="6 aktive dashboards" status="ok" hoveredNode={hoveredNode} setHoveredNode={setHoveredNode}>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {["Eesy TM", "Eesy FM", "TDC", "Relatel", "Tryg", "TV"].map(d => (
                <span key={d} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{d}</span>
              ))}
            </div>
          </MapNode>

          {/* Row 3 */}
          <MapNode id="webhooks" icon={Webhook} title="Webhooks" subtitle="Adversus · Dialer · e-conomic · Zapier" status="ok"
            hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} />
          <div /> {/* empty */}
          <div /> {/* empty */}
          <div /> {/* empty */}
          <div /> {/* empty */}

          {/* Row 4 */}
          <MapNode id="twilio" icon={Phone} title="Twilio" subtitle="Opkald & SMS" status="ok"
            hoveredNode={hoveredNode} setHoveredNode={setHoveredNode} />
          <div /> {/* empty */}
          <div /> {/* empty */}
          <div /> {/* empty */}
          <div /> {/* empty */}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> OK</div>
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Advarsel</div>
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" /> Overload / Fejl</div>
        <div className="flex items-center gap-1.5 ml-4"><svg width="24" height="8"><path d="M 0 4 C 8 4, 16 4, 24 4" fill="none" stroke="rgba(16,185,129,0.5)" strokeWidth="1.5" strokeDasharray="4 3" /></svg> Dataflow</div>
      </div>
    </div>
  );
}
