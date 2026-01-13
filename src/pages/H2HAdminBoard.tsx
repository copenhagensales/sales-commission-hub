import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays, startOfDay } from "date-fns";
import { da } from "date-fns/locale";
import { Users, Swords, Trophy, Clock, TrendingUp, Activity } from "lucide-react";

interface Challenge {
  id: string;
  challenger_name: string;
  opponent_name: string;
  status: string;
  period: string;
  battle_mode: string;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  is_draw: boolean;
  winner_name: string | null;
}

interface UserStats {
  employee_id: string;
  employee_name: string;
  challenges_sent: number;
  challenges_received: number;
  total_matches: number;
  wins: number;
  losses: number;
  draws: number;
  last_activity: string;
}

export default function H2HAdminBoard() {
  // Fetch all challenges with employee names
  const { data: challenges, isLoading: challengesLoading } = useQuery({
    queryKey: ["h2h-admin-challenges"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("h2h_challenges")
        .select(`
          id,
          status,
          period,
          battle_mode,
          created_at,
          accepted_at,
          completed_at,
          is_draw,
          winner_employee_id,
          challenger_employee_id,
          opponent_employee_id
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Get unique employee IDs
      const employeeIds = new Set<string>();
      data?.forEach((c) => {
        if (c.challenger_employee_id) employeeIds.add(c.challenger_employee_id);
        if (c.opponent_employee_id) employeeIds.add(c.opponent_employee_id);
        if (c.winner_employee_id) employeeIds.add(c.winner_employee_id);
      });

      // Fetch employee names
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", Array.from(employeeIds));

      const employeeMap = new Map<string, string>();
      employees?.forEach((e) => {
        employeeMap.set(e.id, `${e.first_name} ${e.last_name}`);
      });

      return data?.map((c): Challenge => ({
        id: c.id,
        challenger_name: employeeMap.get(c.challenger_employee_id) || "Ukendt",
        opponent_name: employeeMap.get(c.opponent_employee_id) || "Ukendt",
        status: c.status,
        period: c.period || "today",
        battle_mode: c.battle_mode || "1v1",
        created_at: c.created_at,
        accepted_at: c.accepted_at,
        completed_at: c.completed_at,
        is_draw: c.is_draw || false,
        winner_name: c.winner_employee_id ? employeeMap.get(c.winner_employee_id) || null : null,
      }));
    },
  });

  // Fetch user stats
  const { data: userStats, isLoading: statsLoading } = useQuery({
    queryKey: ["h2h-admin-user-stats"],
    queryFn: async () => {
      const { data: allChallenges, error } = await supabase
        .from("h2h_challenges")
        .select("challenger_employee_id, opponent_employee_id, status, winner_employee_id, is_draw, created_at, completed_at");

      if (error) throw error;

      // Get unique employee IDs
      const employeeIds = new Set<string>();
      allChallenges?.forEach((c) => {
        if (c.challenger_employee_id) employeeIds.add(c.challenger_employee_id);
        if (c.opponent_employee_id) employeeIds.add(c.opponent_employee_id);
      });

      // Fetch employee names
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .in("id", Array.from(employeeIds));

      const employeeMap = new Map<string, string>();
      employees?.forEach((e) => {
        employeeMap.set(e.id, `${e.first_name} ${e.last_name}`);
      });

      // Calculate stats per user
      const statsMap = new Map<string, UserStats>();

      for (const challenge of allChallenges || []) {
        const challengerId = challenge.challenger_employee_id;
        const opponentId = challenge.opponent_employee_id;

        // Initialize challenger stats
        if (challengerId && !statsMap.has(challengerId)) {
          statsMap.set(challengerId, {
            employee_id: challengerId,
            employee_name: employeeMap.get(challengerId) || "Ukendt",
            challenges_sent: 0,
            challenges_received: 0,
            total_matches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            last_activity: challenge.created_at,
          });
        }

        // Initialize opponent stats
        if (opponentId && !statsMap.has(opponentId)) {
          statsMap.set(opponentId, {
            employee_id: opponentId,
            employee_name: employeeMap.get(opponentId) || "Ukendt",
            challenges_sent: 0,
            challenges_received: 0,
            total_matches: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            last_activity: challenge.created_at,
          });
        }

        // Update challenger stats
        if (challengerId) {
          const stats = statsMap.get(challengerId)!;
          stats.challenges_sent++;
          if (new Date(challenge.created_at) > new Date(stats.last_activity)) {
            stats.last_activity = challenge.created_at;
          }

          if (challenge.completed_at) {
            stats.total_matches++;
            if (challenge.is_draw) {
              stats.draws++;
            } else if (challenge.winner_employee_id === challengerId) {
              stats.wins++;
            } else if (challenge.winner_employee_id) {
              stats.losses++;
            }
          }
        }

        // Update opponent stats
        if (opponentId) {
          const stats = statsMap.get(opponentId)!;
          stats.challenges_received++;
          if (new Date(challenge.created_at) > new Date(stats.last_activity)) {
            stats.last_activity = challenge.created_at;
          }

          if (challenge.completed_at) {
            stats.total_matches++;
            if (challenge.is_draw) {
              stats.draws++;
            } else if (challenge.winner_employee_id === opponentId) {
              stats.wins++;
            } else if (challenge.winner_employee_id) {
              stats.losses++;
            }
          }
        }
      }

      return Array.from(statsMap.values()).sort((a, b) => 
        (b.challenges_sent + b.challenges_received) - (a.challenges_sent + a.challenges_received)
      );
    },
  });

  // Calculate summary stats
  const today = startOfDay(new Date());
  const last7Days = subDays(today, 7);
  
  const totalChallenges = challenges?.length || 0;
  const activeChallenges = challenges?.filter(c => c.status === "accepted" && !c.completed_at).length || 0;
  const completedChallenges = challenges?.filter(c => c.completed_at).length || 0;
  const uniqueUsers = userStats?.length || 0;
  const challengesToday = challenges?.filter(c => new Date(c.created_at) >= today).length || 0;
  const challengesLast7Days = challenges?.filter(c => new Date(c.created_at) >= last7Days).length || 0;

  const getStatusBadge = (status: string, completed: boolean) => {
    if (completed) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Afsluttet</Badge>;
    }
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Afventer</Badge>;
      case "accepted":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Aktiv</Badge>;
      case "declined":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Afvist</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPeriodLabel = (period: string) => {
    switch (period) {
      case "today": return "I dag";
      case "week": return "Uge";
      case "target": return "Mål";
      case "custom": return "Brugerdefineret";
      default: return period;
    }
  };

  if (challengesLoading || statsLoading) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6 space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Swords className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Head to Head Admin</h1>
            <p className="text-muted-foreground">Overblik over H2H aktivitet</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Brugere</span>
              </div>
              <p className="text-2xl font-bold mt-1">{uniqueUsers}</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Swords className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Total kampe</span>
              </div>
              <p className="text-2xl font-bold mt-1">{totalChallenges}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-400" />
                <span className="text-sm text-muted-foreground">Aktive</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-blue-400">{activeChallenges}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-green-400" />
                <span className="text-sm text-muted-foreground">Afsluttede</span>
              </div>
              <p className="text-2xl font-bold mt-1 text-green-400">{completedChallenges}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">I dag</span>
              </div>
              <p className="text-2xl font-bold mt-1">{challengesToday}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Sidste 7 dage</span>
              </div>
              <p className="text-2xl font-bold mt-1">{challengesLast7Days}</p>
            </CardContent>
          </Card>
        </div>

        {/* User Stats Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mest aktive brugere
            </CardTitle>
            <CardDescription>
              Brugere sorteret efter aktivitet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Navn</TableHead>
                  <TableHead className="text-center">Sendt</TableHead>
                  <TableHead className="text-center">Modtaget</TableHead>
                  <TableHead className="text-center">Kampe</TableHead>
                  <TableHead className="text-center">W/L/D</TableHead>
                  <TableHead>Sidste aktivitet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userStats?.slice(0, 20).map((user) => (
                  <TableRow key={user.employee_id}>
                    <TableCell className="font-medium">{user.employee_name}</TableCell>
                    <TableCell className="text-center">{user.challenges_sent}</TableCell>
                    <TableCell className="text-center">{user.challenges_received}</TableCell>
                    <TableCell className="text-center">{user.total_matches}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-green-400">{user.wins}</span>
                      {" / "}
                      <span className="text-red-400">{user.losses}</span>
                      {" / "}
                      <span className="text-muted-foreground">{user.draws}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.last_activity), "d. MMM HH:mm", { locale: da })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Challenges Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Swords className="h-5 w-5" />
              Seneste kampe
            </CardTitle>
            <CardDescription>
              De 100 seneste H2H udfordringer
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Udfordrer</TableHead>
                  <TableHead>Modstander</TableHead>
                  <TableHead>Periode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vinder</TableHead>
                  <TableHead>Oprettet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {challenges?.map((challenge) => (
                  <TableRow key={challenge.id}>
                    <TableCell className="font-medium">{challenge.challenger_name}</TableCell>
                    <TableCell>{challenge.opponent_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getPeriodLabel(challenge.period)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(challenge.status, !!challenge.completed_at)}
                    </TableCell>
                    <TableCell>
                      {challenge.completed_at ? (
                        challenge.is_draw ? (
                          <span className="text-muted-foreground">Uafgjort</span>
                        ) : (
                          <span className="text-green-400 font-medium">{challenge.winner_name || "-"}</span>
                        )
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(challenge.created_at), "d. MMM HH:mm", { locale: da })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
