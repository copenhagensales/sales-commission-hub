import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useAutoReload, isTvMode } from "@/utils/tvMode";
import { useTdcMonthlyGoal } from "@/hooks/useTdcMonthlyGoal";
import { Target, Trophy, Loader2 } from "lucide-react";
import { calcBoardProgress, statusFillClass } from "@/lib/boardProgress";

function fmt(n: number) {
  return n.toLocaleString("da-DK", { maximumFractionDigits: 1 });
}

function barColor(progress: number) {
  if (progress >= 100) return "bg-emerald-400";
  if (progress >= 75) return "bg-sky-400";
  if (progress >= 50) return "bg-amber-400";
  return "bg-rose-400";
}

export default function TdcMonthlyGoalBoard() {
  const tv = isTvMode();
  useAutoReload(tv, 5 * 60_000);
  const { data, isLoading, error } = useTdcMonthlyGoal();

  const today = new Date();
  const teamProgressInfo = calcBoardProgress(data?.teamGoal ?? 0, data?.teamCount ?? 0, today);
  const teamMarkerPct = Math.min(100, Math.max(0, teamProgressInfo.forventetPct));


  const content = (
    <div className="min-h-screen w-full bg-slate-950 text-white p-6 md:p-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight">TDC Månedsmål</h1>
          <p className="text-slate-400 mt-1 text-lg">{data?.monthLabel ?? ""}</p>
        </div>
        <Target className="h-10 w-10 md:h-14 md:w-14 text-sky-400" />
      </div>

      {(error || data?.warning) && (
        <p className="text-rose-400 text-sm mb-4">
          Datafejl: {(error as Error | null)?.message ?? data?.warning}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-10 w-10 animate-spin text-sky-400" />
        </div>
      ) : (
        <>
          {/* Fælles mål */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 md:p-8 mb-8">
            <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Trophy className="h-7 w-7 text-yellow-400" />
                <span className="text-xl md:text-2xl font-semibold text-slate-200">Fælles mål</span>
              </div>
              <div className="text-right">
                <div className="text-4xl md:text-6xl font-bold tabular-nums">
                  {fmt(data?.teamCount ?? 0)}
                  <span className="text-slate-500 text-2xl md:text-4xl"> / {fmt(data?.teamGoal ?? 0)}</span>
                </div>
                <div className="text-slate-400 text-lg">
                  {Math.round(data?.teamProgress ?? 0)}% opnået
                  {(data?.teamGoal ?? 0) > 0 && (
                    <> · forventet {fmt(Math.round(teamProgressInfo.forventet))}</>
                  )}
                  {(data?.teamGoal ?? 0) > 0 && (data?.teamCount ?? 0) < (data?.teamGoal ?? 0) && (
                    <> · {fmt((data?.teamGoal ?? 0) - (data?.teamCount ?? 0))} tilbage</>
                  )}
                </div>
              </div>
            </div>
            <div className="relative h-8 w-full rounded-full bg-white/5 overflow-hidden">
              {/* Ghost-fyld: forventet niveau */}
              {(data?.teamGoal ?? 0) > 0 && (
                <div
                  className={`absolute inset-y-0 left-0 rounded-full opacity-25 ${barColor(data?.teamProgress ?? 0)}`}
                  style={{ width: `${teamMarkerPct}%` }}
                />
              )}
              {/* Faktisk fyld */}
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${barColor(data?.teamProgress ?? 0)}`}
                style={{ width: `${Math.min(100, data?.teamProgress ?? 0)}%` }}
              />
              {/* Markør for forventet */}
              {(data?.teamGoal ?? 0) > 0 && (
                <div
                  className="absolute inset-y-0 w-0.5 rounded-full bg-slate-100"
                  style={{ left: `calc(${teamMarkerPct}% - 1px)` }}
                />
              )}
            </div>
            {(data?.teamGoal ?? 0) > 0 && (
              <div className="relative h-5 mt-1">
                <span
                  className="absolute text-xs text-slate-400 -translate-x-1/2 whitespace-nowrap"
                  style={{ left: `${teamMarkerPct}%` }}
                >
                  forventet
                </span>
              </div>
            )}
            {(data?.teamGoal ?? 0) === 0 && (
              <p className="text-amber-400 text-sm mt-3">Månedsmål mangler for denne måned.</p>
            )}
          </div>

          {/* Individuelle mål */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 md:p-8">
            <h2 className="text-xl md:text-2xl font-semibold text-slate-200 mb-5">Individuelle mål</h2>
            {(data?.sellers.length ?? 0) === 0 ? (
              <p className="text-slate-400">Ingen aktive sælgere på TDC Erhverv-teamet.</p>
            ) : (
              (() => {
                const sellers = data!.sellers;
                const half = Math.ceil(sellers.length / 2);
                const columns = [sellers.slice(0, half), sellers.slice(half)];

                const renderSeller = (s: typeof sellers[number]) => {
                  const sellerStatus = calcBoardProgress(s.goal, s.count, today).status;
                  return (
                    <div key={s.employeeId}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span
                          className={`text-base md:text-lg font-medium truncate pr-3 ${
                            s.goal > 0 && s.progress >= 100 ? "text-emerald-400" : "text-slate-100"
                          }`}
                        >
                          {s.name}
                        </span>
                        <span className="text-base md:text-lg tabular-nums text-slate-300 whitespace-nowrap">
                          {fmt(s.count)}
                          {s.goal > 0 && (
                            <>
                              <span className="text-slate-500"> / {fmt(s.goal)}</span>
                              <span className="text-slate-500 ml-3">{Math.round(s.progress)}%</span>
                            </>
                          )}
                        </span>
                      </div>
                      {s.goal > 0 && (
                        <div className="h-3 w-full rounded-full bg-white/5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${statusFillClass(sellerStatus)}`}
                            style={{ width: `${Math.min(100, s.progress)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                };

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10">
                    {columns.map((col, i) => (
                      <div key={i} className="space-y-3">
                        {col.map(renderSeller)}
                      </div>
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </>
      )}
    </div>
  );

  if (tv) return content;
  return (
    <DashboardShell>
      <DashboardHeader title="TDC Månedsmål" subtitle={data?.monthLabel ?? ""} />
      {content}
    </DashboardShell>
  );
}
