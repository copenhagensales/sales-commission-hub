import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUp, ArrowDown, Minus, Trophy, Medal, Award } from "lucide-react";
import { QualificationStanding } from "@/hooks/useLeagueData";
import { cn } from "@/lib/utils";
import { formatPlayerName } from "@/lib/formatPlayerName";

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

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="bg-slate-800/50 border-slate-700">
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
      <Card className="bg-slate-800/50 border-slate-700">
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
    <div className="space-y-4">
      {divisionGroups.map((group) => (
        <Card key={group.division} className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              {group.division === 1 ? (
                <>
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <span>Division 1 (Topliga)</span>
                </>
              ) : (
                <>
                  <Medal className="h-5 w-5 text-slate-400" />
                  <span>Division {group.division}</span>
                </>
              )}
              <Badge variant="secondary" className="ml-auto">
                {group.players.length}/{playersPerDivision}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {group.players.map((standing) => (
                <PlayerRow
                  key={standing.id}
                  standing={standing}
                  isCurrentUser={standing.employee_id === currentEmployeeId}
                  playersPerDivision={playersPerDivision}
                  isTopDivision={group.division === 1}
                  isBottomDivision={group.division === divisionGroups.length}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

interface PlayerRowProps {
  standing: QualificationStanding;
  isCurrentUser: boolean;
  playersPerDivision: number;
  isTopDivision: boolean;
  isBottomDivision: boolean;
}

function PlayerRow({
  standing,
  isCurrentUser,
  playersPerDivision,
  isTopDivision,
  isBottomDivision,
}: PlayerRowProps) {
  const rankChange = standing.previous_overall_rank !== null
    ? standing.previous_overall_rank - standing.overall_rank
    : 0;

  const getRankBadge = () => {
    if (standing.projected_rank === 1) {
      return <Trophy className="h-4 w-4 text-yellow-500" />;
    }
    if (standing.projected_rank === 2) {
      return <Medal className="h-4 w-4 text-slate-300" />;
    }
    if (standing.projected_rank === 3) {
      return <Award className="h-4 w-4 text-amber-600" />;
    }
    return null;
  };

  // Determine zone (for visual feedback)
  const getZoneClass = () => {
    if (isTopDivision && standing.projected_rank <= 2) {
      return "border-l-4 border-l-yellow-500/50"; // Top 2 in top division
    }
    if (!isTopDivision && standing.projected_rank <= 2) {
      return "border-l-4 border-l-green-500/50"; // Promotion zone
    }
    if (standing.projected_rank === playersPerDivision - 2) {
      return "border-l-4 border-l-orange-500/50"; // Duel zone
    }
    if (!isBottomDivision && standing.projected_rank >= playersPerDivision - 1) {
      return "border-l-4 border-l-red-500/50"; // Relegation zone
    }
    return "border-l-4 border-l-transparent";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
        isCurrentUser
          ? "bg-primary/10 ring-1 ring-primary/30"
          : "bg-slate-900/50 hover:bg-slate-900/80",
        getZoneClass()
      )}
    >
      {/* Rank */}
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 text-sm font-bold">
        {standing.projected_rank}
      </div>

      {/* Badge */}
      <div className="w-5">{getRankBadge()}</div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className={cn(
          "font-medium truncate block",
          isCurrentUser && "text-primary"
        )}>
          {formatPlayerName(standing.employee)}
          {isCurrentUser && <span className="text-xs ml-2">(dig)</span>}
        </span>
      </div>

      {/* Movement indicator */}
      <div className="w-6">
        {rankChange > 0 && (
          <div className="flex items-center text-green-500">
            <ArrowUp className="h-4 w-4" />
          </div>
        )}
        {rankChange < 0 && (
          <div className="flex items-center text-red-500">
            <ArrowDown className="h-4 w-4" />
          </div>
        )}
        {rankChange === 0 && standing.previous_overall_rank !== null && (
          <Minus className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Provision */}
      <div className="text-right min-w-[100px]">
        <span className="font-mono font-medium">
          {standing.current_provision.toLocaleString("da-DK")} kr
        </span>
      </div>

      {/* Deals */}
      <div className="text-right min-w-[50px] text-muted-foreground text-sm">
        {standing.deals_count} salg
      </div>
    </div>
  );
}
