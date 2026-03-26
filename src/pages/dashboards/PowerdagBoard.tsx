import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { useActiveEvent, useRulesForEvent, useScoresForEvent, computeStandings } from "@/hooks/usePowerdagData";
import { useAutoReload, isTvMode } from "@/utils/tvMode";
import { Trophy, Medal } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { TvBoardQuickGenerator } from "@/components/dashboard/TvBoardQuickGenerator";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import { Progress } from "@/components/ui/progress";
import { useCachedLeaderboard, formatDisplayName, getInitials } from "@/hooks/useCachedLeaderboard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const PODIUM_CONFIG = [
  { emoji: "🥇", bg: "from-yellow-500/20 via-amber-500/10 to-yellow-600/5", border: "border-yellow-500/50", glow: "shadow-yellow-500/20", label: "text-yellow-400" },
  { emoji: "🥈", bg: "from-slate-300/20 via-slate-400/10 to-slate-300/5", border: "border-slate-400/40", glow: "shadow-slate-400/15", label: "text-slate-300" },
  { emoji: "🥉", bg: "from-orange-500/20 via-amber-600/10 to-orange-500/5", border: "border-orange-500/40", glow: "shadow-orange-500/15", label: "text-orange-400" },
];

// Podium order: [1st place center (tall), 0th=2nd left, 2nd=3rd right]
const PODIUM_ORDER = [1, 0, 2];

export default function PowerdagBoard() {
  const tv = isTvMode();
  useAutoReload(tv, 5 * 60_000);
  const { canView, isLoading: accessLoading } = useRequireDashboardAccess("powerdag");

  const { data: event } = useActiveEvent();
  const { data: rules = [] } = useRulesForEvent(event?.id);
  const { data: scores = [] } = useScoresForEvent(event?.id);

  const standings = computeStandings(rules, scores);
  const maxPoints = Math.max(...standings.map(s => s.total_points), 1);
  const top3 = standings.slice(0, 3);
  const rest = standings.slice(3);

  if (accessLoading) return <DashboardShell><div className="flex items-center justify-center h-64 text-muted-foreground">Indlæser...</div></DashboardShell>;
  if (!canView) return null;

  return (
    <DashboardShell>
      <div className={`${tv ? "p-6" : "p-4 md:p-6"} max-w-5xl mx-auto space-y-8`}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`${tv ? "text-4xl" : "text-2xl md:text-3xl"} font-black tracking-tight flex items-center gap-3`}>
              <Trophy className="h-7 w-7 text-yellow-500" />
              {event?.name ?? "Powerdag"}
              <span className="inline-flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live
              </span>
            </h1>
            {event && <p className="text-sm text-muted-foreground mt-1">{new Date(event.event_date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>}
          </div>
          {!tv && (
            <div className="flex items-center gap-2">
              <TvBoardQuickGenerator dashboardSlug="powerdag" />
              <Link to="/dashboards/powerdag/input">
                <Button variant="outline" size="sm">Indtast salg</Button>
              </Link>
            </div>
          )}
        </div>

        {standings.length === 0 ? (
          <p className="text-muted-foreground text-center py-12">Ingen data endnu — start med at indtaste salg.</p>
        ) : (
          <>
            {/* Podium — Top 3 */}
            {top3.length >= 3 && (
              <div className={`grid grid-cols-3 gap-3 md:gap-4 items-end ${tv ? "gap-6" : ""}`}>
                {PODIUM_ORDER.map((idx) => {
                  const team = top3[idx];
                  const cfg = PODIUM_CONFIG[idx];
                  const isFirst = idx === 0;
                  return (
                    <div
                      key={team.team_name}
                      className={`relative rounded-2xl border-2 bg-gradient-to-b ${cfg.bg} ${cfg.border} p-4 md:p-6 text-center transition-all shadow-lg ${cfg.glow} ${isFirst ? "scale-105 md:scale-110 z-10" : ""}`}
                      style={{
                        animation: `fade-in 0.5s ease-out ${idx * 0.15}s both`,
                        minHeight: isFirst ? (tv ? "260px" : "200px") : (tv ? "220px" : "170px"),
                      }}
                    >
                      {/* Rank badge */}
                      <div className={`text-3xl md:text-4xl mb-2 ${isFirst ? "animate-bounce" : ""}`} style={isFirst ? { animationDuration: "2s" } : undefined}>
                        {cfg.emoji}
                      </div>
                      {/* Points */}
                      <p className={`font-black tabular-nums ${cfg.label} ${tv ? "text-5xl md:text-6xl" : "text-3xl md:text-4xl"}`}>
                        {team.total_points % 1 === 0 ? team.total_points : team.total_points.toFixed(1)}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">Point</p>
                      {/* Team name */}
                      <p className={`font-bold mt-3 truncate ${tv ? "text-lg" : "text-sm md:text-base"}`}>{team.team_name}</p>
                      {/* Sub entries hint */}
                      {team.sub_entries.length > 1 && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                          {team.sub_entries.map(e => e.sub_client_name ?? team.team_name).join(" · ")}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Fallback: if < 3 teams, show all as list */}
            {top3.length < 3 && top3.length > 0 && (
              <div className="space-y-3">
                {top3.map((team, i) => (
                  <TeamRow key={team.team_name} team={team} rank={i} maxPoints={maxPoints} tv={tv} cfg={PODIUM_CONFIG[i]} />
                ))}
              </div>
            )}

            {/* Rest of teams */}
            {rest.length > 0 && (
              <div className="space-y-2">
                {rest.map((team, i) => (
                  <TeamRow key={team.team_name} team={team} rank={i + 3} maxPoints={maxPoints} tv={tv} delay={i * 0.08} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Top 5 Sælgere */}
        <TopSellersSection tv={tv} />
      </div>
    </DashboardShell>
  );
}

function TeamRow({ team, rank, maxPoints, tv, cfg, delay = 0 }: {
  team: ReturnType<typeof computeStandings>[number];
  rank: number;
  maxPoints: number;
  tv: boolean;
  cfg?: typeof PODIUM_CONFIG[number];
  delay?: number;
}) {
  const pct = maxPoints > 0 ? (team.total_points / maxPoints) * 100 : 0;
  const isComposite = team.sub_entries.length > 1 || team.sub_entries.some(e => e.sub_client_name);

  return (
    <div
      className={`rounded-xl border bg-gradient-to-r p-4 md:p-5 transition-all ${cfg ? `${cfg.bg} ${cfg.border} shadow-md ${cfg.glow}` : "from-card to-card border-border"}`}
      style={{ animation: `fade-in 0.4s ease-out ${delay}s both` }}
    >
      <div className="flex items-center gap-4">
        {/* Rank */}
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${cfg ? `bg-gradient-to-br ${cfg.bg} border ${cfg.border}` : "bg-muted"}`}>
          {cfg ? <span className="text-xl">{cfg.emoji}</span> : <span className="text-muted-foreground">{rank + 1}</span>}
        </div>

        {/* Team info */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-lg truncate">{team.team_name}</p>
            <p className={`font-black tabular-nums flex-shrink-0 ${tv ? "text-3xl" : "text-2xl"} ${cfg ? cfg.label : ""}`}>
              {team.total_points % 1 === 0 ? team.total_points : team.total_points.toFixed(1)}
              <span className="text-xs font-normal text-muted-foreground ml-1">pt</span>
            </p>
          </div>
          {/* Progress bar */}
          <Progress value={pct} className="h-2" />
          {isComposite && (
            <p className="text-[10px] text-muted-foreground">
              {team.sub_entries.map(e => e.sub_client_name ?? team.team_name).join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* Sub-entries accordion */}
      {isComposite && !tv && (
        <Accordion type="single" collapsible className="mt-2">
          <AccordionItem value="details" className="border-0">
            <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
              Vis detaljer
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-3 gap-1 text-xs">
                <span className="font-medium text-muted-foreground">Klient</span>
                <span className="font-medium text-muted-foreground text-right">Salg</span>
                <span className="font-medium text-muted-foreground text-right">Point</span>
                {team.sub_entries.map((e, j) => (
                  <div key={j} className="contents">
                    <span>{e.sub_client_name ?? team.team_name}</span>
                    <span className="text-right tabular-nums">{e.sales_count}</span>
                    <span className="text-right tabular-nums">{e.points % 1 === 0 ? e.points : e.points.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}

const SELLER_RANK_STYLES = [
  "bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border-yellow-500/40 text-yellow-400",
  "bg-gradient-to-br from-slate-300/20 to-slate-400/10 border-slate-400/30 text-slate-300",
  "bg-gradient-to-br from-orange-500/20 to-orange-600/10 border-orange-500/30 text-orange-400",
];

function TopSellersSection({ tv }: { tv: boolean }) {
  const { data: topSellers = [] } = useCachedLeaderboard("today", { type: "global" }, { limit: 5 });

  if (topSellers.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className={`${tv ? "text-2xl" : "text-lg md:text-xl"} font-bold flex items-center gap-2`}>
        <Medal className="h-5 w-5 text-primary" />
        Top 5 Sælgere — I dag
      </h2>
      <div className="space-y-2">
        {topSellers.map((seller, idx) => (
          <div
            key={seller.employeeId}
            className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-3 md:p-4"
            style={{ animation: `fade-in 0.4s ease-out ${idx * 0.1}s both` }}
          >
            {/* Rank */}
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border ${idx < 3 ? SELLER_RANK_STYLES[idx] : "bg-muted text-muted-foreground"}`}>
              {idx + 1}
            </div>
            {/* Name + team */}
            <div className="flex-1 min-w-0">
              <p className={`font-semibold truncate ${tv ? "text-lg" : "text-sm"}`}>
                {formatDisplayName(seller.employeeName)}
              </p>
              {seller.teamName && (
                <Badge variant="outline" className="text-[10px] mt-0.5 px-1.5 py-0">
                  {seller.teamName}
                </Badge>
              )}
            </div>
            {/* Stats */}
            <div className="text-right flex-shrink-0">
              <p className={`font-black tabular-nums ${tv ? "text-2xl" : "text-lg"}`}>
                {seller.commission.toLocaleString("da-DK")}
                <span className="text-xs font-normal text-muted-foreground ml-1">kr.</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
