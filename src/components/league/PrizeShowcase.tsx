import { formatPlayerName } from "@/lib/formatPlayerName";
import type { PrizeLeaders } from "@/hooks/useLeaguePrizeData";

interface Standing {
  overall_rank?: number;
  employee?: { id: string; first_name: string; last_name: string } | null;
  total_points?: number;
  current_provision?: number;
  projected_division?: number;
  projected_rank?: number;
}

interface PrizeShowcaseProps {
  standings: Standing[];
  prizeLeaders: PrizeLeaders | undefined;
  seasonStatus: string;
  isActive: boolean;
}

export function PrizeShowcase({ standings, prizeLeaders, seasonStatus, isActive }: PrizeShowcaseProps) {
  const notStarted = !isActive;

  const sorted = [...standings].sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0));
  const top1 = sorted[0];
  const top2 = sorted[1];
  const top3 = sorted[2];

  const pointLabel = (s: Standing | undefined) => {
    if (!s || !s.total_points) return "";
    return `${Number(s.total_points).toLocaleString("da-DK", { maximumFractionDigits: 0 })} pt`;
  };

  const pendingText = notStarted ? "Afgøres når sæsonen starter" : "Afsløres efter runde 1";
  const revealed = isActive && prizeLeaders;

  const podium = [
    { emoji: "🥇", label: "1.", standing: top1, colorClass: "text-yellow-400" },
    { emoji: "🥈", label: "2.", standing: top2, colorClass: "text-slate-300" },
    { emoji: "🥉", label: "3.", standing: top3, colorClass: "text-amber-600" },
  ];

  return (
    <div className="space-y-3">
      {/* Top 3 – combined podium card */}
      <div className="rounded-xl bg-slate-800/80 border-2 border-yellow-500/50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center mb-4">
          🏆 Top 3
        </p>
        {notStarted ? (
          <p className="text-sm text-muted-foreground text-center">{pendingText}</p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {podium.map((p) => (
              <div key={p.label} className="text-center space-y-1">
                <span className="text-2xl">{p.emoji}</span>
                <p className={`text-base font-bold truncate ${p.colorClass}`}>
                  {p.standing ? formatPlayerName(p.standing.employee) : "—"}
                </p>
                <p className="text-xs text-muted-foreground">{pointLabel(p.standing)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Special prizes */}
      <div className="grid grid-cols-3 gap-3">
        {([
          {
            emoji: "🔥",
            title: "Bedste Runde",
            playerName: revealed && prizeLeaders.bestRound ? formatPlayerName(prizeLeaders.bestRound.employee) : pendingText,
            subtitle: revealed && prizeLeaders.bestRound ? prizeLeaders.bestRound.label : "",
            borderClass: "border-red-500/50",
          },
          {
            emoji: "⭐",
            title: "Sæsonens Talent",
            playerName: revealed && prizeLeaders.talent ? formatPlayerName(prizeLeaders.talent.employee) : pendingText,
            subtitle: revealed && prizeLeaders.talent ? prizeLeaders.talent.label : "",
            borderClass: "border-purple-500/50",
          },
          {
            emoji: "🚀",
            title: "Sæsonens Comeback",
            playerName: revealed && prizeLeaders.comeback ? formatPlayerName(prizeLeaders.comeback.employee) : pendingText,
            subtitle: revealed && prizeLeaders.comeback ? prizeLeaders.comeback.label : "",
            borderClass: "border-emerald-500/50",
          },
        ]).map((card) => (
          <div key={card.title} className={`relative rounded-xl bg-slate-800/80 p-4 border-2 ${card.borderClass} text-center space-y-1`}>
            <span className="text-2xl">{card.emoji}</span>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.title}</p>
            <p className="text-sm font-bold truncate">{card.playerName}</p>
            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Afgøres ved sæsonens afslutning
      </p>
    </div>
  );
}
