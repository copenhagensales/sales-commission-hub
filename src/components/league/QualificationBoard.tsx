import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { QualificationStanding } from "@/hooks/useLeagueData";
import { cn } from "@/lib/utils";
import { formatPlayerName } from "@/lib/formatPlayerName";
import { PodiumBadge } from "./PodiumBadge";
import { ZoneLegend } from "./ZoneLegend";

interface QualificationBoardProps {
  standings: QualificationStanding[];
  playersPerDivision: number;
  isLoading: boolean;
  currentEmployeeId?: string;
}

export function QualificationBoard({
  standings,
  playersPerDivision,
  isLoading,
  currentEmployeeId,
}: QualificationBoardProps) {
  // Group standings by division
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

    // Sort by division number and players by rank
    groups.sort((a, b) => a.division - b.division);
    groups.forEach(g => g.players.sort((a, b) => a.projected_rank - b.projected_rank));

    return groups;
  }, [standings]);

  const totalDivisions = divisionGroups.length;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader className="pb-2 py-3">
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-0">
                {[1, 2, 3, 4, 5].map((j) => (
                  <Skeleton key={j} className="h-10 w-full rounded-none" />
                ))}
              </div>
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
          <p className="text-muted-foreground text-sm">
            Ingen tilmeldte spillere endnu. Vær den første!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {divisionGroups.map((group) => {
        const isTopDivision = group.division === 1;
        const isBottomDivision = group.division === totalDivisions;

        return (
          <Card key={group.division} className="bg-card border-border overflow-hidden shadow-sm">
            {/* Compact header */}
            <CardHeader className="py-2.5 px-3 sm:px-4 bg-muted/40 border-b">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base font-semibold">
                {isTopDivision ? (
                  <>
                    <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
                    <span className="truncate">Superligaen</span>
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

            {/* Mobile-optimized list view */}
            <CardContent className="p-0">
              <div className="divide-y divide-border/50">
                {group.players.map((standing, idx) => (
                  <PlayerRow
                    key={standing.id}
                    standing={standing}
                    isCurrentUser={standing.employee_id === currentEmployeeId}
                    playersPerDivision={playersPerDivision}
                    isTopDivision={isTopDivision}
                    isBottomDivision={isBottomDivision}
                    idx={idx}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Compact legend */}
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
}

function PlayerRow({
  standing,
  isCurrentUser,
  playersPerDivision,
  isTopDivision,
  isBottomDivision,
  idx,
}: PlayerRowProps) {
  const rankChange = standing.previous_overall_rank !== null
    ? standing.previous_overall_rank - standing.overall_rank
    : 0;

  // Zone calculations
  const isPromoZone = !isTopDivision && standing.projected_rank <= 2;
  const isTopZone = isTopDivision && standing.projected_rank <= 2;
  const isPlayoffZoneTop = !isTopDivision && standing.projected_rank === 3;
  const isPlayoffZoneBottom = standing.projected_rank === playersPerDivision - 2;
  const isPlayoffZone = isPlayoffZoneTop || isPlayoffZoneBottom;
  const isRelegationZone = !isBottomDivision && standing.projected_rank >= playersPerDivision - 1;

  const isPodium = standing.projected_rank <= 3;
  const podiumRank = standing.projected_rank as 1 | 2 | 3;

  // Zone separator
  const showDashedBefore = 
    (idx > 0 && standing.projected_rank === 3 && !isTopDivision) ||
    (idx > 0 && standing.projected_rank === playersPerDivision - 2) ||
    (idx > 0 && standing.projected_rank === playersPerDivision - 1 && !isPlayoffZoneBottom);

  return (
    <div>
      {/* Zone separator */}
      {showDashedBefore && (
        <div className="border-t-2 border-dashed border-muted-foreground/20" />
      )}
      
      {/* Player row - touch-friendly */}
      <div
        className={cn(
          "flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 min-h-[52px] transition-colors",
          // Current user highlight
          isCurrentUser && "bg-primary/10 border-l-[3px] border-l-primary",
          // Zone backgrounds
          !isCurrentUser && isPromoZone && "bg-green-500/8",
          !isCurrentUser && isTopZone && "bg-yellow-500/8",
          !isCurrentUser && isPlayoffZone && "bg-orange-500/8",
          !isCurrentUser && isRelegationZone && "bg-red-500/8"
        )}
      >
        {/* Rank column - fixed width */}
        <div className="flex items-center gap-1 w-8 sm:w-10 shrink-0 justify-center">
          {/* Zone indicator bar */}
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
            <PodiumBadge rank={podiumRank} className="scale-90 sm:scale-100" />
          ) : (
            <span className="text-sm font-bold text-muted-foreground w-5 text-center">
              {standing.projected_rank}
            </span>
          )}
        </div>

        {/* Main content - flexible */}
        <div className="flex-1 min-w-0">
          {/* Top row: Name + badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              "font-medium text-sm sm:text-[15px] truncate max-w-[140px] sm:max-w-none",
              isCurrentUser && "text-primary font-semibold"
            )}>
              {formatPlayerName(standing.employee)}
            </span>
            
            {isCurrentUser && (
              <span className="text-[10px] text-muted-foreground">(dig)</span>
            )}

            {/* Rank change */}
            {rankChange !== 0 && (
              <span className={cn(
                "text-xs font-semibold flex items-center",
                rankChange > 0 ? "text-green-500" : "text-red-500"
              )}>
                {rankChange > 0 ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                )}
                <span className="text-[11px]">{Math.abs(rankChange)}</span>
              </span>
            )}
          </div>

          {/* Bottom row: Team */}
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
              {standing.employee?.team_name || "Ingen team"}
            </Badge>
          </div>
        </div>

        {/* Right side: Provision + Status */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Provision */}
          <div className="text-right">
            <div className="font-mono text-sm sm:text-[15px] font-semibold whitespace-nowrap">
              {standing.current_provision.toLocaleString("da-DK")} kr
            </div>
            {/* Deals count on mobile */}
            <div className="text-[10px] text-muted-foreground sm:hidden">
              {standing.deals_count} salg
            </div>
          </div>

          {/* Deals - hidden on mobile */}
          <div className="hidden sm:block text-right min-w-[50px]">
            <span className="text-sm text-muted-foreground">
              {standing.deals_count} salg
            </span>
          </div>

          {/* Status badge - compact */}
          <div className="w-16 sm:w-20 text-right">
            {isPromoZone && (
              <Badge className="bg-green-500/20 text-green-600 border-green-500/30 text-[10px] px-1.5 py-0">
                Oprykker
              </Badge>
            )}
            {isTopZone && (
              <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 text-[10px] px-1.5 py-0">
                Top 2
              </Badge>
            )}
            {isPlayoffZone && (
              <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 text-[10px] px-1.5 py-0">
                Playoff
              </Badge>
            )}
            {isRelegationZone && (
              <Badge className="bg-red-500/20 text-red-600 border-red-500/30 text-[10px] px-1.5 py-0">
                Nedrykker
              </Badge>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
