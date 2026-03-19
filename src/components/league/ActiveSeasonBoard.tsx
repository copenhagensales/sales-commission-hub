import { useMemo, useState, memo } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Trophy, Medal, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPlayerName } from "@/lib/formatPlayerName";
import { PodiumBadge } from "./PodiumBadge";
import { ZoneLegend } from "./ZoneLegend";
import { LeagueSeasonStanding } from "@/hooks/useLeagueActiveData";

interface ActiveSeasonBoardProps {
  standings: LeagueSeasonStanding[];
  playersPerDivision: number;
  isLoading: boolean;
  currentEmployeeId?: string;
  defaultShowAll?: boolean;
  todayProvisionMap?: Record<string, number>;
}

export function ActiveSeasonBoard({
  standings,
  playersPerDivision,
  isLoading,
  currentEmployeeId,
  defaultShowAll = false,
  todayProvisionMap = {},
}: ActiveSeasonBoardProps) {
  const [showAll, setShowAll] = useState(defaultShowAll);

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
    groups.forEach(g => g.players.sort((a, b) => a.division_rank - b.division_rank));

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

        return (
          <Card key={group.division} className="bg-card border-border overflow-hidden shadow-sm">
            <CardHeader className="py-2.5 px-3 sm:px-4 bg-muted/40 border-b">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base font-semibold">
                {isTopDivision ? (
                  <>
                    <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
                    <span className="truncate">Salgsligaen</span>
                  </>
                ) : (
                  <>
                    <Medal className="h-4 w-4 text-muted-foreground shrink-0" />
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
                {group.players.map((standing, idx) => (
                  <SeasonPlayerRow
                    key={standing.id}
                    standing={standing}
                    isCurrentUser={standing.employee_id === currentEmployeeId}
                    playersPerDivision={playersPerDivision}
                    isTopDivision={isTopDivision}
                    isBottomDivision={isBottomDivision}
                    totalDivisions={totalDivisions}
                    idx={idx}
                    todayProvision={todayProvisionMap[standing.employee_id] || 0}
                  />
                ))}
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
}

const SeasonPlayerRow = memo(function SeasonPlayerRow({
  standing,
  isCurrentUser,
  playersPerDivision,
  isTopDivision,
  isBottomDivision,
  idx,
  todayProvision,
}: SeasonPlayerRowProps) {
  const rank = standing.division_rank;
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

  return (
    <div>
      {showDashedBefore && <div className="border-t-2 border-dashed border-muted-foreground/20" />}
      
      <div
        className={cn(
          "flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 min-h-[52px] transition-colors",
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

        {/* Name + movement */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              "font-medium text-sm sm:text-[15px] truncate max-w-[140px] sm:max-w-none",
              isCurrentUser && "text-primary font-semibold"
            )}>
              {formatPlayerName(standing.employee)}
            </span>
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

        {/* Points + provision */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-right">
            <div className="font-mono text-sm sm:text-[15px] font-semibold whitespace-nowrap">
              {Number(standing.total_points).toLocaleString("da-DK", { maximumFractionDigits: 0 })} pt
            </div>
            <div className="text-[10px] text-muted-foreground">
              {Number(standing.total_provision).toLocaleString("da-DK", { maximumFractionDigits: 0 })} kr
            </div>
          </div>
          <div className="hidden sm:block text-right min-w-[50px]">
            <span className="text-sm text-muted-foreground">
              {standing.rounds_played} runder
            </span>
          </div>

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
