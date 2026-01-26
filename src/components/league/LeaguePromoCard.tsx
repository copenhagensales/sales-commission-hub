import { Link } from "react-router-dom";
import { Trophy, ArrowRight, Users, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { 
  useActiveSeason, 
  useMyEnrollment, 
  useQualificationStandings,
  useEnrollmentCount,
  type QualificationStanding 
} from "@/hooks/useLeagueData";
import { useCurrentEmployeeId } from "@/hooks/useOnboarding";
import { formatPlayerName } from "@/lib/formatPlayerName";

interface NeighborResult {
  visibleStandings: QualificationStanding[];
  myIndex: number;
}

function getNeighborStandings(
  allStandings: QualificationStanding[],
  myEmployeeId: string | null
): NeighborResult {
  if (!myEmployeeId || allStandings.length === 0) {
    return { visibleStandings: allStandings.slice(0, 3), myIndex: -1 };
  }

  const myIndex = allStandings.findIndex(s => s.employee_id === myEmployeeId);
  
  // User not found in standings - show top 3
  if (myIndex === -1) {
    return { visibleStandings: allStandings.slice(0, 3), myIndex: -1 };
  }

  const total = allStandings.length;
  
  // If 5 or fewer participants, show all
  if (total <= 5) {
    return { visibleStandings: allStandings, myIndex };
  }

  // Calculate window: 2 above, user, 2 below (5 total)
  let start = myIndex - 2;
  let end = myIndex + 3; // exclusive

  // Adjust if at top
  if (start < 0) {
    start = 0;
    end = Math.min(5, total);
  }
  
  // Adjust if at bottom
  if (end > total) {
    end = total;
    start = Math.max(0, total - 5);
  }

  return { 
    visibleStandings: allStandings.slice(start, end), 
    myIndex: myIndex - start // Adjust index relative to visible slice
  };
}

export function LeaguePromoCard() {
  const { user } = useAuth();
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

  // Don't show if no active season
  if (!season) return null;

  // Get neighbor standings based on enrollment status
  const { visibleStandings, myIndex } = isEnrolled
    ? getNeighborStandings(allStandings, currentEmployeeId || null)
    : { visibleStandings: allStandings.slice(0, 3), myIndex: -1 };

  // Check if user is enrolled but not yet in standings
  const isEnrolledButNoStanding = isEnrolled && myIndex === -1 && allStandings.length > 0;

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-500/10 via-primary/5 to-orange-500/10 backdrop-blur-sm overflow-hidden relative">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
      
      <CardHeader className="pb-2 relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Salgsligaen
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30 text-[10px] font-bold animate-pulse">
              NY
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="w-4 h-4" />
            <span>{enrollmentCount} tilmeldt</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="relative z-10 space-y-4">
        {/* Standings display */}
        {visibleStandings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
              {isEnrolled && myIndex !== -1 ? "Din placering i ligaen" : "Top 3 lige nu"}
            </p>
            <div className="space-y-1.5">
              {visibleStandings.map((standing, index) => {
                const isMe = standing.employee_id === currentEmployeeId;
                const rank = standing.overall_rank || (index + 1);
                const medal = getMedalEmoji(rank);
                
                return (
                  <div 
                    key={standing.id} 
                    className={`flex items-center justify-between p-2 rounded-lg ${
                      isMe 
                        ? "bg-primary/10 border border-primary/20" 
                        : "bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Show medal for top 3, otherwise show rank number */}
                      {medal ? (
                        <span className="text-lg w-6 text-center">{medal}</span>
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground w-6 text-center">
                          #{rank}
                        </span>
                      )}
                      <span className="font-medium text-sm">
                        {formatPlayerName(standing.employee)}
                        {isMe && (
                          <span className="text-primary ml-1">(dig)</span>
                        )}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-foreground">
                      {formatProvision(standing.current_provision || 0)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Message for enrolled users not yet in standings */}
        {isEnrolledButNoStanding && (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground">
              Du er med! Standings opdateres snart ⏳
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="pt-2">
          <Link to="/commission-league">
            <Button className="w-full gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-semibold">
              {isEnrolled ? (
                <>
                  Se din position
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Tilmeld dig nu
                </>
              )}
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
