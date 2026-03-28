// LeagueMotivationBar – Intelligent Coach (Dynamic)
import { useMemo } from "react";
import { Flame, Target, TrendingUp, Swords, Clock, Trophy, Rocket, Star, Sun, Zap } from "lucide-react";
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
  todayTotal: todayTotalProp,
  currentWeekTotal,
}: LeagueMotivationBarProps) {
  const { data: weeklyStats } = usePersonalWeeklyStats(employeeId);

  // Derive todayTotal from dailyBreakdown if prop is 0
  const todayFromBreakdown = weeklyStats?.dailyBreakdown?.find(d => d.isToday)?.commission ?? 0;
  const todayTotal = todayTotalProp > 0 ? todayTotalProp : todayFromBreakdown;

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
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, 5=Fri, 6=Sat
    const dateSeed = now.getDate(); // 1-31, used for daily rotation

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
            <span className="text-red-400 font-semibold">🔥 {currentStreak} dage i træk</span>
            {" – overgå gårsdagen for at holde den i live!"}
          </span>
        ),
        color: "red",
      });
    }

    // 2. Tæt på overhalning (loosened: < 5.000 kr)
    if (gapUp && gapUp.gap < 5000 && gapUp.gap > 0) {
      result.push({
        priority: 2,
        icon: <Swords className="h-4 w-4 text-amber-400" />,
        message: (
          <span>
            {"Kun "}
            <span className="text-amber-400 font-semibold">{formatKr(gapUp.gap)} kr</span>
            {` til at overhale #${gapUp.rank} – inden for rækkevidde i dag`}
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
              {" til dagens mål – du er næsten der!"}
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
            <span className="text-amber-400 font-semibold">🔥 {currentStreak} dage i træk!</span>
            {" Hold tempoet de næste timer"}
          </span>
        ),
        color: "amber",
      });
    }

    // 4b. Small streak building (1-2 days)
    if (currentStreak >= 1 && currentStreak < 3 && hitDailyGoal) {
      result.push({
        priority: 4.5,
        icon: <Flame className="h-4 w-4 text-amber-400" />,
        message: (
          <span>
            <span className="text-amber-400 font-semibold">🔥 {currentStreak}. dag med stigning!</span>
            {" Keep going – overgå i morgen også"}
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
            {" vs. forrige uge – hold tempoet de næste 2 timer 📈"}
          </span>
        ),
        color: "green",
      });
    }

    // 6. Nogen tæt bag dig (loosened: < 3.000 kr)
    if (gapDown && gapDown.gap < 3000 && gapDown.gap > 0) {
      result.push({
        priority: 6,
        icon: <Swords className="h-4 w-4 text-amber-400" />,
        message: (
          <span>
            {`#${gapDown.rank} er kun `}
            <span className="text-amber-400 font-semibold">{formatKr(gapDown.gap)} kr</span>
            {" bag dig – hold afstanden!"}
          </span>
        ),
        color: "amber",
      });
    }

    // 7. Ekstra indsats (with daily rotation)
    if (hourlyRate > 0) {
      const variant = dateSeed % 3;
      const extraMessages: React.ReactNode[] = [
        <span key="v0">
          {"Hver time ekstra ≈ "}
          <span className="text-amber-400 font-semibold">{formatKr(hourlyRate)} kr</span>
          {" · Din top-timeløn! 💪"}
        </span>,
        <span key="v1">
          {"2 gode timer i dag = +"}
          <span className="text-amber-400 font-semibold">{formatKr(hourlyRate * 2)} kr</span>
          {" i lønposen"}
        </span>,
        <span key="v2">
          {"1 ekstra time = "}
          <span className="text-amber-400 font-semibold">{formatKr(hourlyRate)} kr</span>
          {" mere – push for en stærkere uge"}
        </span>,
      ];
      // Show Saturday-specific on Fri/Sat
      if (dayOfWeek === 5 || dayOfWeek === 6) {
        extraMessages[variant % 3] = (
          <span key="sat">
            {"Lørdag = +"}
            <span className="text-amber-400 font-semibold">{formatKr(hourlyRate * 8)} kr</span>
            {" ekstra – det er det værd!"}
          </span>
        );
      }
      result.push({
        priority: 7,
        icon: <Clock className="h-4 w-4 text-blue-400" />,
        message: extraMessages[variant % extraMessages.length],
        color: "blue",
      });
    }

    // 7.5 Time-of-day signals (fallbacks)
    if (hour < 11 && todayTotal === 0) {
      result.push({
        priority: 7.5,
        icon: <Sun className="h-4 w-4 text-amber-400" />,
        message: (
          <span>
            {"God morgen! "}
            <span className="text-amber-400 font-semibold">Første salg</span>
            {" sætter tempoet for hele dagen 💪"}
          </span>
        ),
        color: "amber",
      });
    } else if (hour >= 14) {
      result.push({
        priority: 7.6,
        icon: <Zap className="h-4 w-4 text-emerald-400" />,
        message: (
          <span>
            {"Stærk finish – "}
            <span className="text-emerald-400 font-semibold">de sidste timer</span>
            {" tæller mest 🏁"}
          </span>
        ),
        color: "green",
      });
    }

    // 7.7 Day-of-week signals
    if (dayOfWeek === 1) {
      result.push({
        priority: 7.7,
        icon: <Rocket className="h-4 w-4 text-blue-400" />,
        message: (
          <span>
            <span className="text-blue-400 font-semibold">Ny uge, nyt mål</span>
            {" – sæt standarden i dag!"}
          </span>
        ),
        color: "blue",
      });
    } else if (dayOfWeek === 5) {
      result.push({
        priority: 7.8,
        icon: <Star className="h-4 w-4 text-amber-400" />,
        message: (
          <span>
            <span className="text-amber-400 font-semibold">Stærk fredag = stærk uge</span>
            {" – afslut ugen med en topdag! 🔥"}
          </span>
        ),
        color: "amber",
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
            {"Du er ikke langt fra sidste uge – "}
            <span className="text-amber-400 font-semibold">{formatKr(diff)} kr</span>
            {" kan vende den"}
          </span>
        ),
        color: "amber",
      });
    }

    // 9. Tæt på personlig rekord (loosened: > 60%)
    if (bestDayRecord && todayTotal > 0) {
      const recordValue = bestDayRecord.record_value;
      if (todayTotal > recordValue * 0.6 && todayTotal < recordValue) {
        const pctLeft = Math.round(((recordValue - todayTotal) / recordValue) * 100);
        result.push({
          priority: 9,
          icon: <Trophy className="h-4 w-4 text-amber-400" />,
          message: (
            <span>
              {"Du er "}
              <span className="text-amber-400 font-semibold">{pctLeft}%</span>
              {" fra din personlige rekord – push!"}
            </span>
          ),
          color: "amber",
        });
      }
    }

    // 10. Ny streak (with daily rotation)
    if (currentStreak === 0) {
      const streakVariant = dateSeed % 3;
      const streakMessages: { msg: React.ReactNode }[] = [
        {
          msg: (
            <span>
              {"Start en ny streak – "}
              <span className="text-amber-400 font-semibold">overgå gårsdagen</span>
              {" og sæt gang i væksten! 🚀"}
            </span>
          ),
        },
        {
          msg: (
            <span>
              {"Tjen mere end i går og "}
              <span className="text-amber-400 font-semibold">start en streak</span>
              {" – dag for dag! 💪"}
            </span>
          ),
        },
        {
          msg: (
            <span>
              <span className="text-amber-400 font-semibold">Beat yesterday</span>
              {" – overgå gårsdagen og byg momentum! 🚀"}
            </span>
          ),
        },
      ];
      result.push({
        priority: 10,
        icon: <Rocket className="h-4 w-4 text-blue-400" />,
        message: streakMessages[streakVariant].msg,
        color: "blue",
      });
    }

    // 11. Rank fallback – always available
    if (myStanding) {
      const rank = getOverallRank(myStanding);
      const totalPlayers = standings.length;
      const topPct = totalPlayers > 0 ? Math.round((rank / totalPlayers) * 100) : 0;
      const rankMsg = rank <= 3
        ? `Du er #${rank} – hold positionen! 🏆`
        : topPct <= 25
          ? `Du er #${rank} af ${totalPlayers} – du er i top 25%!`
          : `Du er #${rank} af ${totalPlayers} – kæmp dig opad!`;
      result.push({
        priority: 11,
        icon: <Star className="h-4 w-4 text-blue-400" />,
        message: (
          <span>
            <span className="text-blue-400 font-semibold">{rankMsg}</span>
          </span>
        ),
        color: "blue",
      });
    }

    // 12. Week progress fallback
    if (currentWeek > 0) {
      result.push({
        priority: 12,
        icon: <TrendingUp className="h-4 w-4 text-emerald-400" />,
        message: (
          <span>
            {"Denne uge: "}
            <span className="text-emerald-400 font-semibold">{formatKr(currentWeek)} kr</span>
            {" – bliv ved med at bygge!"}
          </span>
        ),
        color: "green",
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
