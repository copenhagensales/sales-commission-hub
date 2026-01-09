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
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Spiller</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right w-28">Provision</TableHead>
                    <TableHead className="text-center w-28">Form</TableHead>
                    <TableHead className="text-center w-28">Status</TableHead>
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
                    const isDuelZone = standing.projected_rank === playersPerDivision - 2;
                    const isRelegationZone = !isBottomDivision && standing.projected_rank >= playersPerDivision - 1;

                    // Show dashed separator before duel zone and relegation zone
                    const showDashedBefore = 
                      (idx > 0 && standing.projected_rank === playersPerDivision - 2) ||
                      (idx > 0 && standing.projected_rank === playersPerDivision - 1 && !isDuelZone);

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
                            isDuelZone && !isCurrentUser && "bg-orange-500/10 hover:bg-orange-500/15",
                            isRelegationZone && !isCurrentUser && "bg-red-500/10 hover:bg-red-500/15",
                            // Division movement highlight
                            justPromoted && "ring-2 ring-inset ring-green-500/40",
                            justRelegated && "ring-2 ring-inset ring-red-500/40"
                          )}
                        >
                          {/* Rank with zone indicator */}
                          <TableCell className="text-center font-bold">
                            <div className="flex items-center justify-center gap-1">
                              <div
                                className={cn(
                                  "w-1 h-6 rounded-full",
                                  isPromoZone && "bg-green-500",
                                  isTopZone && "bg-yellow-500",
                                  isDuelZone && "bg-orange-500",
                                  isRelegationZone && "bg-red-500",
                                  !isPromoZone && !isTopZone && !isDuelZone && !isRelegationZone && "bg-transparent"
                                )}
                              />
                              <span>{standing.projected_rank}</span>
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
                              
                              {/* Division movement badge */}
                              {justPromoted && (
                                <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs px-1.5 py-0.5 animate-pulse">
                                  <ArrowUp className="h-3 w-3 mr-0.5" />
                                  Div {standing.previous_division}
                                </Badge>
                              )}
                              {justRelegated && (
                                <Badge className="bg-red-600 hover:bg-red-600 text-white text-xs px-1.5 py-0.5 animate-pulse">
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
                            </div>
                          </TableCell>

                          {/* Team badge */}
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {standing.employee?.team_name || "Ingen team"}
                            </Badge>
                          </TableCell>

                          {/* Provision */}
                          <TableCell className="text-right font-mono font-medium">
                            {standing.current_provision.toLocaleString("da-DK")} kr
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
                            {isDuelZone && (
                              <Badge className="bg-orange-500/20 text-orange-600 border-orange-500/30 hover:bg-orange-500/30">
                                Duel
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
