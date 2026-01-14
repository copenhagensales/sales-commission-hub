import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Clock, Swords, CheckCircle2, Users, TrendingUp } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { da } from "date-fns/locale";

interface H2HChallenge {
  id: string;
  status: string;
  period: string;
  target_commission: number | null;
  custom_start_at: string | null;
  custom_end_at: string | null;
  created_at: string;
  completed_at: string | null;
  is_draw: boolean;
  winner_employee_id: string | null;
  challenger_employee_id: string;
  opponent_employee_id: string;
  challenger_final_commission: number | null;
  opponent_final_commission: number | null;
  challenger: { id: string; first_name: string; last_name: string } | null;
  opponent: { id: string; first_name: string; last_name: string } | null;
}

interface TeamH2HOverviewProps {
  className?: string;
}

export const TeamH2HOverview = ({ className }: TeamH2HOverviewProps) => {
  const { user } = useAuth();

  // Get current employee ID
  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee-team-h2h", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const lowerEmail = user.email.toLowerCase();
      const { data } = await supabase
        .from("employee_master_data")
        .select("id")
        .or(`work_email.eq.${lowerEmail},private_email.ilike.${lowerEmail}`)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.email,
  });

  // Check if user is team leader or assistant
  const { data: teamsLed, isLoading: teamsLoading } = useQuery({
    queryKey: ["teams-led", currentEmployee?.id],
    queryFn: async () => {
      if (!currentEmployee?.id) return [];
      const { data } = await supabase
        .from("teams")
        .select("id, name, team_leader_id, assistant_team_leader_id")
        .or(`team_leader_id.eq.${currentEmployee.id},assistant_team_leader_id.eq.${currentEmployee.id}`);
      return data || [];
    },
    enabled: !!currentEmployee?.id,
  });

  // Get team member IDs
  const { data: teamMemberIds } = useQuery({
    queryKey: ["team-member-ids", teamsLed?.map(t => t.id)],
    queryFn: async () => {
      if (!teamsLed || teamsLed.length === 0) return [];
      const { data } = await supabase
        .from("team_members")
        .select("employee_id")
        .in("team_id", teamsLed.map(t => t.id));
      return [...new Set((data || []).map(m => m.employee_id))];
    },
    enabled: !!teamsLed && teamsLed.length > 0,
  });

  // Get H2H challenges for team members
  const { data: challenges, isLoading: challengesLoading } = useQuery({
    queryKey: ["team-h2h-challenges", teamMemberIds],
    queryFn: async () => {
      if (!teamMemberIds || teamMemberIds.length === 0) return [];
      
      // Build filter for team members
      const challengerFilter = teamMemberIds.map(id => `challenger_employee_id.eq.${id}`).join(",");
      const opponentFilter = teamMemberIds.map(id => `opponent_employee_id.eq.${id}`).join(",");
      
      const { data } = await supabase
        .from("h2h_challenges")
        .select(`
          id,
          status,
          period,
          target_commission,
          custom_start_at,
          custom_end_at,
          created_at,
          completed_at,
          is_draw,
          winner_employee_id,
          challenger_employee_id,
          opponent_employee_id,
          challenger_final_commission,
          opponent_final_commission,
          challenger:employee_basic_info!h2h_challenges_challenger_employee_id_fkey(id, first_name, last_name),
          opponent:employee_basic_info!h2h_challenges_opponent_employee_id_fkey(id, first_name, last_name)
        `)
        .or(`${challengerFilter},${opponentFilter}`)
        .order("created_at", { ascending: false })
        .limit(50);
      
      return (data || []) as H2HChallenge[];
    },
    enabled: !!teamMemberIds && teamMemberIds.length > 0,
  });

  const isLoading = teamsLoading || challengesLoading;

  // Separate challenges by status
  const activeMatches = challenges?.filter(c => c.status === "accepted") || [];
  const pendingMatches = challenges?.filter(c => c.status === "pending") || [];
  const completedMatches = challenges?.filter(c => c.status === "completed").slice(0, 10) || [];

  const getPeriodText = (challenge: H2HChallenge) => {
    if (challenge.period === "today") return "I dag";
    if (challenge.period === "week") return "Denne uge";
    if (challenge.period === "target") return `Først til ${challenge.target_commission?.toLocaleString("da-DK")} kr`;
    if (challenge.period === "custom" && challenge.custom_start_at && challenge.custom_end_at) {
      return `${format(new Date(challenge.custom_start_at), "d. MMM", { locale: da })} - ${format(new Date(challenge.custom_end_at), "d. MMM", { locale: da })}`;
    }
    return challenge.period;
  };

  const getResultBadge = (challenge: H2HChallenge) => {
    if (challenge.is_draw) {
      return <Badge variant="secondary">🤝 Uafgjort</Badge>;
    }
    const winner = challenge.winner_employee_id === challenge.challenger_employee_id
      ? challenge.challenger
      : challenge.opponent;
    return (
      <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
        🏆 {winner?.first_name} {winner?.last_name}
      </Badge>
    );
  };

  if (!teamsLed || teamsLed.length === 0) {
    return null; // Not a team leader
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const totalMatches = (challenges?.length || 0);

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Team H2H Overblik
          {totalMatches > 0 && (
            <Badge variant="secondary" className="ml-2">{totalMatches} kampe</Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          H2H-kampe for medarbejdere i {teamsLed.map(t => t.name).join(", ")}
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Active Matches */}
        {activeMatches.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-green-400">
              <Swords className="h-4 w-4" />
              Aktive kampe ({activeMatches.length})
            </h4>
            <div className="space-y-2">
              {activeMatches.map(match => (
                <div key={match.id} className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="font-medium">{match.challenger?.first_name} {match.challenger?.last_name}</span>
                      <span className="text-muted-foreground mx-2">vs</span>
                      <span className="font-medium">{match.opponent?.first_name} {match.opponent?.last_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{getPeriodText(match)}</span>
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <span className="text-green-400">{(match.challenger_final_commission || 0).toLocaleString("da-DK")} kr</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-blue-400">{(match.opponent_final_commission || 0).toLocaleString("da-DK")} kr</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Matches */}
        {pendingMatches.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-yellow-400">
              <Clock className="h-4 w-4" />
              Afventende ({pendingMatches.length})
            </h4>
            <div className="space-y-2">
              {pendingMatches.map(match => (
                <div key={match.id} className="flex items-center justify-between p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <div className="text-sm">
                    <span className="font-medium">{match.challenger?.first_name} {match.challenger?.last_name}</span>
                    <span className="text-muted-foreground mx-2">→</span>
                    <span className="font-medium">{match.opponent?.first_name} {match.opponent?.last_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">{getPeriodText(match)}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(match.created_at), { addSuffix: true, locale: da })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Matches */}
        {completedMatches.length > 0 && (
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Seneste resultater
            </h4>
            <div className="space-y-2">
              {completedMatches.map(match => (
                <div key={match.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="text-sm">
                    <span className={match.winner_employee_id === match.challenger_employee_id ? "font-bold text-green-400" : ""}>
                      {match.challenger?.first_name} {match.challenger?.last_name}
                    </span>
                    <span className="text-muted-foreground mx-2">vs</span>
                    <span className={match.winner_employee_id === match.opponent_employee_id ? "font-bold text-green-400" : ""}>
                      {match.opponent?.first_name} {match.opponent?.last_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      {(match.challenger_final_commission || 0).toLocaleString("da-DK")} - {(match.opponent_final_commission || 0).toLocaleString("da-DK")} kr
                    </span>
                    {getResultBadge(match)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalMatches === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Swords className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Ingen H2H-kampe i dit team endnu</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
