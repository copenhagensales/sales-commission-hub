import { useEffect } from "react";
import { Trophy, Crown } from "lucide-react";
import confetti from "canvas-confetti";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatPlayerName } from "@/lib/formatPlayerName";
import { cn } from "@/lib/utils";

interface PodiumStanding {
  employee?: { id: string; first_name: string; last_name: string } | null;
  total_points?: number;
}

interface HallOfFamePodiumProps {
  seasonNumber: number;
  seasonId: string;
  first?: PodiumStanding;
  second?: PodiumStanding;
  third?: PodiumStanding;
  avatarMap?: Map<string, string | null>;
  onClickRank?: (rank: 1 | 2 | 3) => void;
}

const fmtNum = (n: number) =>
  Number(n).toLocaleString("da-DK", { maximumFractionDigits: 0 });

function getInitials(s: PodiumStanding | undefined) {
  if (!s?.employee) return "—";
  const f = s.employee.first_name?.[0] ?? "";
  const l = s.employee.last_name?.[0] ?? "";
  return `${f}${l}`.toUpperCase();
}

export function HallOfFamePodium({
  seasonNumber,
  seasonId,
  first,
  second,
  third,
  avatarMap,
  onClickRank,
}: HallOfFamePodiumProps) {
  // Continuous confetti while the Hall of Fame is mounted.
  // Respects prefers-reduced-motion.
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const goldSilverBronze = [
      "#fde047", "#facc15", "#eab308", "#ca8a04",
      "#fbbf24", "#f59e0b", "#fde68a", "#fef3c7",
    ];

    // Big opening burst
    confetti({
      particleCount: 220,
      spread: 100,
      startVelocity: 55,
      origin: { x: 0.5, y: 0.6 },
      colors: goldSilverBronze,
      scalar: 1.15,
      gravity: 0.9,
    });

    // Continuous side cannons
    const interval = window.setInterval(() => {
      confetti({
        particleCount: 60,
        angle: 60,
        spread: 75,
        startVelocity: 50,
        origin: { x: 0, y: 0.75 },
        colors: goldSilverBronze,
        scalar: 1.1,
        gravity: 0.9,
      });
      confetti({
        particleCount: 60,
        angle: 120,
        spread: 75,
        startVelocity: 50,
        origin: { x: 1, y: 0.75 },
        colors: goldSilverBronze,
        scalar: 1.1,
        gravity: 0.9,
      });
    }, 800);

    // Occasional center pop for extra sparkle
    const popInterval = window.setInterval(() => {
      confetti({
        particleCount: 80,
        spread: 360,
        startVelocity: 35,
        origin: { x: 0.5, y: 0.4 },
        colors: goldSilverBronze,
        scalar: 1,
        gravity: 1,
      });
    }, 2400);

    return () => {
      window.clearInterval(interval);
      window.clearInterval(popInterval);
    };
  }, [seasonId]);

  const Step = ({
    rank,
    standing,
    heightClass,
    medal,
    gradient,
    ring,
    crown,
  }: {
    rank: 1 | 2 | 3;
    standing?: PodiumStanding;
    heightClass: string;
    medal: string;
    gradient: string;
    ring: string;
    crown?: boolean;
  }) => {
    const name = standing?.employee
      ? formatPlayerName(standing.employee)
      : "Ingen vinder";
    const points = standing?.total_points
      ? `${fmtNum(Number(standing.total_points))} pt`
      : "—";
    const avatar = standing?.employee
      ? avatarMap?.get(standing.employee.id) ?? null
      : null;

    return (
      <button
        type="button"
        onClick={() => onClickRank?.(rank)}
        className="group flex flex-col items-center justify-end flex-1 min-w-0"
      >
        {/* Avatar + crown */}
        <div className="relative mb-3">
          {crown && (
            <Crown
              className="absolute -top-7 left-1/2 -translate-x-1/2 h-7 w-7 text-yellow-400 drop-shadow-[0_0_10px_rgba(234,179,8,0.6)] animate-pulse"
              fill="currentColor"
            />
          )}
          <Avatar
            className={cn(
              "transition-transform group-hover:scale-105 ring-4 shadow-2xl",
              ring,
              rank === 1 ? "h-24 w-24 sm:h-28 sm:w-28" : "h-20 w-20 sm:h-24 sm:w-24"
            )}
          >
            {avatar && <AvatarImage src={avatar} alt={name} />}
            <AvatarFallback className="bg-slate-800 text-slate-200 font-bold text-lg">
              {getInitials(standing)}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Name + points */}
        <p
          className={cn(
            "font-bold truncate max-w-[120px] sm:max-w-[160px] text-center",
            rank === 1 ? "text-base sm:text-lg" : "text-sm sm:text-base"
          )}
        >
          {name}
        </p>
        <p className="text-xs text-muted-foreground mb-3">{points}</p>

        {/* Pedestal */}
        <div
          className={cn(
            "w-full rounded-t-xl border-2 border-b-0 flex flex-col items-center justify-start pt-3 transition-all group-hover:brightness-110",
            heightClass,
            gradient
          )}
        >
          <span className="text-3xl sm:text-4xl drop-shadow-lg">{medal}</span>
          <span className="text-2xl sm:text-3xl font-extrabold text-white/90 mt-1">
            {rank}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="rounded-2xl border-2 border-yellow-500/30 bg-gradient-to-br from-amber-950/40 via-slate-900 to-purple-950/40 p-5 sm:p-8 shadow-2xl shadow-yellow-500/10 overflow-hidden relative">
      {/* Decorative glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(234,179,8,0.15),transparent_60%)] pointer-events-none" />

      {/* Header */}
      <div className="relative flex flex-col items-center text-center mb-6 sm:mb-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-yellow-500/15 px-3 py-1 ring-1 ring-yellow-500/40 mb-2">
          <Trophy className="h-4 w-4 text-yellow-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-yellow-300">
            Hall of Fame · Sæson {seasonNumber}
          </span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
          Sæsonens Mestre
        </h2>
      </div>

      {/* Podium */}
      <div className="relative flex items-end justify-center gap-3 sm:gap-6 max-w-2xl mx-auto">
        <Step
          rank={2}
          standing={second}
          heightClass="h-24 sm:h-32"
          medal="🥈"
          gradient="bg-gradient-to-b from-slate-400/30 to-slate-600/40 border-slate-400/50"
          ring="ring-slate-300/60"
        />
        <Step
          rank={1}
          standing={first}
          heightClass="h-32 sm:h-44"
          medal="🥇"
          gradient="bg-gradient-to-b from-yellow-400/40 to-amber-700/50 border-yellow-400/70"
          ring="ring-yellow-400/80"
          crown
        />
        <Step
          rank={3}
          standing={third}
          heightClass="h-20 sm:h-24"
          medal="🥉"
          gradient="bg-gradient-to-b from-amber-700/30 to-amber-900/40 border-amber-700/50"
          ring="ring-amber-600/60"
        />
      </div>
    </div>
  );
}
