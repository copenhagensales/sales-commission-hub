import { formatPlayerName } from "@/lib/formatPlayerName";
import type { PrizeLeaders } from "@/hooks/useLeaguePrizeData";

interface PrizeCardProps {
  emoji: string;
  title: string;
  playerName: string;
  subtitle: string;
  borderClass: string;
}

function PrizeCard({ emoji, title, playerName, subtitle, borderClass }: PrizeCardProps) {
  return (
    <div className={`relative rounded-xl bg-slate-800/80 p-4 border-2 ${borderClass} text-center space-y-1`}>
      <span className="text-2xl">{emoji}</span>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="text-sm font-bold truncate">{playerName}</p>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  );
}

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
  // Top 3 from standings (sorted by overall_rank)
  const sorted = [...standings].sort((a, b) => (a.overall_rank ?? 999) - (b.overall_rank ?? 999));
  const top1 = sorted[0];
  const top2 = sorted[1];
  const top3 = sorted[2];

  const pointLabel = (s: Standing | undefined) => {
    if (!s) return "";
    if (isActive && s.total_points != null) return `${Number(s.total_points).toLocaleString("da-DK", { maximumFractionDigits: 0 })} pt`;
    if (!isActive && s.current_provision != null) return `${Number(s.current_provision).toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr`;
    return "";
  };

  const revealed = isActive && prizeLeaders;
  const pendingText = "Afsløres efter runde 1";

  const cards: PrizeCardProps[] = [
    {
      emoji: "🥇",
      title: "Nummer 1",
      playerName: top1 ? formatPlayerName(top1.employee) : "—",
      subtitle: pointLabel(top1),
      borderClass: "border-yellow-500/60",
    },
    {
      emoji: "🥈",
      title: "Nummer 2",
      playerName: top2 ? formatPlayerName(top2.employee) : "—",
      subtitle: pointLabel(top2),
      borderClass: "border-slate-400/60",
    },
    {
      emoji: "🥉",
      title: "Nummer 3",
      playerName: top3 ? formatPlayerName(top3.employee) : "—",
      subtitle: pointLabel(top3),
      borderClass: "border-amber-700/60",
    },
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
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((card) => (
          <PrizeCard key={card.title} {...card} />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Afgøres ved sæsonens afslutning
      </p>
    </div>
  );
}
