import { useState } from "react";
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

type DialogType = "top3" | "bestRound" | "talent" | "comeback" | null;

const fmtNum = (n: number) => Number(n).toLocaleString("da-DK", { maximumFractionDigits: 0 });

export function PrizeShowcase({ standings, prizeLeaders, seasonStatus, isActive }: PrizeShowcaseProps) {
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
  const revealed = isActive && prizeLeaders;

  const podium = [
    { emoji: "🥇", label: "1.", standing: top1, colorClass: "text-yellow-400" },
    { emoji: "🥈", label: "2.", standing: top2, colorClass: "text-slate-300" },
    { emoji: "🥉", label: "3.", standing: top3, colorClass: "text-amber-600" },
  ];

  const handleOpen = (type: DialogType) => {
    if (isActive) setOpenDialog(type);
  };

  return (
    <div className="space-y-3">
      {/* Top 3 – combined podium card */}
      <button
        type="button"
        className="w-full text-left rounded-xl bg-slate-800/80 border-2 border-yellow-500/50 p-5 transition-colors hover:bg-slate-700/80 cursor-pointer disabled:cursor-default disabled:hover:bg-slate-800/80"
        disabled={!isActive}
        onClick={() => handleOpen("top3")}
      >
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
      </button>

      {/* Special prizes */}
      <div className="grid grid-cols-3 gap-3">
        {([
          {
            type: "bestRound" as const,
            emoji: "🔥",
            title: "Bedste Runde",
            playerName: revealed && prizeLeaders.bestRound ? formatPlayerName(prizeLeaders.bestRound.employee) : pendingText,
            subtitle: revealed && prizeLeaders.bestRound ? prizeLeaders.bestRound.label : "",
            borderClass: "border-red-500/50",
          },
          {
            type: "talent" as const,
            emoji: "⭐",
            title: "Sæsonens Talent",
            playerName: revealed && prizeLeaders.talent ? formatPlayerName(prizeLeaders.talent.employee) : pendingText,
            subtitle: revealed && prizeLeaders.talent ? prizeLeaders.talent.label : "",
            borderClass: "border-purple-500/50",
          },
          {
            type: "comeback" as const,
            emoji: "🚀",
            title: "Sæsonens Comeback",
            playerName: revealed && prizeLeaders.comeback ? formatPlayerName(prizeLeaders.comeback.employee) : pendingText,
            subtitle: revealed && prizeLeaders.comeback ? prizeLeaders.comeback.label : "",
            borderClass: "border-emerald-500/50",
          },
        ]).map((card) => (
          <button
            key={card.title}
            type="button"
            className={`relative rounded-xl bg-slate-800/80 p-4 border-2 ${card.borderClass} text-center space-y-1 transition-colors hover:bg-slate-700/80 cursor-pointer disabled:cursor-default disabled:hover:bg-slate-800/80`}
            disabled={!isActive}
            onClick={() => handleOpen(card.type)}
          >
            <span className="text-2xl">{card.emoji}</span>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.title}</p>
            <p className="text-sm font-bold truncate">{card.playerName}</p>
            <p className="text-xs text-muted-foreground">{card.subtitle}</p>
          </button>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Afgøres ved sæsonens afslutning
      </p>

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
              value: `${fmtNum(r.points_earned)} pt`,
              extra: r.round_number ? `Runde ${r.round_number}` : undefined,
            }))}
            valueHeader="Point"
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
