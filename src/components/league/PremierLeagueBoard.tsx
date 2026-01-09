import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trophy, Medal, ArrowUpRight, ArrowDownRight, ArrowUp, ArrowDown } from "lucide-react";
import { MockQualificationStanding } from "@/lib/mockLeagueData";
import { FormIndicator } from "./FormIndicator";
import { ZoneLegend } from "./ZoneLegend";
import { PodiumBadge } from "./PodiumBadge";
import { MvpBadge } from "./MvpBadge";
import { ProgressRing } from "./ProgressRing";
import { PersonalBestBadge } from "./PersonalBestBadge";
import { DistanceToZone } from "./DistanceToZone";
import { RivalryIndicator } from "./RivalryIndicator";
import { cn } from "@/lib/utils";

interface PremierLeagueBoardProps {
  standings: MockQualificationStanding[];
  playersPerDivision: number;
  isLoading: boolean;
  currentEmployeeId?: string;
}

export function PremierLeagueBoard({
  standings,
  playersPerDivision,
  isLoading,
  currentEmployeeId,
}: PremierLeagueBoardProps) {
  // Group standings by division
  const divisionGroups = useMemo(() => {
    const groups: { division: number; players: MockQualificationStanding[] }[] = [];
    
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

  // Helper to get rivalry data for current user
  const getRivalryData = (players: MockQualificationStanding[], currentIndex: number) => {
    if (currentIndex < 0) return { above: null, below: null };
    
    const current = players[currentIndex];
    const above = currentIndex > 0 ? players[currentIndex - 1] : null;
    const below = currentIndex < players.length - 1 ? players[currentIndex + 1] : null;

    return {
      above: above ? {
        name: `${above.employee?.first_name} ${above.employee?.last_name}`,
        provision: above.current_provision,
        gap: above.current_provision - current.current_provision,
      } : null,
      below: below ? {
        name: `${below.employee?.first_name} ${below.employee?.last_name}`,
        provision: below.current_provision,
        gap: current.current_provision - below.current_provision,
      } : null,
    };
  };

  // Helper to get zone provision thresholds
  const getZoneThresholds = (
    players: MockQualificationStanding[], 
    currentIndex: number,
    isTopDivision: boolean,
    isBottomDivision: boolean
  ) => {
    if (currentIndex < 0) return { nextZone: null, prevZone: null, zoneType: "safe" as const };

    const rank = players[currentIndex].projected_rank;
    
    // Determine current zone and targets
    let zoneType: "promo" | "safe" | "playoff" | "relegation" | "top" = "safe";
    let nextZoneProvision: number | null = null;
    let prevZoneProvision: number | null = null;

    if (isTopDivision && rank <= 2) {
      zoneType = "top";
    } else if (!isTopDivision && rank <= 2) {
      zoneType = "promo";
    } else if (!isTopDivision && rank === 3) {
      // Playoff top - target is promo zone (rank 2)
      zoneType = "playoff";
      if (players[1]) nextZoneProvision = players[1].current_provision;
    } else if (rank === playersPerDivision - 2) {
      // Playoff bottom - target is safe zone
      zoneType = "playoff";
      if (players[playersPerDivision - 4]) nextZoneProvision = players[playersPerDivision - 4].current_provision;
    } else if (!isBottomDivision && rank >= playersPerDivision - 1) {
      // Relegation zone - target is playoff or safe zone
      zoneType = "relegation";
      if (players[playersPerDivision - 3]) nextZoneProvision = players[playersPerDivision - 3].current_provision;
    } else {
      // Safe zone - show distance to promo
      if (!isTopDivision && players[2]) {
        nextZoneProvision = players[2].current_provision;
      }
      // Buffer before falling into playoff/relegation
      if (players[playersPerDivision - 3]) {
        prevZoneProvision = players[playersPerDivision - 3].current_provision;
      }
    }

    return { nextZone: nextZoneProvision, prevZone: prevZoneProvision, zoneType };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {[1, 2].map((i) => (
          <Card key={i} className="bg-card border-border">
            <CardHeader className="pb-2">
              <Skeleton className="h-6 w-40" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((j) => (
                  <Skeleton key={j} className="h-12 w-full" />
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
        <CardContent className="py-12 text-center">
          <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Ingen tilmeldte spillere endnu. Vær den første!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {divisionGroups.map((group) => {
        const isTopDivision = group.division === 1;
        const isBottomDivision = group.division === totalDivisions;
        const currentUserIndex = group.players.findIndex(p => p.employee_id === currentEmployeeId);

        return (
          <Card key={group.division} className="bg-card border-border overflow-hidden">
            <CardHeader className="pb-3 bg-muted/30">
              <CardTitle className="flex items-center gap-2 text-lg">
                {isTopDivision ? (
                  <>
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    <span>Division 1 - Topliga</span>
                  </>
                ) : (
                  <>
                    <Medal className="h-5 w-5 text-muted-foreground" />
                    <span>Division {group.division}</span>
                  </>
                )}
                <Badge variant="secondary" className="ml-auto">
                  {group.players.length}/{playersPerDivision}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-2">
                    <TableHead className="w-14 text-center">#</TableHead>
                    <TableHead>Spiller</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right w-32">Provision</TableHead>
                    <TableHead className="text-center w-24">Form</TableHead>
                    <TableHead className="text-center w-24">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.players.map((standing, idx) => {
                    const isCurrentUser = standing.employee_id === currentEmployeeId;
                    const rankChange = standing.previous_overall_rank !== null
                      ? standing.previous_overall_rank - standing.overall_rank
                      : 0;

                    // Division movement detection
                    const divisionChange = standing.previous_division !== null
                      ? standing.previous_division - standing.projected_division
                      : 0;
                    const justPromoted = divisionChange > 0;  // Kom fra lavere division (højere nummer)
                    const justRelegated = divisionChange < 0; // Kom fra højere division (lavere nummer)

                    // Zone determination
                    const isPromoZone = !isTopDivision && standing.projected_rank <= 2;
                    const isTopZone = isTopDivision && standing.projected_rank <= 2;
                    const isPlayoffZoneTop = !isTopDivision && standing.projected_rank === 3; // Top playoff
                    const isPlayoffZoneBottom = standing.projected_rank === playersPerDivision - 2; // Bottom playoff
                    const isPlayoffZone = isPlayoffZoneTop || isPlayoffZoneBottom;
                    const isRelegationZone = !isBottomDivision && standing.projected_rank >= playersPerDivision - 1;

                    // Podium for top 3
                    const isPodium = standing.projected_rank <= 3;
                    const podiumRank = standing.projected_rank as 1 | 2 | 3;

                    // Personal best check
                    const isPersonalBest = standing.current_provision > standing.personal_best_provision;

                    // Show dashed separator before playoff zones and relegation zone
                    const showDashedBefore = 
                      (idx > 0 && standing.projected_rank === 3 && !isTopDivision) ||
                      (idx > 0 && standing.projected_rank === playersPerDivision - 2) ||
                      (idx > 0 && standing.projected_rank === playersPerDivision - 1 && !isPlayoffZoneBottom);

                    // Get rivalry and zone data for current user
                    const rivalry = isCurrentUser ? getRivalryData(group.players, idx) : null;
                    const zoneData = isCurrentUser 
                      ? getZoneThresholds(group.players, idx, isTopDivision, isBottomDivision) 
                      : null;

                    return (
                      <>
                        {showDashedBefore && (
                          <TableRow key={`sep-${standing.id}`} className="hover:bg-transparent h-0">
                            <TableCell colSpan={6} className="p-0">
                              <div className="border-t-2 border-dashed border-muted-foreground/30" />
                            </TableCell>
                          </TableRow>
                        )}
                        <TableRow
                          key={standing.id}
                          className={cn(
                            "transition-colors",
                            isCurrentUser && "bg-primary/10 hover:bg-primary/15",
                            isPromoZone && !isCurrentUser && "bg-green-500/10 hover:bg-green-500/15",
                            isTopZone && !isCurrentUser && "bg-yellow-500/10 hover:bg-yellow-500/15",
                            isPlayoffZone && !isCurrentUser && "bg-orange-500/10 hover:bg-orange-500/15",
                            isRelegationZone && !isCurrentUser && "bg-red-500/10 hover:bg-red-500/15",
                            // Danger zone pulse for relegation
                            isRelegationZone && "animate-[pulse_3s_ease-in-out_infinite] ring-1 ring-red-500/30",
                            // Division movement highlight
                            justPromoted && "ring-2 ring-inset ring-green-500/40",
                            justRelegated && "ring-2 ring-inset ring-red-500/40"
                          )}
                        >
                          {/* Rank with zone indicator and progress ring */}
                          <TableCell className="text-center font-bold">
                            <div className="flex items-center justify-center gap-1">
                              <div
                                className={cn(
                                  "w-1 h-6 rounded-full",
                                  isPromoZone && "bg-green-500",
                                  isTopZone && "bg-yellow-500",
                                  isPlayoffZone && "bg-orange-500",
                                  isRelegationZone && "bg-red-500",
                                  !isPromoZone && !isTopZone && !isPlayoffZone && !isRelegationZone && "bg-transparent"
                                )}
                              />
                              {isPodium ? (
                                <PodiumBadge rank={podiumRank} />
                              ) : (
                                <ProgressRing 
                                  rank={standing.projected_rank} 
                                  total={playersPerDivision} 
                                />
                              )}
                            </div>
                          </TableCell>

                          {/* Player name with division movement and rank change */}
                          <TableCell>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn(
                                "font-medium",
                                isCurrentUser && "text-primary"
                              )}>
                                {standing.employee?.first_name} {standing.employee?.last_name}
                                {isCurrentUser && (
                                  <span className="text-xs text-muted-foreground ml-1">(dig)</span>
                                )}
                              </span>
                              
                              {/* MVP Badges */}
                              {standing.is_mvp_overall && <MvpBadge type="overall" />}
                              {standing.is_mvp_division && !standing.is_mvp_overall && <MvpBadge type="division" />}
                              
                              {/* Personal Best Badge */}
                              {isPersonalBest && (
                                <PersonalBestBadge 
                                  currentProvision={standing.current_provision}
                                  previousBest={standing.personal_best_provision}
                                />
                              )}
                              
                              {/* Division movement badge */}
                              {justPromoted && (
                                <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs px-1.5 py-0.5">
                                  <ArrowUp className="h-3 w-3 mr-0.5" />
                                  Div {standing.previous_division}
                                </Badge>
                              )}
                              {justRelegated && (
                                <Badge className="bg-red-600 hover:bg-red-600 text-white text-xs px-1.5 py-0.5">
                                  <ArrowDown className="h-3 w-3 mr-0.5" />
                                  Div {standing.previous_division}
                                </Badge>
                              )}
                              
                              {/* Rank change indicator */}
                              {rankChange !== 0 && (
                                <span className={cn(
                                  "text-sm font-medium flex items-center gap-0.5",
                                  rankChange > 0 ? "text-green-500" : "text-red-500"
                                )}>
                                  {rankChange > 0 ? (
                                    <ArrowUpRight className="h-4 w-4" />
                                  ) : (
                                    <ArrowDownRight className="h-4 w-4" />
                                  )}
                                  {Math.abs(rankChange)}
                                </span>
                              )}

                              {/* Rivalry indicator for current user */}
                              {isCurrentUser && rivalry && (
                                <RivalryIndicator above={rivalry.above} below={rivalry.below} />
                              )}
                            </div>
                          </TableCell>

                          {/* Team badge */}
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {standing.employee?.team_name || "Ingen team"}
                            </Badge>
                          </TableCell>

                          {/* Provision with distance to zone for current user */}
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span className="font-mono font-medium">
                                {standing.current_provision.toLocaleString("da-DK")} kr
                              </span>
                              {isCurrentUser && zoneData && (
                                <DistanceToZone
                                  currentProvision={standing.current_provision}
                                  nextZoneProvision={zoneData.nextZone}
                                  prevZoneProvision={zoneData.prevZone}
                                  zoneType={zoneData.zoneType}
                                />
                              )}
                            </div>
                          </TableCell>

                          {/* Form indicator */}
                          <TableCell>
                            <div className="flex justify-center">
                              <FormIndicator form={standing.recent_form} />
                            </div>
                          </TableCell>

                          {/* Status badge */}
                          <TableCell className="text-center">
                            {isPromoZone && (
                              <Badge className="bg-green-500/20 text-green-600 border-green-500/30 hover:bg-green-500/30">
                                Oprykker
                              </Badge>
                            )}
                            {isTopZone && (
                              <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30 hover:bg-yellow-500/30">
                                Top 2
                              </Badge>
                            )}
                            {isPlayoffZone && (
                              <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 hover:bg-orange-500/30">
                                Playoff
                              </Badge>
                            )}
                            {isRelegationZone && (
                              <Badge className="bg-red-500/20 text-red-600 border-red-500/30 hover:bg-red-500/30">
                                Nedrykker
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}

      {/* Zone Legend */}
      <ZoneLegend className="mt-4 px-2" />
    </div>
  );
}
