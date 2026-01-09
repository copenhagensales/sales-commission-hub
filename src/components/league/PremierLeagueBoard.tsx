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
import { Trophy, Medal, TrendingUp, TrendingDown } from "lucide-react";
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
                    <TableHead className="text-center w-16">Salg</TableHead>
                    <TableHead className="text-right w-28">Provision</TableHead>
                    <TableHead className="text-right w-24">Gns/salg</TableHead>
                    <TableHead className="text-right w-24">Uge +/-</TableHead>
                    <TableHead className="text-center w-32">Seneste 5</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.players.map((standing, idx) => {
                    const isCurrentUser = standing.employee_id === currentEmployeeId;
                    const rankChange = standing.previous_overall_rank !== null
                      ? standing.previous_overall_rank - standing.overall_rank
                      : 0;

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
                            <TableCell colSpan={7} className="p-0">
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
                            isRelegationZone && !isCurrentUser && "bg-red-500/10 hover:bg-red-500/15"
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

                          {/* Player name with rank change */}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "font-medium",
                                isCurrentUser && "text-primary"
                              )}>
                                {standing.employee?.first_name} {standing.employee?.last_name}
                                {isCurrentUser && (
                                  <span className="text-xs text-muted-foreground ml-1">(dig)</span>
                                )}
                              </span>
                              {rankChange !== 0 && (
                                <span className={cn(
                                  "text-xs font-medium flex items-center gap-0.5",
                                  rankChange > 0 ? "text-green-500" : "text-red-500"
                                )}>
                                  {rankChange > 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  {Math.abs(rankChange)}
                                </span>
                              )}
                            </div>
                          </TableCell>

                          {/* Sales count */}
                          <TableCell className="text-center font-mono">
                            {standing.deals_count}
                          </TableCell>

                          {/* Provision */}
                          <TableCell className="text-right font-mono font-medium">
                            {standing.current_provision.toLocaleString("da-DK")}
                          </TableCell>

                          {/* Avg per deal */}
                          <TableCell className="text-right font-mono text-muted-foreground">
                            {standing.avg_per_deal.toLocaleString("da-DK")}
                          </TableCell>

                          {/* Weekly change */}
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-mono text-sm",
                              standing.weekly_change > 0 && "text-green-500",
                              standing.weekly_change < 0 && "text-red-500",
                              standing.weekly_change === 0 && "text-muted-foreground"
                            )}>
                              {standing.weekly_change > 0 && "+"}
                              {(standing.weekly_change / 1000).toFixed(1)}k
                            </span>
                          </TableCell>

                          {/* Form indicator */}
                          <TableCell>
                            <div className="flex justify-center">
                              <FormIndicator form={standing.recent_form} />
                            </div>
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
