import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Trophy, ArrowRight, Users, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveSeason, useMyEnrollment } from "@/hooks/useLeagueData";
import { formatPlayerName } from "@/lib/formatPlayerName";

export function LeaguePromoCard() {
  const { user } = useAuth();
  const { data: season } = useActiveSeason();
  const { data: enrollment } = useMyEnrollment(season?.id);
  const isEnrolled = !!enrollment;

  // Fetch current employee ID
  const { data: currentEmployeeId } = useQuery({
    queryKey: ["league-promo-employee-id"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_current_employee_id");
      if (error || !data) return null;
      return data as string;
    },
    enabled: !!user,
  });

  // Fetch top 3 standings
  const { data: topStandings = [] } = useQuery({
    queryKey: ["league-top-standings", season?.id],
    queryFn: async () => {
      if (!season?.id) return [];

      const { data } = await supabase
        .from("league_qualification_standings")
        .select("*, employee:employee_master_data(first_name, last_name)")
        .eq("season_id", season.id)
        .order("current_provision", { ascending: false })
        .limit(3);

      return data || [];
    },
    enabled: !!season?.id,
  });

  // Fetch user's own standing
  const { data: myStanding } = useQuery({
    queryKey: ["league-my-standing", season?.id, currentEmployeeId],
    queryFn: async () => {
      if (!season?.id || !currentEmployeeId) return null;

      const { data } = await supabase
        .from("league_qualification_standings")
        .select("*, employee:employee_master_data(first_name, last_name)")
        .eq("season_id", season.id)
        .eq("employee_id", currentEmployeeId)
        .maybeSingle();

      return data;
    },
    enabled: !!season?.id && !!currentEmployeeId,
  });

  // Fetch enrollment count
  const { data: enrollmentCount = 0 } = useQuery({
    queryKey: ["league-enrollment-count", season?.id],
    queryFn: async (): Promise<number> => {
      if (!season?.id) return 0;

      // Use raw query to avoid deep type instantiation issues
      const { count } = await (supabase
        .from("league_enrollments")
        .select("id", { count: "exact", head: true }) as any)
        .eq("season_id", season.id)
        .eq("status", "active");

      return count || 0;
    },
    enabled: !!season?.id,
  });

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

  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-yellow-500/10 via-primary/5 to-orange-500/10 backdrop-blur-sm overflow-hidden relative">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-xl translate-y-1/2 -translate-x-1/2" />
      
      <CardHeader className="pb-2 relative z-10">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg font-semibold">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Cph Sales Ligaen
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
        {/* Top 3 standings */}
        {topStandings.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Top 3 lige nu</p>
            <div className="space-y-1.5">
              {topStandings.map((standing: any, index: number) => (
                <div 
                  key={standing.id} 
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    standing.employee_id === currentEmployeeId 
                      ? "bg-primary/10 border border-primary/20" 
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getMedalEmoji(index + 1)}</span>
                    <span className="font-medium text-sm">
                      {formatPlayerName(standing.employee)}
                      {standing.employee_id === currentEmployeeId && (
                        <span className="text-primary ml-1">(dig)</span>
                      )}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    {formatProvision(standing.current_provision || 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User's standing if enrolled and not in top 3 */}
        {isEnrolled && myStanding && myStanding.projected_rank > 3 && (
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-2">Din placering</p>
            <div className="flex items-center justify-between p-2 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary">#{myStanding.projected_rank}</span>
                <span className="font-medium text-sm">{formatPlayerName(myStanding.employee)}</span>
              </div>
              <span className="text-sm font-semibold">{formatProvision(myStanding.current_provision || 0)}</span>
            </div>
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
