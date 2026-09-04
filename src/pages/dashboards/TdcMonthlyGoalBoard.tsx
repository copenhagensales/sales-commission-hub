import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { useAutoReload, isTvMode } from "@/utils/tvMode";
import { useTdcMonthlyGoal } from "@/hooks/useTdcMonthlyGoal";
import { Target, Trophy, Loader2, Medal } from "lucide-react";
import { calcBoardProgress, indeksBarClass, statusFillClass, statusTextClass } from "@/lib/boardProgress";

function fmt(n: number) {
  return n.toLocaleString("da-DK", { maximumFractionDigits: 1 });
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
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">TDC Månedsmål</h1>
          <p className="text-slate-400 mt-0.5 text-base">{data?.monthLabel ?? ""}</p>
        </div>
        <Target className="h-8 w-8 md:h-10 md:w-10 text-sky-400" />
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
              <div className="flex items-end gap-6 md:gap-10">
                {(data?.teamGoal ?? 0) > 0 && (
                  <>
                    <div className="text-right">
                      <div
                        className={`text-3xl md:text-5xl font-bold tabular-nums ${statusTextClass(teamProgressInfo.status)}`}
                      >
                        {teamProgressInfo.indeks === null ? "—" : `${Math.round(teamProgressInfo.indeks)}%`}
                      </div>
                      {teamProgressInfo.indeks !== null && (
                        <div className="text-slate-400 text-base md:text-lg">indeks · 100 = på target</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-3xl md:text-5xl font-bold tabular-nums text-slate-100">
                        {teamProgressInfo.gab > 0 ? "−" : ""}{fmt(Math.abs(Math.round(teamProgressInfo.gab * 10) / 10))}
                      </div>
                      <div className="text-slate-400 text-base md:text-lg">
                        {teamProgressInfo.gab > 0 ? "bagud på dagen" : "foran på dagen"}
                      </div>
                    </div>
                  </>
                )}

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
            </div>
            <div className="relative h-10 md:h-12 w-full rounded-full bg-white/5 overflow-hidden">
              {/* Ghost-fyld: forventet niveau */}
              {(data?.teamGoal ?? 0) > 0 && (
                <div
                  className={`absolute inset-y-0 left-0 rounded-full opacity-25 ${indeksBarClass(teamProgressInfo.status)}`}
                  style={{ width: `${teamMarkerPct}%` }}
                />
              )}
              {/* Faktisk fyld */}
              <div
                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${indeksBarClass(teamProgressInfo.status)}`}
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

            {/* Dagsbokse: én pr. dag i måneden med dagens salg */}
            {(data?.days.length ?? 0) > 0 && (
              <div className="mt-3 flex gap-1 md:gap-1.5">
                {data!.days.map((d) => (
                  <div
                    key={d.date}
                    className={`flex-1 min-w-0 rounded-md border px-0.5 py-1 text-center ${
                      d.isToday
                        ? "border-sky-400 bg-sky-400/10"
                        : d.isWeekend
                          ? "border-white/5 bg-white/[0.02]"
                          : "border-white/10 bg-white/5"
                    }`}
                  >
                    <div className="text-[10px] md:text-xs text-slate-500 tabular-nums leading-none">{d.day}</div>
                    <div
                      className={`text-sm md:text-lg font-semibold tabular-nums leading-tight ${
                        d.count > 0 ? "text-slate-100" : d.isFuture ? "text-slate-700" : "text-slate-600"
                      }`}
                    >
                      {d.isFuture ? "" : fmt(d.count)}
                    </div>
                  </div>
                ))}
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
                  const gold = !!s.isFirstAchiever;
                  return (
                    <div key={s.employeeId}>
                      <div className="flex items-baseline justify-between mb-1">
                        <span
                          className={`text-base md:text-lg font-medium truncate pr-3 flex items-center gap-2 ${
                            gold
                              ? "text-amber-300"
                              : s.goal > 0 && s.progress >= 100
                                ? "text-emerald-400"
                                : "text-slate-100"
                          }`}
                        >
                          <span className="truncate">{s.name}</span>
                          {gold && (
                            <Medal
                              className="h-5 w-5 md:h-6 md:w-6 shrink-0 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]"
                              aria-label="Første der nåede sit mål"
                            />
                          )}
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
                            className={`h-full rounded-full transition-all duration-700 ${
                              gold
                                ? "bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-400"
                                : statusFillClass(sellerStatus)
                            }`}
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
