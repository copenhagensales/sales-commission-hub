import { useMemo, useState, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, ArrowUpRight, ArrowDownRight, Eye, EyeOff, Shield } from "lucide-react";
import { QualificationStanding } from "@/hooks/useLeagueData";
import { cn } from "@/lib/utils";
import { formatPlayerName } from "@/lib/formatPlayerName";
import { PodiumBadge } from "./PodiumBadge";
import { DailyTopBadge, computeTodayTop3 } from "./DailyTopBadge";
import { ZoneLegend } from "./ZoneLegend";
import { ProvisionSparkline } from "./ProvisionSparkline";
import { PlayerHoverCard } from "./PlayerHoverCard";
import { ZoneProgressBar } from "./ZoneProgressBar";
import { motion, AnimatePresence } from "framer-motion";

interface QualificationBoardProps {
  standings: QualificationStanding[];
  playersPerDivision: number;
  isLoading: boolean;
  currentEmployeeId?: string;
  defaultShowAll?: boolean;
  maxProvision?: number;
  todayProvisionMap?: Record<string, number>;
  weeklyProvisionMap?: Record<string, number[]>;
}

export function QualificationBoard({
  standings,
  playersPerDivision,
  isLoading,
  currentEmployeeId,
  defaultShowAll = false,
  todayProvisionMap = {},
  weeklyProvisionMap = {},
}: QualificationBoardProps) {
  const computedMaxProvision = useMemo(() => {
    if (standings.length === 0) return 1;
    return Math.max(...standings.map(s => s.current_provision), 1);
  }, [standings]);
  const [showAll, setShowAll] = useState(defaultShowAll);
  const todayTop3 = useMemo(() => computeTodayTop3(todayProvisionMap), [todayProvisionMap]);

  const myDivision = useMemo(() => {
    if (!currentEmployeeId) return null;
    const my = standings.find(s => s.employee_id === currentEmployeeId);
    return my?.projected_division ?? null;
  }, [standings, currentEmployeeId]);

  const divisionGroups = useMemo(() => {
    const groups: { division: number; players: QualificationStanding[] }[] = [];
    standings.forEach((standing) => {
      const divIndex = groups.findIndex(g => g.division === standing.projected_division);
      if (divIndex >= 0) {
        groups[divIndex].players.push(standing);
      } else {
        groups.push({ division: standing.projected_division, players: [standing] });
      }
    });
    groups.sort((a, b) => a.division - b.division);
    groups.forEach(g => g.players.sort((a, b) => a.projected_rank - b.projected_rank));
    return groups;
  }, [standings]);

  const totalDivisions = divisionGroups.length;

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
          <p className="text-muted-foreground text-sm">Ingen tilmeldte spillere endnu. Vær den første!</p>
        </CardContent>
      </Card>
    );
  }

  const getZoneTarget = (group: { division: number; players: QualificationStanding[] }) => {
    if (group.players.length < 3) return null;
    return group.players[2]?.current_provision ?? null;
  };

  return (
    <div className="space-y-4">
      {visibleGroups.map((group) => {
        const isTopDivision = group.division === 1;
        const isBottomDivision = group.division === totalDivisions;
        const zoneTarget = getZoneTarget(group);

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
                        const prevProvision = idx > 0 ? group.players[idx - 1].current_provision : null;
                        const nextProvision = idx < group.players.length - 1 ? group.players[idx + 1].current_provision : null;
                        return (
                          <motion.div
                            key={standing.employee_id}
                            layout
                            layoutId={`qual-${standing.employee_id}`}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                          >
                            <PlayerRow
                              standing={standing}
                              isCurrentUser={standing.employee_id === currentEmployeeId}
                              playersPerDivision={playersPerDivision}
                              isTopDivision={isTopDivision}
                              isBottomDivision={isBottomDivision}
                              idx={idx}
                              maxProvision={computedMaxProvision}
                              todayProvision={todayProvisionMap[standing.employee_id] || 0}
                              todayDailyRank={todayTop3[standing.employee_id] || null}
                              weeklyData={weeklyProvisionMap[standing.employee_id]}
                              divisionAvg={divisionAvg}
                              division={standing.projected_division}
                              zoneTarget={zoneTarget}
                              prevProvision={prevProvision}
                              nextProvision={nextProvision}
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

interface PlayerRowProps {
  standing: QualificationStanding;
  isCurrentUser: boolean;
  playersPerDivision: number;
  isTopDivision: boolean;
  isBottomDivision: boolean;
  idx: number;
  maxProvision: number;
  todayProvision: number;
  todayDailyRank: 1 | 2 | 3 | null;
  weeklyData?: number[];
  divisionAvg?: number[];
  division: number;
  zoneTarget: number | null;
  prevProvision: number | null;
  nextProvision: number | null;
}

const PlayerRow = memo(function PlayerRow({
  standing,
  isCurrentUser,
  playersPerDivision,
  isTopDivision,
  isBottomDivision,
  idx,
  maxProvision,
  todayProvision,
  todayDailyRank,
  weeklyData,
  divisionAvg,
  division,
  zoneTarget,
  prevProvision,
  nextProvision,
}: PlayerRowProps) {
  const rankChange = standing.previous_overall_rank !== null
    ? standing.previous_overall_rank - standing.overall_rank
    : 0;

  const isPromoZone = !isTopDivision && standing.projected_rank <= 3;
  const isTopZone = isTopDivision && standing.projected_rank <= 3;
  const isPlayoffZoneUp = !isTopDivision && (standing.projected_rank === 4 || standing.projected_rank === 5);
  const isPlayoffZoneDown = (standing.projected_rank === playersPerDivision - 3 || standing.projected_rank === playersPerDivision - 4);
  const isPlayoffZone = isPlayoffZoneUp || isPlayoffZoneDown;
  const isRelegationZone = !isBottomDivision && standing.projected_rank >= playersPerDivision - 2;

  const isPodium = standing.projected_rank <= 3;
  const podiumRank = standing.projected_rank as 1 | 2 | 3;

  const zone = isTopZone ? "top" : isPromoZone ? "promo" : isPlayoffZone ? "playoff" : isRelegationZone ? "relegation" : "safe";

  const showDashedBefore = 
    (idx > 0 && standing.projected_rank === 4 && !isTopDivision) ||
    (idx > 0 && standing.projected_rank === playersPerDivision - 4) ||
    (idx > 0 && standing.projected_rank === playersPerDivision - 2);

  const playerName = formatPlayerName(standing.employee);

  // Gap indicators for current user
  const gapUp = isCurrentUser && prevProvision !== null ? prevProvision - standing.current_provision : null;
  const gapDown = isCurrentUser && nextProvision !== null ? standing.current_provision - nextProvision : null;

  return (
    <div>
      {showDashedBefore && <div className="border-t-2 border-dashed border-muted-foreground/20" />}
      <div
        className={cn(
          "flex items-center gap-1.5 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 min-h-[48px] sm:min-h-[52px] transition-all duration-200",
          "hover:bg-muted/30 hover:shadow-[inset_0_0_0_1px_hsl(var(--border)/0.5)] cursor-default",
          isCurrentUser && "bg-primary/10 border-l-[3px] border-l-primary",
          !isCurrentUser && isPromoZone && "bg-green-500/8",
          !isCurrentUser && isTopZone && "bg-yellow-500/8",
          !isCurrentUser && isPlayoffZone && "bg-orange-500/8",
          !isCurrentUser && isRelegationZone && "bg-red-500/8"
        )}
      >
        {/* Rank */}
        <div className="flex items-center gap-0.5 sm:gap-1 w-7 sm:w-10 shrink-0 justify-center">
          <div className={cn(
            "w-0.5 h-5 rounded-full shrink-0",
            isPromoZone && "bg-green-500",
            isTopZone && "bg-yellow-500",
            isPlayoffZone && "bg-orange-500",
            isRelegationZone && "bg-red-500",
            !isPromoZone && !isTopZone && !isPlayoffZone && !isRelegationZone && "bg-transparent"
          )} />
          {isPodium ? (
            <PodiumBadge rank={podiumRank} className="scale-75 sm:scale-100" />
          ) : (
            <span className="text-xs sm:text-sm font-bold text-muted-foreground w-5 text-center">{standing.projected_rank}</span>
          )}
        </div>

        {/* Name – fluid on mobile */}
        <div className="min-w-0 flex-1 sm:w-[220px] sm:flex-none sm:shrink-0">
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            {todayProvision > 0 && (
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
            )}
            <PlayerHoverCard
              playerName={playerName}
              teamName={standing.employee?.team_name || "Ingen team"}
              todayProvision={todayProvision}
              totalProvision={standing.current_provision}
              division={division}
            >
              <span className={cn(
                "font-medium text-xs sm:text-[15px] truncate max-w-[100px] sm:max-w-none cursor-default",
                isCurrentUser && "text-primary font-semibold"
              )}>
                {playerName}
              </span>
            </PlayerHoverCard>
            {isCurrentUser && <span className="text-[9px] sm:text-[10px] text-muted-foreground">(dig)</span>}
            {rankChange !== 0 && (
              <span className={cn("text-[10px] sm:text-xs font-semibold flex items-center", rankChange > 0 ? "text-green-500" : "text-red-500")}>
                {rankChange > 0 ? <ArrowUpRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> : <ArrowDownRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                <span className="text-[10px] sm:text-[11px]">{Math.abs(rankChange)}</span>
              </span>
            )}
            {/* Daily top badge inline on mobile */}
            {todayDailyRank && <DailyTopBadge rank={todayDailyRank} size="lg" />}
          </div>
          <div className="hidden sm:flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {standing.employee?.team_name || "Ingen team"}
            </Badge>
          </div>
        </div>

        {/* Sparkline – hidden on mobile */}
        <div className="hidden sm:flex flex-1 items-center min-w-[120px]">
          {weeklyData && weeklyData.length > 0 && (
            <ProvisionSparkline
              data={weeklyData}
              divisionAvg={divisionAvg}
              playerName={formatPlayerName(standing.employee)}
            />
          )}
        </div>

        {/* Provision + today – compact on mobile */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1 sm:gap-1.5 justify-end">
              {todayDailyRank && <span className="hidden sm:inline"><DailyTopBadge rank={todayDailyRank} size="lg" /></span>}
              <div className="font-mono text-xs sm:text-base font-semibold whitespace-nowrap">
                {standing.current_provision.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr
              </div>
            </div>
            <div className={cn(
              "text-[9px] sm:text-[10px] font-medium flex items-center gap-1 justify-end",
              todayProvision > 0 ? "text-emerald-400" : "text-muted-foreground/50"
            )}>
              I dag: {todayProvision > 0
                ? `${todayProvision.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr`
                : "0 kr"}
            </div>
            {/* Gap indicators – only for current user */}
            {isCurrentUser && gapUp !== null && gapUp > 0 && (
              <div className="text-[8px] sm:text-[9px] text-muted-foreground/70 font-mono">
                ↑ {gapUp.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr
              </div>
            )}
            {isCurrentUser && gapDown !== null && gapDown > 0 && (
              <div className="hidden sm:block text-[9px] text-muted-foreground/50 font-mono">
                ↓ {gapDown.toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr forspring
              </div>
            )}
            {zoneTarget != null && zoneTarget > 0 && (
              <ZoneProgressBar
                current={standing.current_provision}
                target={zoneTarget}
                zone={zone}
                className="mt-0.5 sm:mt-1 w-16 sm:w-20 ml-auto"
              />
            )}
          </div>
          {/* Zone badges – hidden on mobile (shown via color stripe) */}
          <div className="hidden sm:block w-20 text-right">
            {isPromoZone && <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px] px-1.5 py-0">Oprykker</Badge>}
            {isTopZone && <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px] px-1.5 py-0">Top 3</Badge>}
            {isPlayoffZone && <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 text-[10px] px-1.5 py-0">Playoff</Badge>}
            {isRelegationZone && <Badge className="bg-red-500/20 text-red-600 border-red-500/30 text-[10px] px-1.5 py-0">Nedrykker</Badge>}
          </div>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.standing.id === nextProps.standing.id &&
    prevProps.standing.projected_rank === nextProps.standing.projected_rank &&
    prevProps.standing.overall_rank === nextProps.standing.overall_rank &&
    prevProps.standing.previous_overall_rank === nextProps.standing.previous_overall_rank &&
    prevProps.standing.current_provision === nextProps.standing.current_provision &&
    prevProps.standing.deals_count === nextProps.standing.deals_count &&
    prevProps.isCurrentUser === nextProps.isCurrentUser &&
    prevProps.playersPerDivision === nextProps.playersPerDivision &&
    prevProps.isTopDivision === nextProps.isTopDivision &&
    prevProps.isBottomDivision === nextProps.isBottomDivision &&
    prevProps.idx === nextProps.idx &&
    prevProps.todayProvision === nextProps.todayProvision &&
    prevProps.weeklyData === nextProps.weeklyData &&
    prevProps.prevProvision === nextProps.prevProvision &&
    prevProps.nextProvision === nextProps.nextProvision
  );
});
