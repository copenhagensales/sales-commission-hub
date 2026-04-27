import { useState } from "react";
import { Lock } from "lucide-react";
import { formatPlayerName } from "@/lib/formatPlayerName";
import type { PrizeLeaders, RankedPlayer, RankedRound, RankedComeback } from "@/hooks/useLeaguePrizeData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

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
  roundProvisionMap?: Record<string, number>;
}

type DialogType = "top3" | "bestRound" | "talent" | "comeback" | null;

const fmtNum = (n: number) => Number(n).toLocaleString("da-DK", { maximumFractionDigits: 0 });

export function PrizeShowcase({ standings, prizeLeaders, seasonStatus, isActive, roundProvisionMap }: PrizeShowcaseProps) {
  const [openDialog, setOpenDialog] = useState<DialogType>(null);
  const notStarted = !isActive;

  const sorted = [...standings].sort((a, b) => (b.total_points ?? 0) - (a.total_points ?? 0));
  const top1 = sorted[0];
  const top2 = sorted[1];
  const top3 = sorted[2];

  const pointLabel = (s: Standing | undefined) => {
    if (!s || !s.total_points) return "";
    return `${fmtNum(s.total_points)} pt`;
  };

  const pendingText = notStarted ? "Afgøres når sæsonen starter" : "Afsløres efter runde 1";
  const revealed = prizeLeaders != null;

  // Compute live best round leader from roundProvisionMap
  const liveBestRound = (() => {
    if (!isActive || !roundProvisionMap || Object.keys(roundProvisionMap).length === 0) return null;
    let bestId = "";
    let bestVal = 0;
    for (const [empId, val] of Object.entries(roundProvisionMap)) {
      if (val > bestVal) { bestId = empId; bestVal = val; }
    }
    if (!bestId || bestVal <= 0) return null;
    const standing = standings.find(s => s.employee?.id === bestId);
    return {
      employee: standing?.employee ?? null,
      value: bestVal,
      label: `${fmtNum(bestVal)} kr (foreløbig)`,
    };
  })();

  // Compute live comeback leader from roundProvisionMap vs kval rank (overall_rank in standings)
  const liveComeback = (() => {
    if (!isActive || !roundProvisionMap || Object.keys(roundProvisionMap).length === 0) return null;
    // Build live ranking by sorting enrolled players by round provision desc
    const enrolled = standings
      .filter(s => s.employee?.id)
      .map(s => ({
        employee: s.employee!,
        kvalRank: s.overall_rank ?? 999,
        roundProvision: roundProvisionMap[s.employee!.id] ?? 0,
      }));
    // Sort by round provision desc to get live rank
    const sorted = [...enrolled].sort((a, b) => b.roundProvision - a.roundProvision);
    let bestImprovement = 0;
    let bestEmployee: Standing["employee"] = null;
    sorted.forEach((entry, idx) => {
      const liveRank = idx + 1;
      const improvement = entry.kvalRank - liveRank;
      if (improvement > bestImprovement && entry.roundProvision > 0) {
        bestImprovement = improvement;
        bestEmployee = entry.employee;
      }
    });
    if (bestImprovement <= 0 || !bestEmployee) return null;
    return {
      employee: bestEmployee,
      value: bestImprovement,
      label: `+${bestImprovement} pladser (foreløbig)`,
    };
  })();

  // Determine displayed best round: prefer finalized, then live
  const displayBestRound = revealed && prizeLeaders.bestRound ? prizeLeaders.bestRound : liveBestRound;
  const displayComeback = revealed && prizeLeaders.comeback ? prizeLeaders.comeback : liveComeback;

  const podium = [
    { emoji: "🥇", label: "1.", standing: top1, colorClass: "text-yellow-400" },
    { emoji: "🥈", label: "2.", standing: top2, colorClass: "text-slate-300" },
    { emoji: "🥉", label: "3.", standing: top3, colorClass: "text-amber-600" },
  ];

  const handleOpen = (type: DialogType) => {
    setOpenDialog(type);
  };

  return (
    <div className="space-y-3">
      {/* Top 3 – combined podium card with shimmer */}
      <button
        type="button"
        className={cn(
          "w-full text-left rounded-xl p-5 transition-all cursor-pointer disabled:cursor-default",
          "border-2 border-yellow-500/40",
          notStarted
            ? "bg-slate-800/60 shimmer-card"
            : "bg-gradient-to-br from-yellow-500/10 via-slate-800/80 to-amber-900/10 shimmer-card hover:border-yellow-500/60 hover:scale-[1.01]",
          "disabled:hover:scale-100 disabled:hover:border-yellow-500/40"
        )}
        disabled={!isActive}
        onClick={() => handleOpen("top3")}
      >
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center mb-4">
          🏆 Top 3
        </p>
        {notStarted ? (
          <div className="flex flex-col items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground text-center">{pendingText}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {podium.map((p) => (
              <div key={p.label} className="text-center space-y-1">
                <span className="text-2xl">{p.emoji}</span>
                <p className={`text-base font-bold truncate ${p.colorClass}`}>
                  {p.standing ? formatPlayerName(p.standing.employee) : "–"}
                </p>
                <p className="text-xs text-muted-foreground">{pointLabel(p.standing)}</p>
              </div>
            ))}
          </div>
        )}
      </button>

      {/* Special prizes */}
      <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:gap-3 sm:overflow-visible sm:pb-0 snap-x snap-mandatory scrollbar-hide">
        {([
          {
            type: "bestRound" as const,
            emoji: "🔥",
            title: "Bedste Runde",
            playerName: displayBestRound ? formatPlayerName(displayBestRound.employee) : pendingText,
            subtitle: displayBestRound ? displayBestRound.label : "",
            borderClass: "border-red-500/40 hover:border-red-500/60",
            gradientClass: "from-red-500/5 to-transparent",
          },
          {
            type: "talent" as const,
            emoji: "⭐",
            title: "Sæsonens Talent",
            playerName: revealed && prizeLeaders.talent ? formatPlayerName(prizeLeaders.talent.employee) : pendingText,
            subtitle: revealed && prizeLeaders.talent ? prizeLeaders.talent.label : "",
            borderClass: "border-purple-500/40 hover:border-purple-500/60",
            gradientClass: "from-purple-500/5 to-transparent",
          },
          {
            type: "comeback" as const,
            emoji: "🚀",
            title: "Sæsonens Comeback",
            playerName: displayComeback ? formatPlayerName(displayComeback.employee) : pendingText,
            subtitle: displayComeback ? displayComeback.label : "",
            borderClass: "border-emerald-500/40 hover:border-emerald-500/60",
            gradientClass: "from-emerald-500/5 to-transparent",
          },
        ]).map((card) => (
          <button
            key={card.title}
            type="button"
            className={cn(
              "relative rounded-xl p-3 sm:p-4 border-2 text-center space-y-1 transition-all cursor-pointer",
              "hover:scale-[1.03] disabled:hover:scale-100",
              `bg-gradient-to-b ${card.gradientClass} bg-slate-800/80`,
              card.borderClass,
              "disabled:cursor-default disabled:opacity-80",
              "min-w-[140px] sm:min-w-0 snap-center flex-shrink-0 sm:flex-shrink"
            )}
            disabled={!isActive}
            onClick={() => handleOpen(card.type)}
          >
            {notStarted && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/30 backdrop-blur-[1px] z-10">
                <Lock className="h-4 w-4 text-muted-foreground/40" />
              </div>
            )}
            <span className="text-xl sm:text-2xl">{card.emoji}</span>
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.title}</p>
            <p className="text-xs sm:text-sm font-bold truncate">{card.playerName}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{card.subtitle}</p>
          </button>
        ))}
      </div>


      {/* Dialogs */}
      <Dialog open={openDialog === "top3"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🏆 Samlet Rangering</DialogTitle>
          </DialogHeader>
          <RankingTable
            rows={(prizeLeaders?.allByPoints ?? []).map((p, i) => ({
              rank: i + 1,
              name: formatPlayerName(p.employee),
              value: `${fmtNum(p.total_points)} pt`,
            }))}
            valueHeader="Point"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "bestRound"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔥 Bedste Runde</DialogTitle>
          </DialogHeader>
          <RankingTable
            rows={(prizeLeaders?.allBestRounds ?? []).map((r, i) => ({
              rank: i + 1,
              name: formatPlayerName(r.employee),
              value: `${fmtNum(r.points_earned)} kr`,
              extra: r.round_number === 0 ? "Kval" : r.round_number ? `Runde ${r.round_number}` : undefined,
            }))}
            valueHeader="Provision"
            extraHeader="Runde"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "talent"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>⭐ Sæsonens Talent</DialogTitle>
          </DialogHeader>
          <RankingTable
            rows={(prizeLeaders?.allTalents ?? []).map((p, i) => ({
              rank: i + 1,
              name: formatPlayerName(p.employee),
              value: `${fmtNum(p.total_points)} pt`,
            }))}
            valueHeader="Point"
            emptyText="Ingen kvalificerede talenter endnu"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={openDialog === "comeback"} onOpenChange={(open) => !open && setOpenDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🚀 Sæsonens Comeback</DialogTitle>
          </DialogHeader>
          <RankingTable
            rows={(prizeLeaders?.allComebacks ?? []).map((c, i) => ({
              rank: i + 1,
              name: formatPlayerName(c.employee),
              value: `+${c.improvement} pladser`,
            }))}
            valueHeader="Stigning"
            emptyText="Ingen comeback-spillere endnu"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RankingTable({
  rows,
  valueHeader,
  extraHeader,
  emptyText = "Ingen data endnu",
}: {
  rows: { rank: number; name: string; value: string; extra?: string }[];
  valueHeader: string;
  extraHeader?: string;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-4">{emptyText}</p>;
  }

  return (
    <div className="max-h-80 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Navn</TableHead>
            {extraHeader && <TableHead className="text-right">{extraHeader}</TableHead>}
            <TableHead className="text-right">{valueHeader}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.rank}-${row.name}`}>
              <TableCell className="font-medium">
                {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}
              </TableCell>
              <TableCell className="font-medium truncate max-w-[140px]">{row.name}</TableCell>
              {extraHeader && <TableCell className="text-right text-muted-foreground text-xs">{row.extra}</TableCell>}
              <TableCell className="text-right font-semibold">{row.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
