import { Link } from "react-router-dom";
import { Trophy, ArrowRight, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  useActiveSeason, 
  useMyEnrollment, 
  useQualificationStandings,
  useEnrollmentCount,
  type QualificationStanding 
} from "@/hooks/useLeagueData";
import { useCurrentEmployeeId } from "@/hooks/useOnboarding";
import { formatPlayerName } from "@/lib/formatPlayerName";

function getNeighborStandings(
  allStandings: QualificationStanding[],
  myEmployeeId: string | null
): { visibleStandings: QualificationStanding[]; myIndex: number } {
  if (!myEmployeeId || allStandings.length === 0) {
    return { visibleStandings: allStandings.slice(0, 3), myIndex: -1 };
  }

  const myIndex = allStandings.findIndex(s => s.employee_id === myEmployeeId);
  
  if (myIndex === -1) {
    return { visibleStandings: allStandings.slice(0, 3), myIndex: -1 };
  }

  const total = allStandings.length;
  
  if (total <= 5) {
    return { visibleStandings: allStandings, myIndex };
  }

  let start = myIndex - 2;
  let end = myIndex + 3;

  if (start < 0) {
    start = 0;
    end = Math.min(5, total);
  }
  
  if (end > total) {
    end = total;
    start = Math.max(0, total - 5);
  }

  return { 
    visibleStandings: allStandings.slice(start, end), 
    myIndex: myIndex - start
  };
}

export function CompactLeagueView() {
  const { data: season } = useActiveSeason();
  const { data: enrollment } = useMyEnrollment(season?.id);
  const isEnrolled = !!enrollment;
  const { data: currentEmployeeId } = useCurrentEmployeeId();
  const { data: allStandings = [] } = useQualificationStandings(season?.id);
  const { data: enrollmentCount = 0 } = useEnrollmentCount(season?.id);

  const formatProvision = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1: return "🥇";
      case 2: return "🥈";
      case 3: return "🥉";
      default: return null;
    }
  };

  if (!season) return null;

  const { visibleStandings, myIndex } = isEnrolled
    ? getNeighborStandings(allStandings, currentEmployeeId || null)
    : { visibleStandings: allStandings.slice(0, 3), myIndex: -1 };

  return (
    <Card className="border-0 shadow-lg bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Trophy className="w-4 h-4 text-yellow-500" />
            Din liga-position
          </CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>{enrollmentCount} tilmeldt</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {visibleStandings.length > 0 && (
          <div className="space-y-1">
            {visibleStandings.map((standing, index) => {
              const isMe = standing.employee_id === currentEmployeeId;
              const rank = standing.overall_rank || (index + 1);
              const medal = getMedalEmoji(rank);
              
              return (
                <div 
                  key={standing.id} 
                  className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-sm ${
                    isMe 
                      ? "bg-primary/10 border border-primary/20 font-medium" 
                      : "text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {medal ? (
                      <span className="text-base w-5 text-center">{medal}</span>
                    ) : (
                      <span className="text-xs font-medium w-5 text-center">
                        #{rank}
                      </span>
                    )}
                    <span className={isMe ? "text-foreground" : ""}>
                      {formatPlayerName(standing.employee)}
                      {isMe && <span className="text-primary ml-1">(dig)</span>}
                    </span>
                  </div>
                  <span className={`tabular-nums ${isMe ? "text-foreground" : ""}`}>
                    {formatProvision(standing.current_provision || 0)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        <Link to="/commission-league">
          <Button variant="outline" size="sm" className="w-full gap-2 mt-2">
            Se fuld liga
            <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
