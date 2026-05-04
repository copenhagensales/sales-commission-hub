import { useMemo, useState } from "react";
import { Flame, Star, Rocket, Trophy, Users, Calendar, TrendingUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { formatPlayerName } from "@/lib/formatPlayerName";
import { useEmployeeAvatars } from "@/hooks/useEmployeeAvatars";
import { HallOfFamePodium } from "./HallOfFamePodium";
import type { PrizeLeaders } from "@/hooks/useLeaguePrizeData";

interface SeasonStanding {
  employee?: { id: string; first_name: string; last_name: string } | null;
  total_points?: number;
  total_provision?: number;
  current_division?: number;
  division_rank?: number;
  rounds_played?: number;
}

interface RoundLite {
  id: string;
  round_number: number;
  status: string;
}

interface HallOfFameProps {
  seasonId: string;
  seasonNumber: number;
  startDate?: string;
  endDate?: string;
  standings: SeasonStanding[];
  prizeLeaders: PrizeLeaders | undefined;
  rounds: RoundLite[];
}

type DialogType = "top" | "bestRound" | "talent" | "comeback" | null;

const fmtNum = (n: number) =>
  Number(n).toLocaleString("da-DK", { maximumFractionDigits: 0 });

const fmtDate = (iso?: string) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export function HallOfFame({
  seasonId,
  seasonNumber,
  startDate,
  endDate,
  standings,
  prizeLeaders,
  rounds,
}: HallOfFameProps) {
  const [dialog, setDialog] = useState<DialogType>(null);
  const { data: avatarData } = useEmployeeAvatars();
  const avatarMap = avatarData?.idToAvatarMap;

  const sortedByPoints = useMemo(
    () =>
      [...standings].sort(
        (a, b) => Number(b.total_points ?? 0) - Number(a.total_points ?? 0)
      ),
    [standings]
  );

  const top1 = sortedByPoints[0];
  const top2 = sortedByPoints[1];
  const top3 = sortedByPoints[2];

  // Division winners (rank 1 in each division)
  const divisionWinners = useMemo(() => {
    const byDiv: Record<number, SeasonStanding[]> = {};
    for (const s of standings) {
      const d = s.current_division ?? 99;
      if (!byDiv[d]) byDiv[d] = [];
      byDiv[d].push(s);
    }
    return Object.entries(byDiv)
      .map(([div, arr]) => {
        const sorted = [...arr].sort(
          (a, b) => (a.division_rank ?? 99) - (b.division_rank ?? 99)
        );
        return { division: Number(div), winner: sorted[0] };
      })
      .sort((a, b) => a.division - b.division);
  }, [standings]);

  // Summary
  const totalProvision = useMemo(
    () => standings.reduce((sum, s) => sum + Number(s.total_provision ?? 0), 0),
    [standings]
  );
  const completedRounds = rounds.filter((r) => r.status === "completed").length;
  const playerCount = standings.length;

  // Date range label
  const dateLabel =
    startDate && endDate ? `${fmtDate(startDate)} – ${fmtDate(endDate)}` : null;

  // Prize cards
  const bestRound = prizeLeaders?.bestRound;
  const talent = prizeLeaders?.talent;
  const comeback = prizeLeaders?.comeback;

  const PrizeCard = ({
    type,
    icon: Icon,
    title,
    name,
    subtitle,
    accent,
    glow,
  }: {
    type: DialogType;
    icon: typeof Flame;
    title: string;
    name: string | null;
    subtitle: string | null;
    accent: string;
    glow: string;
  }) => (
    <button
      type="button"
      onClick={() => setDialog(type)}
      className={cn(
        "group relative rounded-xl border-2 p-4 sm:p-5 text-left transition-all",
        "bg-slate-900/60 backdrop-blur",
        accent,
        "hover:scale-[1.02] hover:brightness-110",
        glow
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
        </div>
      </div>
      <p className="text-base sm:text-lg font-bold truncate">{name ?? "—"}</p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
      )}
    </button>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero podium */}
      <HallOfFamePodium
        seasonNumber={seasonNumber}
        seasonId={seasonId}
        first={top1}
        second={top2}
        third={top3}
        avatarMap={avatarMap}
        onClickRank={() => setDialog("top")}
      />

      {/* Special prizes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <PrizeCard
          type="bestRound"
          icon={Flame}
          title="Bedste Runde"
          name={bestRound ? formatPlayerName(bestRound.employee) : null}
          subtitle={bestRound ? bestRound.label : null}
          accent="border-red-500/40 text-red-400"
          glow="shadow-lg shadow-red-500/10 hover:shadow-red-500/20"
        />
        <PrizeCard
          type="talent"
          icon={Star}
          title="Sæsonens Talent"
          name={talent ? formatPlayerName(talent.employee) : null}
          subtitle={talent ? talent.label : null}
          accent="border-purple-500/40 text-purple-400"
          glow="shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20"
        />
        <PrizeCard
          type="comeback"
          icon={Rocket}
          title="Sæsonens Comeback"
          name={comeback ? formatPlayerName(comeback.employee) : null}
          subtitle={comeback ? comeback.label : null}
          accent="border-emerald-500/40 text-emerald-400"
          glow="shadow-lg shadow-emerald-500/10 hover:shadow-emerald-500/20"
        />
      </div>

      {/* Season summary strip */}
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Sæson-resumé
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <SummaryStat icon={Users} label="Spillere" value={fmtNum(playerCount)} />
          <SummaryStat icon={Calendar} label="Runder" value={`${completedRounds}`} />
          <SummaryStat
            icon={Trophy}
            label="Total provision"
            value={`${fmtNum(totalProvision)} kr`}
          />
          <SummaryStat
            icon={Calendar}
            label="Periode"
            value={dateLabel ?? "—"}
            small
          />
        </div>

        {/* Division winners */}
        {divisionWinners.length > 0 && (
          <div className="mt-5 pt-4 border-t border-slate-700">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Divisionsvindere
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {divisionWinners.map(({ division, winner }) => {
                if (!winner?.employee) return null;
                const avatar = avatarMap?.get(winner.employee.id) ?? null;
                const divLabel =
                  division === 1 ? "Superligaen" : `${division - 1}. Division`;
                return (
                  <div
                    key={division}
                    className="flex items-center gap-3 rounded-lg bg-slate-900/50 px-3 py-2 border border-slate-700/50"
                  >
                    <Avatar className="h-8 w-8 ring-1 ring-yellow-500/40">
                      {avatar && (
                        <AvatarImage
                          src={avatar}
                          alt={formatPlayerName(winner.employee)}
                        />
                      )}
                      <AvatarFallback className="bg-slate-800 text-xs">
                        {winner.employee.first_name[0]}
                        {winner.employee.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {divLabel}
                      </p>
                      <p className="text-sm font-semibold truncate">
                        {formatPlayerName(winner.employee)}
                      </p>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground">
                      {fmtNum(Number(winner.total_points ?? 0))}p
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <Dialog open={dialog === "top"} onOpenChange={(o) => !o && setDialog(null)}>
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

      <Dialog
        open={dialog === "bestRound"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>🔥 Bedste Runde</DialogTitle>
          </DialogHeader>
          <RankingTable
            rows={(prizeLeaders?.allBestRounds ?? []).map((r, i) => ({
              rank: i + 1,
              name: formatPlayerName(r.employee),
              value: `${fmtNum(r.points_earned)} kr`,
              extra:
                r.round_number === 0
                  ? "Kval"
                  : r.round_number
                  ? `Runde ${r.round_number}`
                  : undefined,
            }))}
            valueHeader="Provision"
            extraHeader="Runde"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "talent"} onOpenChange={(o) => !o && setDialog(null)}>
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
            emptyText="Ingen kvalificerede talenter"
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "comeback"}
        onOpenChange={(o) => !o && setDialog(null)}
      >
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
            emptyText="Ingen comeback-spillere"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  small,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  small?: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className={cn("font-bold", small ? "text-xs sm:text-sm" : "text-lg sm:text-xl")}>
        {value}
      </p>
    </div>
  );
}

function RankingTable({
  rows,
  valueHeader,
  extraHeader,
  emptyText = "Ingen data",
}: {
  rows: { rank: number; name: string; value: string; extra?: string }[];
  valueHeader: string;
  extraHeader?: string;
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">{emptyText}</p>
    );
  }
  return (
    <div className="max-h-80 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Navn</TableHead>
            {extraHeader && (
              <TableHead className="text-right">{extraHeader}</TableHead>
            )}
            <TableHead className="text-right">{valueHeader}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={`${row.rank}-${row.name}`}>
              <TableCell className="font-medium">
                {row.rank <= 3 ? ["🥇", "🥈", "🥉"][row.rank - 1] : row.rank}
              </TableCell>
              <TableCell className="font-medium truncate max-w-[140px]">
                {row.name}
              </TableCell>
              {extraHeader && (
                <TableCell className="text-right text-muted-foreground text-xs">
                  {row.extra}
                </TableCell>
              )}
              <TableCell className="text-right font-semibold">{row.value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
