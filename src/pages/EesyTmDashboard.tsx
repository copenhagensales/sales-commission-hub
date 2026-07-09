import { useMemo } from "react";
import { format, differenceInCalendarDays } from "date-fns";
import { da } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useClientDashboardKpis, getKpiValue } from "@/hooks/usePrecomputedKpi";
import { useCachedLeaderboards, type LeaderboardEntry, getInitials, formatDisplayName } from "@/hooks/useCachedLeaderboard";
import { useRequireDashboardAccess } from "@/hooks/useRequireDashboardAccess";
import { calculatePayrollPeriod, formatCurrency } from "@/lib/calculations";
import { getClientId } from "@/utils/clientIds";
import { isTvMode, useAutoReload } from "@/utils/tvMode";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const EESY_ID = getClientId("Eesy TM")!;
const HIPER_ID = getClientId("Hiper")!;

interface Row {
  employeeId: string;
  name: string;
  displayName: string;
  avatarUrl: string | null;
  todaySales: number;
  todayCommission: number;
  weekSales: number;
  weekCommission: number;
  payrollSales: number;
  payrollCommission: number;
  hiperPayrollSales: number;
  hiperTotalCommission: number;
}

function mergeBoards(
  eesy: LeaderboardEntry[],
  hiper: LeaderboardEntry[],
  key: "today" | "week" | "payroll",
  target: Map<string, Row>,
) {
  const push = (e: LeaderboardEntry, isHiper: boolean) => {
    let r = target.get(e.employeeId);
    if (!r) {
      r = {
        employeeId: e.employeeId,
        name: e.employeeName,
        displayName: e.displayName || formatDisplayName(e.employeeName),
        avatarUrl: e.avatarUrl,
        todaySales: 0, todayCommission: 0,
        weekSales: 0, weekCommission: 0,
        payrollSales: 0, payrollCommission: 0,
        hiperPayrollSales: 0, hiperTotalCommission: 0,
      };
      target.set(e.employeeId, r);
    }
    if (!r.avatarUrl && e.avatarUrl) r.avatarUrl = e.avatarUrl;
    if (key === "today") {
      if (!isHiper) r.todaySales += e.salesCount;
      r.todayCommission += e.commission;
    } else if (key === "week") {
      if (!isHiper) r.weekSales += e.salesCount;
      r.weekCommission += e.commission;
    } else {
      if (isHiper) {
        r.hiperPayrollSales += e.salesCount;
        r.hiperTotalCommission += e.commission;
      } else {
        r.payrollSales += e.salesCount;
      }
      r.payrollCommission += e.commission;
    }
  };
  eesy.forEach((e) => push(e, false));
  hiper.forEach((e) => push(e, true));
}

const RANK_STYLES: Record<number, string> = {
  1: "bg-amber-400 text-slate-950",
  2: "bg-slate-300 text-slate-950",
  3: "bg-orange-500 text-slate-950",
};

const BAR_STYLES: Record<number, string> = {
  1: "from-amber-400 via-amber-500 to-amber-600",
  2: "from-slate-300 via-slate-400 to-slate-500",
  3: "from-orange-400 via-orange-500 to-orange-600",
};

function TrendIcon({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <TrendingUp className="w-5 h-5 text-emerald-400" />;
  if (trend === "down") return <TrendingDown className="w-5 h-5 text-rose-400" />;
  return <Minus className="w-5 h-5 text-slate-500" />;
}

function KpiCard({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: string | number;
  sub: string;
  accent?: "default" | "emerald" | "rose";
}) {
  const accentText =
    accent === "emerald" ? "text-emerald-400"
    : accent === "rose" ? "text-rose-400"
    : "text-white";
  const border =
    accent === "emerald" ? "border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-slate-900/40 to-slate-950/60"
    : accent === "rose" ? "border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-slate-900/40 to-slate-950/60"
    : "border-white/5 bg-slate-900/40";
  return (
    <div className={cn("rounded-2xl border p-5 backdrop-blur-sm", border)}>
      <p className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase">{label}</p>
      <p className={cn("mt-3 text-5xl font-bold tabular-nums leading-none", accentText)}>{value}</p>
      <p className="mt-3 text-xs text-slate-500">{sub}</p>
    </div>
  );
}

export default function EesyTmDashboard() {
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("eesy-tm");
  const tvMode = isTvMode();
  useAutoReload(tvMode);

  const payrollPeriod = useMemo(() => calculatePayrollPeriod(), []);
  const today = new Date();

  // Eesy KPIs (single-client cache)
  const { data: eesyKpis } = useClientDashboardKpis(EESY_ID, [
    "sales_count", "total_commission", "total_hours",
  ]);
  const { data: hiperKpis } = useClientDashboardKpis(HIPER_ID, [
    "sales_count", "total_commission", "total_hours",
  ]);

  const eesyBoards = useCachedLeaderboards({ type: "client", id: EESY_ID }, { limit: 50 });
  const hiperBoards = useCachedLeaderboards({ type: "client", id: HIPER_ID }, { limit: 50 });

  // Merge into rows
  const rows: Row[] = useMemo(() => {
    const map = new Map<string, Row>();
    mergeBoards(eesyBoards.sellersToday, hiperBoards.sellersToday, "today", map);
    mergeBoards(eesyBoards.sellersWeek, hiperBoards.sellersWeek, "week", map);
    mergeBoards(eesyBoards.sellersPayroll, hiperBoards.sellersPayroll, "payroll", map);
    return Array.from(map.values())
      .filter((r) => r.payrollCommission > 0 || r.payrollSales > 0 || r.hiperPayrollSales > 0)
      .sort((a, b) => b.payrollCommission - a.payrollCommission);
  }, [eesyBoards.sellersToday, eesyBoards.sellersWeek, eesyBoards.sellersPayroll,
      hiperBoards.sellersToday, hiperBoards.sellersWeek, hiperBoards.sellersPayroll]);

  const maxProvision = rows.reduce((m, r) => Math.max(m, r.payrollCommission), 1);

  // KPI totals
  const salesToday = getKpiValue(eesyKpis?.today?.sales_count);
  const salesWeek = getKpiValue(eesyKpis?.this_week?.sales_count);
  const salesMonth = getKpiValue(eesyKpis?.this_month?.sales_count);
  const salesPayroll = getKpiValue(eesyKpis?.payroll_period?.sales_count);
  const hiperPayroll = getKpiValue(hiperKpis?.payroll_period?.sales_count);
  const payrollHours = getKpiValue(eesyKpis?.payroll_period?.total_hours);
  const salesPerHour = payrollHours > 0 ? (salesPayroll + hiperPayroll) / payrollHours : 0;

  // Trend: today's provision vs average day of period
  const daysElapsed = Math.max(1, differenceInCalendarDays(today, payrollPeriod.start) + 1);
  const trendFor = (r: Row): "up" | "down" | "flat" => {
    const avg = r.payrollCommission / daysElapsed;
    if (r.todayCommission === 0 && avg === 0) return "flat";
    if (r.todayCommission === 0) return "down";
    if (r.todayCommission >= avg * 1.15) return "up";
    if (r.todayCommission <= avg * 0.6) return "down";
    return "flat";
  };

  // Ticker
  const topSeller = rows[0];
  const second = rows[1];
  const mostSales = [...rows].sort((a, b) => (b.payrollSales + b.hiperPayrollSales) - (a.payrollSales + a.hiperPayrollSales))[0];
  const mostHiper = [...rows].sort((a, b) => b.hiperPayrollSales - a.hiperPayrollSales)[0];

  const ticker: string[] = [];
  if (topSeller) ticker.push(`◆ ${topSeller.displayName} fører feltet`);
  if (mostSales) ticker.push(`◆ ${mostSales.displayName} har flest salg i perioden — ${mostSales.payrollSales + mostSales.hiperPayrollSales}`);
  if (mostHiper && mostHiper.hiperPayrollSales > 0) ticker.push(`◆ ${mostHiper.displayName} har flest Hiper — ${mostHiper.hiperPayrollSales}`);
  ticker.push(`◆ Teamet: ${salesPayroll + hiperPayroll} salg i lønperioden`);
  if (second) ticker.push(`◆ ${second.displayName} næstflest provision — ${formatCurrency(second.payrollCommission)}`);
  ticker.push(`◆ ${salesMonth} salg i ${format(today, "MMMM", { locale: da })}`);

  const periodLabel = `${format(payrollPeriod.start, "d. MMM", { locale: da })} – ${format(payrollPeriod.end, "d. MMM", { locale: da })}`;

  if (accessLoading || !canView) return <DashboardShell><div /></DashboardShell>;

  return (
    <DashboardShell>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-black text-white p-6 lg:p-10">
        <div className="mx-auto max-w-[1800px] rounded-[32px] border border-white/5 bg-slate-950/60 p-6 lg:p-10 shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="rounded-2xl bg-white/95 px-4 py-2 flex items-center gap-2 shadow-lg">
                <span className="text-xl font-bold italic text-emerald-500 tracking-tight">eesy</span>
                <span className="h-6 w-px bg-slate-300" />
                <span className="text-sm font-bold text-rose-500 tracking-widest">HIPER</span>
              </div>
              <div>
                <h1 className="text-3xl lg:text-4xl font-bold tracking-tight">Team</h1>
                <p className="text-sm text-slate-400 mt-1">Lønperiode {periodLabel} · opdateres live</p>
              </div>
            </div>
            <div className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-slate-950">
              Lønperiode
            </div>
          </div>

          <div className="mt-6 h-px bg-white/10" />

          {/* KPI grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-6">
            <KpiCard label="Salg i dag" value={salesToday} sub={format(today, "d. MMMM", { locale: da })} />
            <KpiCard label="Denne uge" value={salesWeek} sub={`Uge ${format(today, "w", { locale: da })}`} />
            <KpiCard label="Denne måned" value={salesMonth} sub={format(today, "MMMM", { locale: da })} />
            <KpiCard label="Salg · lønperiode" value={salesPayroll.toLocaleString("da-DK")} sub={periodLabel} accent="emerald" />
            <KpiCard label={`Hiper · lønperiode`} value={hiperPayroll} sub={periodLabel} accent="rose" />
            <KpiCard label="Salg / time" value={salesPerHour.toFixed(2).replace(".", ",")} sub={`${payrollHours.toFixed(0)} timer`} />
          </div>

          {/* Leaderboard */}
          <div className="mt-6 rounded-2xl border border-white/5 bg-slate-900/40 p-5 lg:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-200">Ranglisten · provision</h2>
              <div className="flex items-center gap-4 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> eesy salg</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Hiper</span>
              </div>
            </div>

            <div className="space-y-2">
              {rows.length === 0 && (
                <div className="text-center text-slate-500 py-12 text-sm">Ingen salg registreret i lønperioden endnu.</div>
              )}
              {rows.map((r, i) => {
                const rank = i + 1;
                const barPct = Math.max(6, (r.payrollCommission / maxProvision) * 100);
                const rankStyle = RANK_STYLES[rank] || "bg-slate-800 text-slate-300 border border-slate-700";
                const barStyle = BAR_STYLES[rank] || "from-emerald-500 via-emerald-500 to-emerald-600";
                const trend = trendFor(r);
                return (
                  <div key={r.employeeId} className="grid grid-cols-[40px_44px_180px_60px_60px_1fr_120px_28px] items-center gap-3 py-2">
                    <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg", rankStyle)}>
                      {rank}
                    </div>
                    <Avatar className="h-10 w-10 border border-white/10 bg-slate-800">
                      <AvatarImage src={r.avatarUrl || undefined} />
                      <AvatarFallback className="bg-cyan-700 text-white text-xs font-semibold">
                        {getInitials(r.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-base font-semibold text-slate-100 truncate">{r.displayName}</div>
                    <div className="text-center">
                      <div className="text-[9px] font-semibold tracking-widest text-slate-500 uppercase">I dag</div>
                      <div className="text-base font-bold text-slate-100 tabular-nums leading-tight">
                        {r.todaySales > 0 ? r.todaySales : "–"}
                      </div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        {r.todayCommission > 0 ? formatCurrency(r.todayCommission) : "–"}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-[9px] font-semibold tracking-widest text-slate-500 uppercase">Uge</div>
                      <div className="text-base font-bold text-slate-100 tabular-nums leading-tight">
                        {r.weekSales > 0 ? r.weekSales : "–"}
                      </div>
                      <div className="text-[10px] text-slate-500 tabular-nums">
                        {r.weekCommission > 0 ? formatCurrency(r.weekCommission) : "–"}
                      </div>
                    </div>
                    <div className="relative h-9 rounded-full bg-slate-800/60 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full bg-gradient-to-r flex items-center px-4 gap-2", barStyle)}
                        style={{ width: `${barPct}%` }}
                      >
                        <span className="text-xs font-semibold text-slate-950 whitespace-nowrap">
                          {r.payrollSales + r.hiperPayrollSales} salg
                        </span>
                        {r.hiperPayrollSales > 0 && (
                          <span className="text-[10px] font-bold bg-rose-500 text-white rounded-full px-2 py-0.5 whitespace-nowrap">
                            {r.hiperPayrollSales} Hiper
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-2xl font-bold text-slate-100 tabular-nums">
                      {formatCurrency(r.payrollCommission)}
                    </div>
                    <div className="flex justify-center"><TrendIcon trend={trend} /></div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ticker */}
          <div className="mt-4 overflow-hidden rounded-full border border-white/5 bg-slate-900/40 py-3">
            <div className="flex gap-10 text-xs text-slate-400 whitespace-nowrap animate-[marquee_60s_linear_infinite] px-6">
              {[...ticker, ...ticker].map((t, i) => (
                <span key={i}>{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
