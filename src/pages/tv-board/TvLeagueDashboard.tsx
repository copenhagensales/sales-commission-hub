import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, TrendingUp, TrendingDown, Trophy, Flame, Zap, BarChart3, Lock } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { isTvMode } from "@/utils/tvMode";

// ─── Types ────────────────────────────────────────────────────
interface PlayerEntry {
  rank: number;
  name: string;
  provision: number;
  division?: number;
  teamName?: string;
  employeeId?: string;
  deals?: number;
  rankChange?: number;
  zone?: "promotion" | "relegation" | "safe" | "top" | "playoff";
}

interface Movement {
  name: string;
  division: number;
  previousRank: number;
  currentRank: number;
  change: number;
  provision: number;
}

interface DivisionData {
  division: number;
  totalPlayers: number;
  players: PlayerEntry[];
}

interface PrizeLeader {
  name: string;
  employeeId: string;
  label: string;
  points?: number;
  improvement?: number;
}

interface LeaguePayload {
  seasonId: string;
  seasonStatus: string;
  totalPlayers: number;
  totalDivisions: number;
  top3: PlayerEntry[];
  divisions: DivisionData[];
  movements: { risers: Movement[]; fallers: Movement[] };
  topLastHour: { name: string; provision: number; sales: number }[];
  recentEarners: { name: string; provision: number }[];
  records: {
    highestProvision: number;
    highestProvisionName: string;
    divisionAverages: { division: number; average: number; playerCount: number }[];
  };
  prizeLeaders: {
    bestRound: PrizeLeader | null;
    talent: PrizeLeader | null;
    comeback: PrizeLeader | null;
  } | null;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────
function getDivisionName(divNum: number): string {
  if (divNum === 1) return "Superligaen";
  return `${divNum - 1}. Division`;
}

function formatKr(value: number): string {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(value);
}

function formatPt(value: number): string {
  return `${Math.round(value)} pt`;
}

const DIVISION_DISPLAY_DURATION = 15_000;
const LEFT_SCENE_DURATIONS = [15_000, 20_000, 20_000]; // overview, movements, records
const REFRESH_INTERVAL = 30_000;

// ─── Fetch Hook ───────────────────────────────────────────────
function useLeagueTvData() {
  return useQuery<LeaguePayload>({
    queryKey: ["tv-league-data"],
    queryFn: async () => {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const url = `https://${projectId}.supabase.co/functions/v1/tv-league-data`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${anonKey}`, "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to fetch league data");
      return res.json();
    },
    refetchInterval: REFRESH_INTERVAL,
    staleTime: REFRESH_INTERVAL - 5000,
  });
}

// ─── Left Scene Rotation ──────────────────────────────────────
type LeftScene = "overview" | "movements" | "records";
const LEFT_SCENES: LeftScene[] = ["overview", "movements", "records"];

// ─── Sub-components ───────────────────────────────────────────

function PodiumCard({ player, rank, isPoints }: { player: PlayerEntry; rank: number; isPoints: boolean }) {
  const config: Record<number, { emoji: string; glow: string; size: string; border: string }> = {
    1: { emoji: "🥇", glow: "shadow-[0_0_40px_rgba(234,179,8,0.4)]", size: "text-3xl 2xl:text-5xl", border: "border-yellow-500/40" },
    2: { emoji: "🥈", glow: "shadow-[0_0_30px_rgba(148,163,184,0.3)]", size: "text-2xl 2xl:text-4xl", border: "border-slate-400/40" },
    3: { emoji: "🥉", glow: "shadow-[0_0_30px_rgba(234,88,12,0.3)]", size: "text-2xl 2xl:text-4xl", border: "border-orange-500/40" },
  };
  const c = config[rank] || config[3];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.15, duration: 0.5 }}
      className={`flex items-center gap-2 2xl:gap-4 p-2 2xl:p-4 rounded-2xl bg-slate-800/60 border ${c.border} ${c.glow} backdrop-blur-sm`}
    >
      <span className={c.size}>{c.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm 2xl:text-xl truncate">{player.name}</p>
        <p className="text-slate-400 text-xs 2xl:text-sm truncate">{getDivisionName(player.division || 1)} · {player.teamName}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-base 2xl:text-2xl font-black text-white tabular-nums">
          {isPoints ? formatPt(player.provision) : formatKr(player.provision)}
        </p>
      </div>
    </motion.div>
  );
}

function PrizeCard({
  emoji,
  title,
  leader,
  locked,
  lockedText,
  borderClass,
  gradientClass,
}: {
  emoji: string;
  title: string;
  leader: PrizeLeader | null;
  locked: boolean;
  lockedText: string;
  borderClass: string;
  gradientClass: string;
}) {
  return (
    <div
      className={`relative rounded-xl p-2 2xl:p-3 border-2 text-center space-y-0.5 2xl:space-y-1 bg-gradient-to-b ${gradientClass} bg-slate-800/80 ${borderClass}`}
    >
      {locked && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/40 backdrop-blur-[1px] z-10">
          <Lock className="h-3 w-3 2xl:h-4 2xl:w-4 text-slate-500" />
        </div>
      )}
      <span className="text-lg 2xl:text-2xl">{emoji}</span>
      <p className="text-[8px] 2xl:text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {locked ? (
        <p className="text-[10px] 2xl:text-xs text-slate-500">{lockedText}</p>
      ) : leader ? (
        <>
          <p className="text-xs 2xl:text-sm font-bold text-white truncate">{leader.name}</p>
          <p className="text-[10px] 2xl:text-xs text-slate-400">{leader.label}</p>
        </>
      ) : (
        <p className="text-[10px] 2xl:text-xs text-slate-500">Ingen data endnu</p>
      )}
    </div>
  );
}

function TickerFeed({ earners }: { earners: { name: string; provision: number }[] }) {
  if (earners.length === 0) {
    return (
      <div className="text-slate-500 text-center py-4 text-sm italic">
        Ingen sælgere med 300+ kr siden sidste opdatering
      </div>
    );
  }

  return (
    <div className="space-y-1.5 2xl:space-y-2 overflow-hidden max-h-[140px] 2xl:max-h-[220px]">
      <AnimatePresence mode="popLayout">
        {earners.map((e, i) => (
          <motion.div
            key={`${e.name}-${i}`}
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Flame className="h-4 w-4 text-orange-400 shrink-0" />
              <span className="text-white text-sm font-medium truncate">{e.name}</span>
            </div>
            <span className="text-emerald-400 font-bold text-sm tabular-nums whitespace-nowrap">
              +{formatKr(e.provision)}
            </span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Scene A: Division Highlights (rotates through divisions)
function SceneDivisions({ divisions }: { divisions: DivisionData[] }) {
  const [divIndex, setDivIndex] = useState(0);

  useEffect(() => {
    if (divisions.length <= 1) return;
    const timer = setInterval(() => {
      setDivIndex((prev) => (prev + 1) % divisions.length);
    }, DIVISION_DISPLAY_DURATION);
    return () => clearInterval(timer);
  }, [divisions.length]);

  const div = divisions[divIndex];
  if (!div) return null;

  const zoneColors: Record<string, string> = {
    promotion: "text-emerald-400",
    top: "text-yellow-300",
    playoff: "text-orange-400",
    relegation: "text-red-400",
    safe: "text-slate-300",
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2 2xl:mb-4">
        <div>
          <h2 className="text-xl 2xl:text-3xl font-black text-white flex items-center gap-2">
            {div.division === 1 && <Trophy className="h-5 w-5 2xl:h-7 2xl:w-7 text-yellow-400" />}
            {getDivisionName(div.division)}
          </h2>
          <p className="text-slate-400 text-xs 2xl:text-sm">{div.totalPlayers} spillere</p>
        </div>
        <div className="flex gap-1">
          {divisions.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${i === divIndex ? "bg-white" : "bg-slate-600"}`}
            />
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={divIndex}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.4 }}
            className="space-y-1 2xl:space-y-1.5 h-full overflow-y-auto pr-1"
          >
            {div.players.map((p, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 2xl:gap-3 px-2 2xl:px-3 py-1.5 2xl:py-2 rounded-xl bg-slate-800/50 border border-slate-700/50 ${
                  p.rank === 1 ? "border-l-2 border-l-yellow-400" :
                  p.rank === 2 ? "border-l-2 border-l-slate-300" :
                  p.rank === 3 ? "border-l-2 border-l-orange-400" :
                  p.zone === "promotion" ? "border-l-2 border-l-emerald-500" :
                  p.zone === "playoff" ? "border-l-2 border-l-orange-500" :
                  p.zone === "relegation" ? "border-l-2 border-l-red-500" :
                  p.zone === "top" ? "border-l-2 border-l-yellow-500" : ""
                }`}
              >
                <span className={`text-sm 2xl:text-lg font-black w-6 2xl:w-7 text-center tabular-nums shrink-0 ${
                  p.rank === 1 ? "text-yellow-400" : p.rank === 2 ? "text-slate-300" : p.rank === 3 ? "text-orange-400" : "text-slate-500"
                }`}>
                  {p.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs 2xl:text-base font-bold truncate ${zoneColors[p.zone || "safe"]}`}>{p.name}</p>
                </div>
                {/* Rank change */}
                <div className="w-12 2xl:w-16 text-center shrink-0">
                  {p.rankChange != null && p.rankChange !== 0 ? (
                    <span className={`text-[10px] 2xl:text-xs font-bold ${p.rankChange > 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {p.rankChange > 0 ? (
                        <span className="flex items-center justify-center gap-0.5">
                          <TrendingUp className="h-3 w-3" /> +{p.rankChange}
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-0.5">
                          <TrendingDown className="h-3 w-3" /> {p.rankChange}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-[10px] 2xl:text-xs text-slate-600">–</span>
                  )}
                </div>
                <div className="text-right shrink-0 flex items-center gap-1 2xl:gap-2">
                  <div>
                    <p className="text-xs 2xl:text-sm font-bold text-white tabular-nums">{formatKr(p.provision)}</p>
                    <p className="text-[9px] 2xl:text-[10px] text-slate-500">{p.deals} deals</p>
                  </div>
                  {p.zone && p.zone !== "safe" && (
                    <span className={`text-[8px] 2xl:text-[9px] font-bold uppercase px-1 2xl:px-1.5 py-0.5 rounded whitespace-nowrap ${
                      p.zone === "top" ? "bg-yellow-500/20 text-yellow-300" :
                      p.zone === "promotion" ? "bg-emerald-500/20 text-emerald-400" :
                      p.zone === "playoff" ? "bg-orange-500/20 text-orange-400" :
                      p.zone === "relegation" ? "bg-red-500/20 text-red-400" : ""
                    }`}>
                      {p.zone === "top" ? "Top 3" :
                       p.zone === "promotion" ? "Oprykker" :
                       p.zone === "playoff" ? "Playoff" :
                       p.zone === "relegation" ? "Nedrykker" : ""}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-2 2xl:mt-3 flex flex-wrap gap-x-3 2xl:gap-x-4 gap-y-1 text-[10px] 2xl:text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" /> Top 3 samlet
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Oprykningszone (1-3)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500" /> Playoff (4-5 / 10-11)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" /> Nedrykningszone (13-14)
        </span>
      </div>
    </div>
  );
}

// Scene B: Movements + Top last hour
function SceneMovements({
  movements,
  topLastHour,
}: {
  movements: { risers: Movement[]; fallers: Movement[] };
  topLastHour: { name: string; provision: number; sales: number }[];
}) {
  return (
    <div className="h-full flex flex-col gap-3 2xl:gap-6 overflow-y-auto">
      <div>
        <h2 className="text-xl 2xl:text-3xl font-black text-white mb-2 2xl:mb-4">Dagens bevægelser</h2>
        <div className="grid grid-cols-2 gap-2 2xl:gap-4">
          <div>
            <h3 className="text-xs 2xl:text-sm font-medium text-emerald-400 mb-2 2xl:mb-3 flex items-center gap-2">
              <TrendingUp className="h-3 w-3 2xl:h-4 2xl:w-4" /> Største spring op
            </h3>
            <div className="space-y-1.5 2xl:space-y-2">
              {movements.risers.slice(0, 3).map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-2 2xl:gap-3 px-2 2xl:px-3 py-1.5 2xl:py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20"
                >
                  <span className="text-emerald-400 font-black text-sm 2xl:text-lg">🚀</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate text-xs 2xl:text-sm">{m.name}</p>
                    <p className="text-emerald-400 text-[10px] 2xl:text-xs">+{m.change} pladser</p>
                  </div>
                  <span className="text-slate-400 text-[10px] 2xl:text-xs">#{m.currentRank}</span>
                </motion.div>
              ))}
              {movements.risers.length === 0 && (
                <p className="text-slate-600 text-xs 2xl:text-sm italic">Ingen bevægelser endnu</p>
              )}
            </div>
          </div>
          <div>
            <h3 className="text-xs 2xl:text-sm font-medium text-red-400 mb-2 2xl:mb-3 flex items-center gap-2">
              <TrendingDown className="h-3 w-3 2xl:h-4 2xl:w-4" /> Største fald
            </h3>
            <div className="space-y-1.5 2xl:space-y-2">
              {movements.fallers.slice(0, 3).map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-2 2xl:gap-3 px-2 2xl:px-3 py-1.5 2xl:py-2 rounded-lg bg-red-500/10 border border-red-500/20"
                >
                  <span className="text-red-400 font-black text-sm 2xl:text-lg">📉</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate text-xs 2xl:text-sm">{m.name}</p>
                    <p className="text-red-400 text-[10px] 2xl:text-xs">{m.change} pladser</p>
                  </div>
                  <span className="text-slate-400 text-[10px] 2xl:text-xs">#{m.currentRank}</span>
                </motion.div>
              ))}
              {movements.fallers.length === 0 && (
                <p className="text-slate-600 text-xs 2xl:text-sm italic">Ingen bevægelser endnu</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-xs 2xl:text-sm font-medium text-amber-400 mb-2 2xl:mb-3 flex items-center gap-2">
          <Zap className="h-3 w-3 2xl:h-4 2xl:w-4" /> Mest tjent sidste time
        </h3>
        <div className="space-y-1.5 2xl:space-y-2">
          {topLastHour.map((e, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-2 2xl:gap-3 px-2 2xl:px-3 py-1.5 2xl:py-2 rounded-lg bg-amber-500/10 border border-amber-500/20"
            >
              <span className="text-sm 2xl:text-lg">{i === 0 ? "⚡" : i === 1 ? "🔥" : "💫"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate text-xs 2xl:text-sm">{e.name}</p>
                <p className="text-amber-400/70 text-[10px] 2xl:text-xs">{e.sales} salg</p>
              </div>
              <span className="text-amber-400 font-bold tabular-nums text-xs 2xl:text-sm">{formatKr(e.provision)}</span>
            </motion.div>
          ))}
          {topLastHour.length === 0 && (
            <p className="text-slate-600 text-xs 2xl:text-sm italic">Ingen salg den seneste time</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Scene C: Records
function SceneRecords({ records }: { records: LeaguePayload["records"] }) {
  const maxAvg = Math.max(...records.divisionAverages.map((d) => d.average), 1);

  return (
    <div className="h-full flex flex-col gap-3 2xl:gap-6 overflow-y-auto">
      <h2 className="text-xl 2xl:text-3xl font-black text-white">Statistik & Records</h2>

      <div className="p-3 2xl:p-5 rounded-2xl bg-gradient-to-br from-yellow-500/10 to-amber-500/5 border border-yellow-500/20">
        <div className="flex items-center gap-2 2xl:gap-3 mb-1 2xl:mb-2">
          <Trophy className="h-4 w-4 2xl:h-6 2xl:w-6 text-yellow-400" />
          <span className="text-xs 2xl:text-sm text-yellow-400/80 font-medium">Højeste provision i sæsonen</span>
        </div>
        <p className="text-2xl 2xl:text-4xl font-black text-white tabular-nums">{formatKr(records.highestProvision)}</p>
        <p className="text-slate-400 text-xs 2xl:text-sm mt-1">{records.highestProvisionName}</p>
      </div>

      <div>
        <h3 className="text-xs 2xl:text-sm font-medium text-slate-400 mb-2 2xl:mb-4 flex items-center gap-2">
          <BarChart3 className="h-3 w-3 2xl:h-4 2xl:w-4" /> Gennemsnit per division
        </h3>
        <div className="space-y-2 2xl:space-y-3">
          {records.divisionAverages.map((d) => {
            const pct = (d.average / maxAvg) * 100;
            return (
              <div key={d.division} className="flex items-center gap-2 2xl:gap-3">
                <span className="text-xs 2xl:text-sm text-slate-500 w-20 2xl:w-24 shrink-0 truncate">{getDivisionName(d.division)}</span>
                <div className="flex-1 bg-slate-800 rounded-full h-5 2xl:h-6 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, delay: d.division * 0.1 }}
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-end px-2"
                  >
                    <span className="text-[9px] 2xl:text-[10px] font-bold text-white tabular-nums">
                      {formatKr(Math.round(d.average))}
                    </span>
                  </motion.div>
                </div>
                <span className="text-[10px] 2xl:text-xs text-slate-600 w-10 2xl:w-12 text-right">{d.playerCount} sp.</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function TvLeagueDashboard() {
  const { data, isLoading, error } = useLeagueTvData();
  const [leftSceneIndex, setLeftSceneIndex] = useState(0);
  const tvMode = isTvMode();

  // Left scene rotation
  useEffect(() => {
    if (!data) return;
    const duration = LEFT_SCENE_DURATIONS[leftSceneIndex] || 15_000;
    const timer = setTimeout(() => {
      setLeftSceneIndex((prev) => (prev + 1) % LEFT_SCENES.length);
    }, duration);
    return () => clearTimeout(timer);
  }, [leftSceneIndex, data]);

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-yellow-400" />
        </div>
      </DashboardShell>
    );
  }

  if (error || !data) {
    return (
      <DashboardShell>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <p className="text-red-400">Kunne ikke hente liga-data</p>
        </div>
      </DashboardShell>
    );
  }

  const currentLeftScene = LEFT_SCENES[leftSceneIndex];
  const isActive = data.seasonStatus === "active";
  const prizeLeaders = data.prizeLeaders;

  return (
    <DashboardShell>
      {!tvMode && (
        <DashboardHeader
          title="⚽ Superliga Live"
          subtitle={`${data.totalPlayers} spillere · ${data.totalDivisions} divisioner`}
        />
      )}
      <div className={`bg-slate-900 text-white overflow-hidden flex ${tvMode ? "min-h-screen h-screen" : "h-[calc(100vh-120px)] rounded-xl"}`}>
        {/* ─── LEFT ZONE (40%) — rotates overview / movements / records ─── */}
        <div className="w-[40%] border-r border-slate-800 p-3 2xl:p-6 flex flex-col">
          {tvMode && (
            <div className="mb-2 2xl:mb-4">
              <h1 className="text-lg 2xl:text-2xl font-black tracking-tight">
                <span className="text-yellow-400">⚽</span> Superliga Live
              </h1>
              <p className="text-[10px] 2xl:text-xs text-slate-500 mt-1">
                {data.totalPlayers} spillere · {data.totalDivisions} divisioner
              </p>
            </div>
          )}

          {/* Scene indicator dots */}
          <div className="flex gap-1.5 mb-2 2xl:mb-4">
            {LEFT_SCENES.map((s, i) => (
              <div
                key={s}
                className={`w-8 h-1 rounded-full transition-colors duration-300 ${
                  i === leftSceneIndex ? "bg-white" : "bg-slate-700"
                }`}
              />
            ))}
          </div>

          {/* Rotating content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentLeftScene}
                initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="h-full flex flex-col"
              >
                {currentLeftScene === "overview" && (
                  <>
                    <div className="mb-2 2xl:mb-4">
                      <h3 className="text-[10px] 2xl:text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 2xl:mb-3">
                        🏆 Top 3 {isActive ? "(point)" : "(provision)"}
                      </h3>
                      <div className="space-y-1.5 2xl:space-y-2">
                        {data.top3.map((p, i) => (
                          <PodiumCard key={p.employeeId || i} player={p} rank={i + 1} isPoints={isActive} />
                        ))}
                        {data.top3.length === 0 && (
                          <p className="text-slate-600 text-xs 2xl:text-sm italic">Ingen data endnu</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5 2xl:gap-2 mb-2 2xl:mb-4">
                      <PrizeCard
                        emoji="🔥"
                        title="Bedste Runde"
                        leader={prizeLeaders?.bestRound ?? null}
                        locked={!prizeLeaders?.bestRound}
                        lockedText="Ingen data endnu"
                        borderClass="border-red-500/40"
                        gradientClass="from-red-500/5 to-transparent"
                      />
                      <PrizeCard
                        emoji="⭐"
                        title="Sæsonens Talent"
                        leader={prizeLeaders?.talent ?? null}
                        locked={!prizeLeaders?.talent}
                        lockedText="Afgøres efter runde 1"
                        borderClass="border-purple-500/40"
                        gradientClass="from-purple-500/5 to-transparent"
                      />
                      <PrizeCard
                        emoji="🚀"
                        title="Sæsonens Comeback"
                        leader={prizeLeaders?.comeback ?? null}
                        locked={!prizeLeaders?.comeback}
                        lockedText="Ingen data endnu"
                        borderClass="border-emerald-500/40"
                        gradientClass="from-emerald-500/5 to-transparent"
                      />
                    </div>
                    <div className="flex-1 min-h-0">
                      <h3 className="text-[10px] 2xl:text-xs font-medium text-slate-500 uppercase tracking-wider mb-2 2xl:mb-3">
                        🔥 Seneste indtjening (300+ kr samlet)
                      </h3>
                      <TickerFeed earners={data.recentEarners} />
                    </div>
                  </>
                )}
                {currentLeftScene === "movements" && (
                  <SceneMovements movements={data.movements} topLastHour={data.topLastHour} />
                )}
                {currentLeftScene === "records" && (
                  <SceneRecords records={data.records} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-2 2xl:mt-4 pt-2 2xl:pt-3 border-t border-slate-800">
            <p className="text-[9px] 2xl:text-[10px] text-slate-600">
              Opdateret: {data.updatedAt ? new Date(data.updatedAt).toLocaleTimeString("da-DK") : "–"}
            </p>
          </div>
        </div>

        {/* ─── RIGHT ZONE (60%) — always divisions ─── */}
        <div className="w-[60%] p-3 2xl:p-6">
          <SceneDivisions divisions={data.divisions} />
        </div>
      </div>
    </DashboardShell>
  );
}
