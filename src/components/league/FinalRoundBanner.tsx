import { useEffect, useState } from "react";
import { Trophy, Flame, Clock } from "lucide-react";

interface FinalRoundBannerProps {
  endDate: string;
  multiplier: number;
  roundNumber: number;
}

function formatTimeLeft(ms: number) {
  if (ms <= 0) return "0d 0t 0m";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}t ${minutes}m`;
  if (hours > 0) return `${hours}t ${minutes}m`;
  return `${minutes}m`;
}

export function FinalRoundBanner({ endDate, multiplier, roundNumber }: FinalRoundBannerProps) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const ms = new Date(endDate).getTime() - Date.now();
      setTimeLeft(formatTimeLeft(ms));
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [endDate]);

  return (
    <div className="relative overflow-hidden rounded-xl border-2 border-amber-500/40 bg-gradient-to-br from-amber-950 via-red-950 to-amber-950 p-4 sm:p-6 shadow-lg shadow-amber-500/10">
      {/* Animated glow background */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute -top-20 -left-20 h-64 w-64 rounded-full bg-amber-500 blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full bg-red-500 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      {/* Subtle scanline shimmer */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(110deg, transparent 30%, hsl(45 100% 70% / 0.4) 50%, transparent 70%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 3s linear infinite",
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-red-600 shadow-lg shadow-amber-500/40">
            <Trophy className="h-7 w-7 text-amber-50" />
            <Flame className="absolute -top-1 -right-1 h-5 w-5 text-amber-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/40">
                Finale
              </span>
              <span className="text-[10px] uppercase tracking-wider text-amber-200/70">
                Runde {roundNumber}
              </span>
            </div>
            <h2 className="mt-1 text-xl sm:text-2xl font-extrabold text-amber-50 tracking-tight">
              Sidste runde — sidste chance
            </h2>
            <p className="text-xs sm:text-sm text-amber-200/80">
              Point i denne runde tæller{" "}
              <span className="font-bold text-amber-100">×{multiplier}</span>. Hver salg kan flytte podiet.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1 rounded-lg bg-black/30 px-4 py-3 ring-1 ring-amber-500/30">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-300/80">
            <Clock className="h-3 w-3" />
            Slutter om
          </div>
          <div className="text-2xl font-bold tabular-nums text-amber-100">{timeLeft}</div>
        </div>
      </div>
    </div>
  );
}
