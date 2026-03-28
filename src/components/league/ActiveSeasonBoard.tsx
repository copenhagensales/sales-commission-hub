import { useMemo, useState, memo } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, ArrowUp, ArrowDown, Eye, EyeOff, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPlayerName } from "@/lib/formatPlayerName";
import { PodiumBadge } from "./PodiumBadge";
import { DailyTopBadge, computeTodayTop3 } from "./DailyTopBadge";
import { ZoneLegend } from "./ZoneLegend";
import { ProvisionSparkline } from "./ProvisionSparkline";
import { PlayerHoverCard } from "./PlayerHoverCard";
import { ZoneProgressBar } from "./ZoneProgressBar";
import { LeagueSeasonStanding } from "@/hooks/useLeagueActiveData";
import { motion, AnimatePresence } from "framer-motion";

const ROUND_MULTIPLIERS = [1, 1.2, 1.4, 1.6, 1.8, 2.0];

function calculatePointsAtStake(division: number, rank: number, totalDivisions: number, multiplier: number): number {
  const basePoints = Math.max(0, (totalDivisions - division + 1) * 20 - (rank - 1) * 5);
  return Math.round(basePoints * multiplier);
}

interface ActiveSeasonBoardProps {
  standings: LeagueSeasonStanding[];
  playersPerDivision: number;
  isLoading: boolean;
  currentEmployeeId?: string;
  defaultShowAll?: boolean;
  todayProvisionMap?: Record<string, number>;
  weeklyProvisionMap?: Record<string, number[]>;
  roundProvisionMap?: Record<string, number>;
  currentRoundNumber?: number;
}

export function ActiveSeasonBoard({
  standings,
  playersPerDivision,
  isLoading,
  currentEmployeeId,
  defaultShowAll = false,
  todayProvisionMap = {},
  weeklyProvisionMap = {},
  roundProvisionMap = {},
  currentRoundNumber = 1,
}: ActiveSeasonBoardProps) {
  const [showAll, setShowAll] = useState(defaultShowAll);
  const todayTop3 = useMemo(() => computeTodayTop3(todayProvisionMap), [todayProvisionMap]);

  const myDivision = useMemo(() => {
    if (!currentEmployeeId) return null;
    const my = standings.find(s => s.employee_id === currentEmployeeId);
    return my?.current_division ?? null;
  }, [standings, currentEmployeeId]);

  const divisionGroups = useMemo(() => {
    const groups: { division: number; players: LeagueSeasonStanding[] }[] = [];
    
    standings.forEach((standing) => {
      const divIndex = groups.findIndex(g => g.division === standing.current_division);
      if (divIndex >= 0) {
        groups[divIndex].players.push(standing);
      } else {
        groups.push({ division: standing.current_division, players: [standing] });
      }
    });

    groups.sort((a, b) => a.division - b.division);
    
    // Sort players within division by round provision (descending) if available, else by division_rank
    const hasRoundData = Object.keys(roundProvisionMap).length > 0;
    groups.forEach(g => {
      if (hasRoundData) {
        g.players.sort((a, b) => (roundProvisionMap[b.employee_id] || 0) - (roundProvisionMap[a.employee_id] || 0));
      } else {
        g.players.sort((a, b) => a.division_rank - b.division_rank);
      }
    });

    return groups;
  }, [standings, roundProvisionMap]);

  const totalDivisions = divisionGroups.length;
  const multiplier = ROUND_MULTIPLIERS[Math.min((currentRoundNumber || 1) - 1, ROUND_MULTIPLIERS.length - 1)] || 1;
  const visibleGroups = useMemo(() => {
    if (showAll || !currentEmployeeId || myDivision === null) return divisionGroups;
    return divisionGroups.filter(g => g.division === 1 || g.division === myDivision);
  }, [divisionGroups, showAll, currentEmployeeId, myDivision]);

  const hiddenCount = divisionGroups.length - visibleGroups.length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader className="pb-2 py-3"><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="p-0">
              {[1, 2, 3, 4, 5].map((j) => <Skeleton key={j} className="h-10 w-full rounded-none" />)}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (standings.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="py-10 text-center">
          <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Ingen stillinger endnu.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {visibleGroups.map((group) => {
        const isTopDivision = group.division === 1;
        const isBottomDivision = group.division === divisionGroups[divisionGroups.length - 1].division;

        const headerGradient = isTopDivision
          ? "bg-gradient-to-r from-yellow-500/15 to-amber-500/5"
          : group.division === 2
          ? "bg-gradient-to-r from-slate-400/15 to-slate-300/5"
          : "bg-gradient-to-r from-orange-500/10 to-orange-400/5";

        return (
          <Card key={group.division} className="bg-card border-border overflow-hidden shadow-sm">
            <CardHeader className={cn("py-2.5 px-3 sm:px-4 border-b", headerGradient)}>
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base font-semibold">
                {isTopDivision ? (
                  <>
                    <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
                    <Shield className="h-3.5 w-3.5 text-yellow-500/60 shrink-0 -ml-1" />
                    <span className="truncate">Superligaen</span>
                  </>
                ) : (
                  <>
                    <Medal className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Shield className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 -ml-1" />
                    <span>{group.division - 1}. Division</span>
                  </>
                )}
                <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
                  {group.players.length}/{playersPerDivision}
                </Badge>
              </CardTitle>
            </CardHeader>

            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {(() => {
                  const divWeeklyArrays = group.players
                    .map(s => weeklyProvisionMap[s.employee_id])
                    .filter((a): a is number[] => !!a && a.length === 7);
                  const divisionAvg = divWeeklyArrays.length > 0
                    ? Array.from({ length: 7 }, (_, dayIdx) =>
                        divWeeklyArrays.reduce((sum, arr) => sum + arr[dayIdx], 0) / divWeeklyArrays.length
                      )
                    : undefined;

                  return (
                    <AnimatePresence mode="popLayout">
                      {group.players.map((standing, idx) => {
                        const roundProv = roundProvisionMap[standing.employee_id] || 0;
                        const prevRoundProv = idx > 0 ? (roundProvisionMap[group.players[idx - 1].employee_id] || 0) : null;
                        const nextRoundProv = idx < group.players.length - 1 ? (roundProvisionMap[group.players[idx + 1].employee_id] || 0) : null;
                        return (
                          <motion.div
                            key={standing.employee_id}
                            layout
                            layoutId={`season-${standing.employee_id}`}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                          >
                            <SeasonPlayerRow
                              standing={standing}
                              isCurrentUser={standing.employee_id === currentEmployeeId}
                              playersPerDivision={playersPerDivision}
                              isTopDivision={isTopDivision}
                              isBottomDivision={isBottomDivision}
                              totalDivisions={totalDivisions}
                              idx={idx}
                              todayProvision={todayProvisionMap[standing.employee_id] || 0}
                              todayDailyRank={todayTop3[standing.employee_id] || null}
                              weeklyData={weeklyProvisionMap[standing.employee_id]}
                              divisionAvg={divisionAvg}
                              roundProvision={roundProv}
                              prevProvision={prevRoundProv}
                              nextProvision={nextRoundProv}
                              pointsAtStake={calculatePointsAtStake(group.division, idx + 1, totalDivisions, multiplier)}
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  );
                })()}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {hiddenCount > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => setShowAll(!showAll)}>
          {showAll ? (
            <><EyeOff className="h-4 w-4 mr-2" />Vis kun min division</>
          ) : (
            <><Eye className="h-4 w-4 mr-2" />Vis alle {divisionGroups.length} divisioner</>
          )}
        </Button>
      )}

      <ZoneLegend className="mt-3 px-1" />
    </div>
  );
}

interface SeasonPlayerRowProps {
  standing: LeagueSeasonStanding;
  isCurrentUser: boolean;
  playersPerDivision: number;
  isTopDivision: boolean;
  isBottomDivision: boolean;
  totalDivisions: number;
  idx: number;
  todayProvision: number;
  todayDailyRank: 1 | 2 | 3 | null;
  weeklyData?: number[];
  divisionAvg?: number[];
  roundProvision: number;
  prevProvision: number | null;
  nextProvision: number | null;
  pointsAtStake: number;
}

const SeasonPlayerRow = memo(function SeasonPlayerRow({
  standing,
  isCurrentUser,
  playersPerDivision,
  isTopDivision,
  isBottomDivision,
  idx,
  todayProvision,
  todayDailyRank,
  weeklyData,
  divisionAvg,
  roundProvision,
  prevProvision,
  nextProvision,
  pointsAtStake,
}: SeasonPlayerRowProps) {
  const rank = idx + 1; // rank based on sorted position (by round provision)
  const divChanged = standing.previous_division !== null && standing.previous_division !== standing.current_division;
  const promoted = divChanged && standing.previous_division !== null && standing.previous_division > standing.current_division;
  const relegated = divChanged && standing.previous_division !== null && standing.previous_division < standing.current_division;

  const isPromoZone = !isTopDivision && rank <= 3;
  const isTopZone = isTopDivision && rank <= 3;
  const isPlayoffZoneUp = !isTopDivision && (rank === 4 || rank === 5);
  const isPlayoffZoneDown = (rank === playersPerDivision - 3 || rank === playersPerDivision - 4);
  const isPlayoffZone = isPlayoffZoneUp || isPlayoffZoneDown;
  const isRelegationZone = !isBottomDivision && rank >= playersPerDivision - 2;

  const isPodium = rank <= 3;

  const showDashedBefore =
    (idx > 0 && rank === 4 && !isTopDivision) ||
    (idx > 0 && rank === playersPerDivision - 4) ||
    (idx > 0 && rank === playersPerDivision - 2);

  const playerName = formatPlayerName(standing.employee);

  const gapUp = isCurrentUser && prevProvision !== null ? prevProvision - roundProvision : null;
  const gapDown = isCurrentUser && nextProvision !== null ? roundProvision - nextProvision : null;

  return (
    <div>
      {showDashedBefore && <div className="border-t-2 border-dashed border-muted-foreground/20" />}
      
      <div
        className={cn(
          "flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 min-h-[52px] transition-all duration-200",
          "hover:bg-muted/30 hover:shadow-[inset_0_0_0_1px_hsl(var(--border)/0.5)] cursor-default",
          isCurrentUser && "bg-primary/10 border-l-[3px] border-l-primary",
          !isCurrentUser && isPromoZone && "bg-green-500/8",
          !isCurrentUser && isTopZone && "bg-yellow-500/8",
          !isCurrentUser && isPlayoffZone && "bg-orange-500/8",
          !isCurrentUser && isRelegationZone && "bg-red-500/8"
        )}
      >
        {/* Rank */}
        <div className="flex items-center gap-1 w-8 sm:w-10 shrink-0 justify-center">
          <div
            className={cn(
              "w-0.5 h-5 rounded-full shrink-0",
              isPromoZone && "bg-green-500",
              isTopZone && "bg-yellow-500",
              isPlayoffZone && "bg-orange-500",
              isRelegationZone && "bg-red-500",
              !isPromoZone && !isTopZone && !isPlayoffZone && !isRelegationZone && "bg-transparent"
            )}
          />
          {isPodium ? (
            <PodiumBadge rank={rank as 1 | 2 | 3} className="scale-90 sm:scale-100" />
          ) : (
            <span className="text-sm font-bold text-muted-foreground w-5 text-center">{rank}</span>
          )}
        </div>

        {/* Name + movement – fixed width for sparkline alignment */}
        <div className="w-[180px] sm:w-[220px] shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Live pulse dot */}
            {todayProvision > 0 && (
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]" />
              </span>
            )}
            <PlayerHoverCard
              playerName={playerName}
              teamName={standing.employee?.team_name || "Ingen team"}
              todayProvision={todayProvision}
              totalProvision={Number(standing.total_provision)}
              division={standing.current_division}
            >
              <span className={cn(
                "font-medium text-sm sm:text-[15px] truncate max-w-[140px] sm:max-w-none cursor-default",
                isCurrentUser && "text-primary font-semibold"
              )}>
                {playerName}
              </span>
            </PlayerHoverCard>
            {isCurrentUser && <span className="text-[10px] text-muted-foreground">(dig)</span>}
            
            {promoted && (
              <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-[10px] px-1 py-0">
                <ArrowUp className="h-3 w-3 mr-0.5" />Oprykket
              </Badge>
            )}
            {relegated && (
              <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-[10px] px-1 py-0">
                <ArrowDown className="h-3 w-3 mr-0.5" />Nedrykket
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {standing.employee?.team_name || "Ingen team"}
            </Badge>
          </div>
        </div>

        {/* Sparkline – centrally placed (always rendered for alignment) */}
        <div className="hidden sm:flex flex-1 items-center min-w-[120px]">
          {weeklyData && weeklyData.length > 0 && (
            <ProvisionSparkline
              data={weeklyData}
              divisionAvg={divisionAvg}
              playerName={formatPlayerName(standing.employee)}
            />
          )}
        </div>

        {/* Points + provision */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1.5 justify-end">
              <div className="font-mono text-sm sm:text-[15px] font-semibold whitespace-nowrap">
                {roundProvision.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr
              </div>
              {pointsAtStake > 0 && (
                <span className="font-mono text-[10px] text-primary/70 font-semibold">
                  +{pointsAtStake} pt
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {Number(standing.total_points).toLocaleString("da-DK", { maximumFractionDigits: 0 })} pt samlet
            </div>
            {todayProvision > 0 && (
              <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                {todayDailyRank && <DailyTopBadge rank={todayDailyRank} />}
                I dag: {todayProvision.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr
              </div>
            )}
            {/* Gap indicators – only for current user */}
            {isCurrentUser && gapUp !== null && gapUp > 0 && (
              <div className="text-[9px] text-muted-foreground/70 font-mono">
                ↑ {gapUp.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr til #{rank - 1}
              </div>
            )}
            {isCurrentUser && gapDown !== null && gapDown > 0 && (
              <div className="text-[9px] text-muted-foreground/50 font-mono">
                ↓ {gapDown.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr forspring
              </div>
            )}
          </div>
          {standing.rounds_played > 0 && (
            <div className="hidden sm:block text-right min-w-[50px]">
              <span className="text-sm text-muted-foreground">
                {standing.rounds_played} runder
              </span>
            </div>
          )}

          <div className="w-16 sm:w-20 text-right">
            {isPromoZone && (
              <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px] px-1.5 py-0">Oprykker</Badge>
            )}
            {isTopZone && (
              <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px] px-1.5 py-0">Top 3</Badge>
            )}
            {isPlayoffZone && (
              <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 text-[10px] px-1.5 py-0">Playoff</Badge>
            )}
            {isRelegationZone && (
              <Badge className="bg-red-500/20 text-red-600 border-red-500/30 text-[10px] px-1.5 py-0">Nedrykker</Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
