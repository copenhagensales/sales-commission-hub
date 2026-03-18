import { useMemo } from "react";
import { Flame, Target, TrendingUp, Swords, Clock, Trophy, Rocket } from "lucide-react";
import { usePersonalWeeklyStats } from "@/hooks/usePersonalWeeklyStats";
import { useSalesGamification } from "@/hooks/useSalesGamification";
import type { QualificationStanding } from "@/hooks/useLeagueData";
import type { LeagueSeasonStanding } from "@/hooks/useLeagueActiveData";

interface LeagueMotivationBarProps {
  employeeId: string;
  myStanding: QualificationStanding | LeagueSeasonStanding | null;
  standings: (QualificationStanding | LeagueSeasonStanding)[];
  dailyTarget: number;
  todayTotal: number;
  currentWeekTotal: number;
}

interface MotivationSignal {
  priority: number;
  icon: React.ReactNode;
  message: React.ReactNode;
  color: "red" | "amber" | "green" | "blue";
}

function formatKr(amount: number): string {
  return Math.round(amount).toLocaleString("da-DK");
}

function getProvision(standing: QualificationStanding | LeagueSeasonStanding): number {
  if ("current_provision" in standing) return standing.current_provision;
  if ("total_provision" in standing) return Number(standing.total_provision);
  return 0;
}

function getOverallRank(standing: QualificationStanding | LeagueSeasonStanding): number {
  return standing.overall_rank;
}

function getEmployeeName(standing: QualificationStanding | LeagueSeasonStanding): string {
  if (standing.employee) {
    return standing.employee.first_name;
  }
  return `#${getOverallRank(standing)}`;
}

export function LeagueMotivationBar({
  employeeId,
  myStanding,
  standings,
  dailyTarget,
  todayTotal,
  currentWeekTotal,
}: LeagueMotivationBarProps) {
  const { data: weeklyStats } = usePersonalWeeklyStats(employeeId);

  const gamification = useSalesGamification({
    employeeId,
    currentPeriodTotal: currentWeekTotal,
    targetAmount: dailyTarget * 30,
    progressPercent: dailyTarget > 0 ? (todayTotal / dailyTarget) * 100 : 0,
    isAhead: todayTotal >= dailyTarget,
    isOnTrack: todayTotal >= dailyTarget * 0.8,
    daysPassedInPeriod: 1,
    totalDaysInPeriod: 30,
    dailyTarget,
    todayTotal,
    currentWeekTotal,
  });

  const signals = useMemo(() => {
    const result: MotivationSignal[] = [];

    const { currentStreak, hitDailyGoal, bestDayRecord } = gamification;
    const currentWeek = weeklyStats?.currentWeek?.weekTotal ?? 0;
    const lastWeek = weeklyStats?.lastWeek?.weekTotal ?? 0;

    // --- Compute extra effort (top 3 days) ---
    const dailyBreakdown = weeklyStats?.dailyBreakdown ?? [];
    const daysWithSales = dailyBreakdown.filter(d => d.commission > 0).sort((a, b) => b.commission - a.commission);
    const top3 = daysWithSales.slice(0, 3);
    const avgTopDay = top3.length > 0 ? top3.reduce((s, d) => s + d.commission, 0) / top3.length : 0;
    const hourlyRate = avgTopDay / 8;

    // --- Compute league gap ---
    let gapUp: { gap: number; name: string; rank: number } | null = null;
    let gapDown: { gap: number; name: string; rank: number } | null = null;
    if (myStanding && standings.length > 0) {
      const myRank = getOverallRank(myStanding);
      const myProv = getProvision(myStanding);
      const sorted = [...standings].sort((a, b) => getOverallRank(a) - getOverallRank(b));
      const above = sorted.find(s => getOverallRank(s) === myRank - 1);
      const below = sorted.find(s => getOverallRank(s) === myRank + 1);
      if (above) {
        gapUp = { gap: getProvision(above) - myProv, name: getEmployeeName(above), rank: getOverallRank(above) };
      }
      if (below) {
        gapDown = { gap: myProv - getProvision(below), name: getEmployeeName(below), rank: getOverallRank(below) };
      }
    }

    // 1. Streak i fare
    if (currentStreak > 0 && !hitDailyGoal) {
      result.push({
        priority: 1,
        icon: <Flame className="h-4 w-4 text-red-400" />,
        message: (
          <span>
            <span className="text-red-400 font-semibold">🔥 {currentStreak} dages streak</span>
            {" — 1 salg mere holder den i live!"}
          </span>
        ),
        color: "red",
      });
    }

    // 2. Tæt på overhalning
    if (gapUp && gapUp.gap < 2000 && gapUp.gap > 0) {
      result.push({
        priority: 2,
        icon: <Swords className="h-4 w-4 text-amber-400" />,
        message: (
          <span>
            {"Kun "}
            <span className="text-amber-400 font-semibold">{formatKr(gapUp.gap)} kr</span>
            {` til at overhale #${gapUp.rank} — inden for rækkevidde i dag`}
          </span>
        ),
        color: "amber",
      });
    }

    // 3. Tæt på dagens mål
    if (dailyTarget > 0) {
      const remaining = dailyTarget - todayTotal;
      if (remaining > 0 && remaining < dailyTarget * 0.5) {
        result.push({
          priority: 3,
          icon: <Target className="h-4 w-4 text-emerald-400" />,
          message: (
            <span>
              <span className="text-amber-400 font-semibold">{formatKr(remaining)} kr</span>
              {" til dagens mål — du er næsten der!"}
            </span>
          ),
          color: "green",
        });
      }
    }

    // 4. Streak kører
    if (currentStreak >= 3 && hitDailyGoal) {
      result.push({
        priority: 4,
        icon: <Flame className="h-4 w-4 text-amber-400" />,
        message: (
          <span>
            <span className="text-amber-400 font-semibold">🔥 {currentStreak} dages streak!</span>
            {" Hold tempoet de næste timer"}
          </span>
        ),
        color: "amber",
      });
    }

    // 5. Stærk uge-momentum
    if (lastWeek > 0 && currentWeek > lastWeek) {
      const pct = Math.round(((currentWeek - lastWeek) / lastWeek) * 100);
      result.push({
        priority: 5,
        icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
        message: (
          <span>
            <span className="text-emerald-400 font-semibold">+{pct}%</span>
            {" vs. forrige uge — hold tempoet de næste 2 timer 📈"}
          </span>
        ),
        color: "green",
      });
    }

    // 6. Nogen tæt bag dig
    if (gapDown && gapDown.gap < 1500 && gapDown.gap > 0) {
      result.push({
        priority: 6,
        icon: <Swords className="h-4 w-4 text-amber-400" />,
        message: (
          <span>
            {`#${gapDown.rank} er kun `}
            <span className="text-amber-400 font-semibold">{formatKr(gapDown.gap)} kr</span>
            {" bag dig — hold afstanden!"}
          </span>
        ),
        color: "amber",
      });
    }

    // 7. Ekstra indsats
    if (hourlyRate > 0) {
      result.push({
        priority: 7,
        icon: <Clock className="h-4 w-4 text-blue-400" />,
        message: (
          <span>
            {"Hver time ekstra ≈ "}
            <span className="text-amber-400 font-semibold">{formatKr(hourlyRate)} kr</span>
            {" · Lørdag = +"}
            <span className="text-amber-400 font-semibold">{formatKr(hourlyRate * 8)} kr</span>
          </span>
        ),
        color: "blue",
      });
    }

    // 8. Svag uge (konstruktivt)
    if (lastWeek > 0 && currentWeek < lastWeek && currentWeek > 0) {
      const diff = lastWeek - currentWeek;
      result.push({
        priority: 8,
        icon: <TrendingUp className="h-4 w-4 text-amber-400" />,
        message: (
          <span>
            {"Du er ikke langt fra sidste uge — "}
            <span className="text-amber-400 font-semibold">{formatKr(diff)} kr</span>
            {" kan vende den"}
          </span>
        ),
        color: "amber",
      });
    }

    // 9. Tæt på personlig rekord
    if (bestDayRecord && todayTotal > 0) {
      const recordValue = bestDayRecord.record_value;
      if (todayTotal > recordValue * 0.8 && todayTotal < recordValue) {
        const pctLeft = Math.round(((recordValue - todayTotal) / recordValue) * 100);
        result.push({
          priority: 9,
          icon: <Trophy className="h-4 w-4 text-amber-400" />,
          message: (
            <span>
              {"Du er "}
              <span className="text-amber-400 font-semibold">{pctLeft}%</span>
              {" fra din personlige rekord — push!"}
            </span>
          ),
          color: "amber",
        });
      }
    }

    // 10. Ny streak
    if (currentStreak === 0) {
      result.push({
        priority: 10,
        icon: <Rocket className="h-4 w-4 text-blue-400" />,
        message: (
          <span>
            {"Start en ny streak i dag — dit "}
            <span className="text-amber-400 font-semibold">første salg</span>
            {" tæller! 🚀"}
          </span>
        ),
        color: "blue",
      });
    }

    // Sort by priority and take top 3
    return result.sort((a, b) => a.priority - b.priority).slice(0, 3);
  }, [gamification, weeklyStats, myStanding, standings, dailyTarget, todayTotal]);

  if (signals.length === 0) return null;

  return (
    <div className="animate-fade-in rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 py-3 px-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-0 md:divide-x md:divide-white/5">
        {signals.map((signal, i) => (
          <div key={i} className="flex items-start gap-2.5 md:px-4 first:md:pl-0 last:md:pr-0">
            <div className="mt-0.5 shrink-0">{signal.icon}</div>
            <p className="text-sm text-slate-200 leading-snug">{signal.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
