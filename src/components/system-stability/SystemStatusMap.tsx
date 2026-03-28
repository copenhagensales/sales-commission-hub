import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Cloud, Server, Database, BarChart3, Monitor, Phone, Webhook, Zap,
  Activity, AlertTriangle, CheckCircle2, XCircle, Clock, Shield, Trophy,
  Swords, UserPlus, GraduationCap, Calendar, MapPin, FileBarChart,
  Wallet, DollarSign, Share2, ShoppingCart, Tv, Users, Settings,
  BookOpen, Briefcase, FileText, Building2, Heart, MessageSquare,
  Car, Stamp, TrendingUp, Layers, Lock, LogIn, Target, Gamepad2,
  ClipboardList, Package, Receipt, PiggyBank, Megaphone, LayoutDashboard,
  Headphones
} from "lucide-react";

// ─── Types ───
interface Integration {
  id: string; name: string; provider: string;
  last_sync_at: string | null; last_status: string | null; is_active: boolean;
}
interface Metric {
  id: string; name: string; provider: string;
  successRate1h: number; rateLimitRate15m: number; avgDurationMs: number; totalApiCalls15m: number;
}
interface Budget {
  provider: string; providerType: string;
  calls1m: number; limit1m: number; used1m: number;
  calls60m: number; limit60m: number; used60m: number;
}
interface SyncRun {
  records_processed: number; api_calls_made: number; rate_limit_hits: number; started_at: string;
}
interface Props {
  integrations: Integration[]; metrics: Metric[]; budgets: Budget[]; syncRuns: SyncRun[];
}

type NodeStatus = "ok" | "warning" | "error";
type MapView = "all" | "integrations" | "personnel" | "games" | "recruitment"
  | "onboarding" | "shifts" | "fieldmarketing" | "economy" | "reports" | "dashboards";

const VIEW_LABELS: Record<MapView, string> = {
  all: "Vis hele systemet",
  integrations: "Integrationer & Data",
  personnel: "Personale & Rettigheder",
  games: "Spil & Liga",
  recruitment: "Rekruttering",
  onboarding: "Onboarding & Coaching",
  shifts: "Vagtplan & Tid",
  fieldmarketing: "Fieldmarketing",
  economy: "Økonomi & Løn",
  reports: "Rapporter",
  dashboards: "Dashboards & Output",
};

// Which zones are visible per filter
const VIEW_ZONES: Record<MapView, string[]> = {
  all: ["sources", "processing", "database", "app", "kpi", "output"],
  integrations: ["sources", "processing", "database", "kpi", "output"],
  personnel: ["database", "app-personnel"],
  games: ["database", "app-games"],
  recruitment: ["database", "app-recruitment"],
  onboarding: ["database", "app-onboarding"],
  shifts: ["database", "app-shifts"],
  fieldmarketing: ["database", "app-fieldmarketing"],
  economy: ["database", "app-economy", "sources"],
  reports: ["database", "app-reports"],
  dashboards: ["kpi", "output"],
};

function getNodeStatus(successRate?: number, used1m?: number, used60m?: number): NodeStatus {
  if (used1m !== undefined && used1m > 80) return "error";
  if (used60m !== undefined && used60m > 80) return "error";
  if (successRate !== undefined && successRate < 80) return "error";
  if (used1m !== undefined && used1m > 50) return "warning";
  if (used60m !== undefined && used60m > 50) return "warning";
  if (successRate !== undefined && successRate < 95) return "warning";
  return "ok";
}

const STATUS = {
  ok: { border: "border-emerald-500/40", glow: "shadow-[0_0_20px_rgba(16,185,129,0.15)]", dot: "bg-emerald-500", text: "text-emerald-400", bg: "bg-emerald-500/10", badge: "OK" },
  warning: { border: "border-amber-500/50", glow: "shadow-[0_0_24px_rgba(245,158,11,0.2)]", dot: "bg-amber-500", text: "text-amber-400", bg: "bg-amber-500/10", badge: "ADVARSEL" },
  error: { border: "border-red-500/60", glow: "shadow-[0_0_28px_rgba(239,68,68,0.25)]", dot: "bg-red-500", text: "text-red-400", bg: "bg-red-500/10", badge: "OVERLOAD" },
} as const;

// ─── Zone Card ───
function ZoneCard({ title, icon: Icon, status, items, dimmed }: {
  title: string; icon: React.ElementType; status: NodeStatus;
  items: { icon: React.ElementType; label: string; status?: NodeStatus }[];
  dimmed: boolean;
}) {
  const s = STATUS[status];
  return (
    <div className={`rounded-2xl border backdrop-blur-xl bg-card/60 p-3 transition-all duration-500
      ${s.border} ${s.glow}
      ${dimmed ? "opacity-20 grayscale pointer-events-none" : ""}
      ${status === "error" ? "animate-pulse" : ""}
    `}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`rounded-lg p-1.5 ${s.bg}`}>
          <Icon className={`h-3.5 w-3.5 ${s.text}`} />
        </div>
        <h3 className="text-xs font-semibold text-foreground truncate">{title}</h3>
        {status !== "ok" && (
          <Badge variant="outline" className={`text-[8px] px-1 py-0 ${s.bg} ${s.text} border-current/30 ml-auto`}>
            {status === "error" ? <XCircle className="h-2 w-2 mr-0.5" /> : <AlertTriangle className="h-2 w-2 mr-0.5" />}
            {s.badge}
          </Badge>
        )}
      </div>
      <div className="flex flex-wrap gap-1">
        {items.map((item) => {
          const is = STATUS[item.status || "ok"];
          return (
            <span key={item.label} className={`inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md ${is.bg} text-muted-foreground`}>
              <item.icon className={`h-2.5 w-2.5 ${is.text}`} />
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Flow Arrow ───
function FlowArrow({ dimmed, vertical }: { dimmed?: boolean; vertical?: boolean }) {
  if (vertical) {
    return (
      <div className={`flex justify-center py-1 transition-opacity duration-500 ${dimmed ? "opacity-10" : "opacity-40"}`}>
        <svg width="8" height="24"><path d="M4 0 L4 18 M1 15 L4 20 L7 15" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-muted-foreground" /></svg>
      </div>
    );
  }
  return (
    <div className={`flex items-center px-1 transition-opacity duration-500 ${dimmed ? "opacity-10" : "opacity-40"}`}>
      <svg width="28" height="8"><path d="M0 4 L22 4 M18 1 L24 4 L18 7" stroke="currentColor" strokeWidth="1.5" fill="none" className="text-muted-foreground" /></svg>
    </div>
  );
}

// ─── Main Component ───
export function SystemStatusMap({ integrations, metrics, budgets, syncRuns }: Props) {
  const [filter, setFilter] = useState<MapView>("all");

  const computed = useMemo(() => {
    const byProvider = (p: string) => metrics.filter(m => m.provider?.toLowerCase() === p);
    const byBudget = (p: string) => budgets.filter(b => b.providerType === p);
    const avgSuccess = (arr: Metric[]) => arr.length > 0 ? arr.reduce((s, m) => s + m.successRate1h, 0) / arr.length : 100;
    const maxUsed = (arr: Budget[], k: "used1m" | "used60m") => arr.length > 0 ? Math.max(...arr.map(b => b[k])) : 0;

    const adversusM = byProvider("adversus"), enreachM = byProvider("enreach");
    const adversusB = byBudget("adversus"), enreachB = byBudget("enreach");

    const adversusStatus = getNodeStatus(avgSuccess(adversusM), maxUsed(adversusB, "used1m"), maxUsed(adversusB, "used60m"));
    const enreachStatus = getNodeStatus(avgSuccess(enreachM), maxUsed(enreachB, "used1m"), maxUsed(enreachB, "used60m"));

    const allSuccess = metrics.length > 0 ? metrics.reduce((s, m) => s + m.successRate1h, 0) / metrics.length : 100;
    const allUsed1m = budgets.length > 0 ? Math.max(...budgets.map(b => b.used1m)) : 0;
    const allUsed60m = budgets.length > 0 ? Math.max(...budgets.map(b => b.used60m)) : 0;
    const engineStatus = getNodeStatus(allSuccess, allUsed1m, allUsed60m);

    const oneHourAgo = Date.now() - 3600000;
    const recent = syncRuns.filter(r => new Date(r.started_at).getTime() > oneHourAgo);
    const recordsLastHour = recent.reduce((s, r) => s + (r.records_processed || 0), 0);
    const apiCallsLastHour = recent.reduce((s, r) => s + (r.api_calls_made || 0), 0);

    const totalLimit = budgets.reduce((s, b) => s + b.limit1m, 0) || 1;
    const totalCalls = budgets.reduce((s, b) => s + b.calls1m, 0);
    const systemUsage = Math.min((totalCalls / totalLimit) * 100, 100);

    return { adversusStatus, enreachStatus, engineStatus, recordsLastHour, apiCallsLastHour, systemUsage };
  }, [metrics, budgets, syncRuns]);

  const isVisible = (zone: string) => {
    if (filter === "all") return true;
    const zones = VIEW_ZONES[filter];
    return zones.some(z => zone.startsWith(z));
  };

  const systemStatus: NodeStatus = computed.systemUsage > 80 ? "error" : computed.systemUsage > 50 ? "warning" : "ok";

  return (
    <div className="space-y-4">
      {/* Filter Dropdown */}
      <div className="flex items-center gap-3">
        <Select value={filter} onValueChange={(v: MapView) => setFilter(v)}>
          <SelectTrigger className="w-[260px] bg-card/60 backdrop-blur-xl border-border/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border z-50">
            {(Object.entries(VIEW_LABELS) as [MapView, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filter !== "all" && (
          <button onClick={() => setFilter("all")} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Vis alle
          </button>
        )}
      </div>

      {/* Throughput Gauge */}
      {(filter === "all" || filter === "integrations") && (
        <div className={`rounded-2xl border backdrop-blur-xl bg-card/60 border-border/50 p-3 transition-all duration-500`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">System Throughput</h2>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">{computed.recordsLastHour.toLocaleString()} records/t</span>
              <span className="text-muted-foreground">{computed.apiCallsLastHour.toLocaleString()} API-kald/t</span>
            </div>
          </div>
          <div className="w-full bg-muted rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${systemStatus === "ok" ? "bg-emerald-500" : systemStatus === "warning" ? "bg-amber-500" : "bg-red-500 animate-pulse"}`}
              style={{ width: `${computed.systemUsage}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">{computed.systemUsage.toFixed(0)}% af samlet kapacitet</p>
        </div>
      )}

      {/* ─── ZONE 1: EKSTERNE KILDER ─── */}
      <div className={`transition-all duration-500 ${!isVisible("sources") ? "opacity-20 grayscale pointer-events-none" : ""}`}>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Zone 1 – Eksterne Kilder</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <ZoneCard title="Adversus API" icon={Cloud} status={computed.adversusStatus} dimmed={false}
            items={[{ icon: ShoppingCart, label: "Salg" }, { icon: Users, label: "Agenter" }, { icon: Target, label: "Kampagner" }]} />
          <ZoneCard title="Enreach API" icon={Cloud} status={computed.enreachStatus} dimmed={false}
            items={[{ icon: Phone, label: "Opkald" }, { icon: Users, label: "Queues" }]} />
          <ZoneCard title="Webhooks" icon={Webhook} status="ok" dimmed={false}
            items={[{ icon: Zap, label: "Adversus" }, { icon: Zap, label: "Dialer" }, { icon: Zap, label: "e-conomic" }, { icon: Zap, label: "Zapier" }]} />
          <ZoneCard title="Twilio" icon={Phone} status="ok" dimmed={false}
            items={[{ icon: Headphones, label: "Softphone" }, { icon: MessageSquare, label: "SMS" }]} />
          <ZoneCard title="e-conomic API" icon={Receipt} status="ok" dimmed={false}
            items={[{ icon: FileText, label: "Fakturaer" }, { icon: Package, label: "Produkter" }]} />
        </div>
      </div>

      <FlowArrow vertical dimmed={!isVisible("sources") || !isVisible("processing")} />

      {/* ─── ZONE 2: BACKEND PROCESSING ─── */}
      <div className={`transition-all duration-500 ${!isVisible("processing") ? "opacity-20 grayscale pointer-events-none" : ""}`}>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Zone 2 – Backend Processing</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <ZoneCard title="Integration Engine" icon={Server} status={computed.engineStatus} dimmed={false}
            items={[{ icon: Layers, label: "Adversus Adapter", status: computed.adversusStatus }, { icon: Layers, label: "Enreach Adapter", status: computed.enreachStatus }, { icon: Clock, label: "Rate Limiter" }, { icon: Activity, label: "Smart Backfill" }]} />
          <ZoneCard title="Webhook Processors" icon={Zap} status="ok" dimmed={false}
            items={[{ icon: Zap, label: "Event Parser" }, { icon: Zap, label: "Dedup" }, { icon: Database, label: "Upsert" }]} />
          <ZoneCard title="Edge Functions" icon={Cloud} status="ok" dimmed={false}
            items={[{ icon: Zap, label: "60+ funktioner" }, { icon: Lock, label: "Auth Middleware" }, { icon: Activity, label: "CORS" }]} />
        </div>
      </div>

      <FlowArrow vertical dimmed={!isVisible("processing") || !isVisible("database")} />

      {/* ─── ZONE 3: DATABASE ─── */}
      <div className={`transition-all duration-500 ${!isVisible("database") ? "opacity-20 grayscale pointer-events-none" : ""}`}>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Zone 3 – Database Layer</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <ZoneCard title="Primær Database" icon={Database} status="ok" dimmed={false}
            items={[{ icon: ShoppingCart, label: "sales" }, { icon: Users, label: "employees" }, { icon: Briefcase, label: "teams" }, { icon: FileText, label: "contracts" }, { icon: Target, label: "campaigns" }, { icon: Activity, label: "sync_runs" }]} />
          <ZoneCard title="Auth & Sessions" icon={Lock} status="ok" dimmed={false}
            items={[{ icon: LogIn, label: "auth.users" }, { icon: Shield, label: "Roller" }, { icon: Clock, label: "Sessions" }]} />
          <ZoneCard title="Logs & Audit" icon={FileBarChart} status="ok" dimmed={false}
            items={[{ icon: Activity, label: "integration_logs" }, { icon: ClipboardList, label: "schedule_audit" }, { icon: FileText, label: "login_log" }]} />
        </div>
      </div>

      <FlowArrow vertical dimmed={!isVisible("database")} />

      {/* ─── ZONE 4: APP MODULER ─── */}
      <div className={`transition-all duration-500 ${!isVisible("app") && !isVisible("app-personnel") && !isVisible("app-games") && !isVisible("app-recruitment") && !isVisible("app-onboarding") && !isVisible("app-shifts") && !isVisible("app-fieldmarketing") && !isVisible("app-economy") && !isVisible("app-reports") ? "opacity-20 grayscale pointer-events-none" : ""}`}>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Zone 4 – Applikationsmoduler</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">

          <ZoneCard title="Personale" icon={Users} status="ok" dimmed={!isVisible("app") && !isVisible("app-personnel")}
            items={[{ icon: Users, label: "Medarbejdere" }, { icon: Briefcase, label: "Teams" }, { icon: Shield, label: "Rettigheder" }, { icon: LogIn, label: "Login Log" }]} />

          <ZoneCard title="Spil & Liga" icon={Trophy} status="ok" dimmed={!isVisible("app") && !isVisible("app-games")}
            items={[{ icon: Trophy, label: "Superligaen" }, { icon: Swords, label: "Head-to-Head" }]} />

          <ZoneCard title="Rekruttering" icon={UserPlus} status="ok" dimmed={!isVisible("app") && !isVisible("app-recruitment")}
            items={[{ icon: ClipboardList, label: "Pipeline" }, { icon: UserPlus, label: "Kandidater" }, { icon: Heart, label: "Winback" }, { icon: MessageSquare, label: "Beskeder" }]} />

          <ZoneCard title="Onboarding" icon={GraduationCap} status="ok" dimmed={!isVisible("app") && !isVisible("app-onboarding")}
            items={[{ icon: BookOpen, label: "Kursus" }, { icon: TrendingUp, label: "Ramp-up" }, { icon: Target, label: "Drills" }, { icon: GraduationCap, label: "Coaching" }]} />

          <ZoneCard title="Vagtplan & Tid" icon={Calendar} status="ok" dimmed={!isVisible("app") && !isVisible("app-shifts")}
            items={[{ icon: Calendar, label: "Vagtplan" }, { icon: Clock, label: "Fravær" }, { icon: Stamp, label: "Stempelur" }, { icon: ClipboardList, label: "Tidsregistrering" }]} />

          <ZoneCard title="Fieldmarketing" icon={MapPin} status="ok" dimmed={!isVisible("app") && !isVisible("app-fieldmarketing")}
            items={[{ icon: MapPin, label: "Booking" }, { icon: Car, label: "Køretøjer" }, { icon: ShoppingCart, label: "Salgsregistrering" }]} />

          <ZoneCard title="Økonomi & Løn" icon={Wallet} status="ok" dimmed={!isVisible("app") && !isVisible("app-economy")}
            items={[{ icon: LayoutDashboard, label: "Dashboard" }, { icon: Receipt, label: "Udgifter" }, { icon: PiggyBank, label: "Budget" }, { icon: Receipt, label: "e-conomic" }, { icon: DollarSign, label: "Løntyper" }, { icon: DollarSign, label: "Lønkørsel" }]} />

          <ZoneCard title="Rapporter" icon={FileBarChart} status="ok" dimmed={!isVisible("app") && !isVisible("app-reports")}
            items={[{ icon: FileBarChart, label: "Daglige" }, { icon: FileBarChart, label: "Ledelse" }, { icon: FileBarChart, label: "Annulleringer" }]} />

          <ZoneCard title="SOME" icon={Share2} status="ok" dimmed={!isVisible("app")}
            items={[{ icon: Megaphone, label: "Indhold" }, { icon: Target, label: "Mål" }, { icon: Briefcase, label: "Ekstraarbejde" }]} />

          <ZoneCard title="Salg & System" icon={Settings} status="ok" dimmed={!isVisible("app")}
            items={[{ icon: ShoppingCart, label: "Salg" }, { icon: Activity, label: "Live Stats" }, { icon: Settings, label: "Indstillinger" }, { icon: Layers, label: "Logikker" }]} />

          <ZoneCard title="Ledelse" icon={Building2} status="ok" dimmed={!isVisible("app")}
            items={[{ icon: Building2, label: "Firmaoversigt" }, { icon: FileText, label: "Kontrakter" }, { icon: Heart, label: "Karriereønsker" }]} />

          <ZoneCard title="Chat & Kommunikation" icon={MessageSquare} status="ok" dimmed={!isVisible("app")}
            items={[{ icon: MessageSquare, label: "Chat" }, { icon: Phone, label: "Softphone" }, { icon: Megaphone, label: "Nyheder" }]} />
        </div>
      </div>

      <FlowArrow vertical dimmed={!isVisible("kpi")} />

      {/* ─── ZONE 5: KPI & CACHE ─── */}
      <div className={`transition-all duration-500 ${!isVisible("kpi") ? "opacity-20 grayscale pointer-events-none" : ""}`}>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Zone 5 – KPI & Cache</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <ZoneCard title="pg_cron Scheduler" icon={Clock} status="ok" dimmed={false}
            items={[{ icon: Clock, label: "Periodisk trigger" }, { icon: Activity, label: "Incremental" }]} />
          <ZoneCard title="KPI Functions" icon={BarChart3} status="ok" dimmed={false}
            items={[{ icon: BarChart3, label: "Values" }, { icon: Trophy, label: "Leaderboard" }, { icon: TrendingUp, label: "Incremental" }]} />
          <ZoneCard title="Cache Tabeller" icon={Database} status="ok" dimmed={false}
            items={[{ icon: Database, label: "kpi_cached_values" }, { icon: Trophy, label: "leaderboard_cache" }]} />
        </div>
      </div>

      <FlowArrow vertical dimmed={!isVisible("kpi") || !isVisible("output")} />

      {/* ─── ZONE 6: OUTPUT ─── */}
      <div className={`transition-all duration-500 ${!isVisible("output") ? "opacity-20 grayscale pointer-events-none" : ""}`}>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Zone 6 – Output</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <ZoneCard title="Klient Dashboards" icon={Monitor} status="ok" dimmed={false}
            items={[
              { icon: Monitor, label: "Eesy TM" }, { icon: Monitor, label: "Eesy FM" },
              { icon: Monitor, label: "TDC" }, { icon: Monitor, label: "Relatel" },
              { icon: Monitor, label: "Tryg" }, { icon: Monitor, label: "TV" },
              { icon: Monitor, label: "Norlys" }, { icon: Monitor, label: "Telia" },
              { icon: Monitor, label: "YouSee" }, { icon: Monitor, label: "3" },
            ]} />
          <ZoneCard title="TV Boards" icon={Tv} status="ok" dimmed={false}
            items={[{ icon: Tv, label: "Salg Live" }, { icon: Tv, label: "Liga" }, { icon: Tv, label: "Leaderboard" }]} />
          <ZoneCard title="Softphone" icon={Headphones} status="ok" dimmed={false}
            items={[{ icon: Phone, label: "WebRTC" }, { icon: Users, label: "Agent Presence" }, { icon: Activity, label: "Call Status" }]} />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground px-1 pt-2">
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> OK</div>
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Advarsel</div>
        <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" /> Overload / Fejl</div>
      </div>
    </div>
  );
}
