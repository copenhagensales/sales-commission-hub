import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trophy, Users, BarChart3, Calendar, RefreshCw, Search, UserMinus, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";
import { useActiveSeason } from "@/hooks/useLeagueData";
import { SeasonSettingsDialog } from "@/components/league/SeasonSettingsDialog";

interface LeagueParticipant {
  enrollment_id: string;
  employee_id: string;
  enrolled_at: string;
  is_active: boolean;
  first_name: string;
  last_name: string;
  work_email: string | null;
  private_email: string | null;
  job_title: string | null;
  team_name: string | null;
  current_provision: number | null;
  deals_count: number | null;
  projected_division: number | null;
  projected_rank: number | null;
  overall_rank: number | null;
}

export default function LeagueAdminDashboard() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [isCalculating, setIsCalculating] = useState(false);

  const { data: activeSeason, isLoading: seasonLoading } = useActiveSeason();

  // Fetch all participants for the active season
  const { data: participants = [], isLoading: participantsLoading, refetch: refetchParticipants } = useQuery({
    queryKey: ["league-admin-participants", activeSeason?.id],
    queryFn: async () => {
      if (!activeSeason?.id) return [];

      const { data, error } = await supabase
        .from("league_enrollments")
        .select(`
          id,
          employee_id,
          enrolled_at,
          is_active
        `)
        .eq("season_id", activeSeason.id)
        .order("enrolled_at", { ascending: false });

      if (error) throw error;

      // Get employee details and standings for each enrollment
      const participantsWithDetails: LeagueParticipant[] = [];
      
      for (const enrollment of data || []) {
        // Get employee details
        const { data: employee } = await supabase
          .from("employee_master_data")
          .select("first_name, last_name, work_email, private_email, job_title, team_id")
          .eq("id", enrollment.employee_id)
          .single();

        // Get team name if team_id exists
        let teamName = null;
        if (employee?.team_id) {
          const { data: team } = await supabase
            .from("teams")
            .select("name")
            .eq("id", employee.team_id)
            .single();
          teamName = team?.name || null;
        }

        // Get standings
        const { data: standing } = await supabase
          .from("league_qualification_standings")
          .select("current_provision, deals_count, projected_division, projected_rank, overall_rank")
          .eq("employee_id", enrollment.employee_id)
          .eq("season_id", activeSeason.id)
          .single();

        participantsWithDetails.push({
          enrollment_id: enrollment.id,
          employee_id: enrollment.employee_id,
          enrolled_at: enrollment.enrolled_at,
          is_active: enrollment.is_active,
          first_name: employee?.first_name || "Ukendt",
          last_name: employee?.last_name || "",
          work_email: employee?.work_email || null,
          private_email: employee?.private_email || null,
          job_title: employee?.job_title || null,
          team_name: teamName,
          current_provision: standing?.current_provision || 0,
          deals_count: standing?.deals_count || 0,
          projected_division: standing?.projected_division || null,
          projected_rank: standing?.projected_rank || null,
          overall_rank: standing?.overall_rank || null,
        });
      }

      // Sort by overall_rank
      return participantsWithDetails.sort((a, b) => {
        if (a.overall_rank === null && b.overall_rank === null) return 0;
        if (a.overall_rank === null) return 1;
        if (b.overall_rank === null) return -1;
        return a.overall_rank - b.overall_rank;
      });
    },
    enabled: !!activeSeason?.id,
  });

  // Remove participant mutation
  const removeParticipantMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      // Get the enrollment to find employee_id
      const { data: enrollment } = await supabase
        .from("league_enrollments")
        .select("employee_id, season_id")
        .eq("id", enrollmentId)
        .single();

      if (!enrollment) throw new Error("Enrollment not found");

      // Soft delete enrollment
      const { error: enrollmentError } = await supabase
        .from("league_enrollments")
        .update({ is_active: false })
        .eq("id", enrollmentId);

      if (enrollmentError) throw enrollmentError;

      // Delete from standings
      const { error: standingsError } = await supabase
        .from("league_qualification_standings")
        .delete()
        .eq("employee_id", enrollment.employee_id)
        .eq("season_id", enrollment.season_id);

      if (standingsError) throw standingsError;
    },
    onSuccess: () => {
      toast.success("Spiller fjernet fra ligaen");
      queryClient.invalidateQueries({ queryKey: ["league-admin-participants"] });
    },
    onError: (error: Error) => {
      toast.error("Kunne ikke fjerne spiller: " + error.message);
    },
  });

  // Calculate standings
  const handleCalculateStandings = async () => {
    if (!activeSeason?.id) return;
    
    setIsCalculating(true);
    try {
      const { data, error } = await supabase.functions.invoke("league-calculate-standings", {
        body: { seasonId: activeSeason.id },
      });

      if (error) throw error;
      
      toast.success("Standings opdateret");
      refetchParticipants();
    } catch (error: any) {
      toast.error("Kunne ikke beregne standings: " + error.message);
    } finally {
      setIsCalculating(false);
    }
  };

  // Filter and search participants
  const filteredParticipants = useMemo(() => {
    return participants.filter((p) => {
      const matchesSearch = 
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.work_email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.private_email?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesDivision = 
        divisionFilter === "all" || 
        p.projected_division?.toString() === divisionFilter;
      
      return matchesSearch && matchesDivision;
    });
  }, [participants, searchTerm, divisionFilter]);

  // Calculate stats
  const stats = useMemo(() => {
    const activeParticipants = participants.filter(p => p.is_active);
    const divisions = new Set(activeParticipants.map(p => p.projected_division).filter(Boolean));
    
    return {
      totalEnrolled: participants.length,
      activeParticipants: activeParticipants.length,
      divisionsCount: divisions.size || Math.ceil(activeParticipants.length / 10),
    };
  }, [participants]);

  // Get unique divisions for filter
  const uniqueDivisions = useMemo(() => {
    const divisions = new Set(participants.map(p => p.projected_division).filter(Boolean));
    return Array.from(divisions).sort((a, b) => (a || 0) - (b || 0));
  }, [participants]);

  const formatPlayerName = (firstName: string, lastName: string) => {
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : "";
    return `${firstName} ${lastInitial}`;
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null || amount === undefined) return "0 kr";
    return new Intl.NumberFormat("da-DK", { style: "decimal" }).format(amount) + " kr";
  };

  const getSeasonStatus = () => {
    if (!activeSeason) return { label: "Ingen sæson", variant: "secondary" as const };
    
    const now = new Date();
    const qualStart = activeSeason.qualification_start_at ? new Date(activeSeason.qualification_start_at) : null;
    const qualEnd = activeSeason.qualification_end_at ? new Date(activeSeason.qualification_end_at) : null;
    
    if (qualStart && now < qualStart) {
      return { label: "Afventer start", variant: "secondary" as const };
    }
    if (qualEnd && now > qualEnd) {
      return { label: "Afsluttet", variant: "outline" as const };
    }
    if (qualStart && qualEnd && now >= qualStart && now <= qualEnd) {
      return { label: "Kvalifikation", variant: "default" as const };
    }
    return { label: "Aktiv", variant: "default" as const };
  };

  const seasonStatus = getSeasonStatus();
  const isLoading = seasonLoading || participantsLoading;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!activeSeason) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Trophy className="h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">Ingen aktiv sæson fundet</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Trophy className="h-6 w-6 text-yellow-500" />
              Liga Administration
            </h1>
            <p className="text-muted-foreground">
              Sæson {activeSeason.season_number} • <Badge variant={seasonStatus.variant}>{seasonStatus.label}</Badge>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleCalculateStandings}
              disabled={isCalculating}
            >
              {isCalculating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Genberegn standings
            </Button>
            <SeasonSettingsDialog season={activeSeason} />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tilmeldte i alt
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">{stats.totalEnrolled}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aktive spillere
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">{stats.activeParticipants}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Divisioner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold">{stats.divisionsCount}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Sæson status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-500" />
                <Badge variant={seasonStatus.variant} className="text-sm">
                  {seasonStatus.label}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Deltageroversigt</CardTitle>
            <CardDescription>
              Administrer alle tilmeldte spillere i ligaen
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Søg efter navn eller email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Alle divisioner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle divisioner</SelectItem>
                  {uniqueDivisions.map((div) => (
                    <SelectItem key={div} value={div?.toString() || ""}>
                      Division {div}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Participants Table */}
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">#</TableHead>
                    <TableHead>Spiller</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Job titel</TableHead>
                    <TableHead className="hidden lg:table-cell">Team</TableHead>
                    <TableHead className="text-center">Div</TableHead>
                    <TableHead className="text-right">Provision</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">Salg</TableHead>
                    <TableHead className="hidden md:table-cell">Tilmeldt</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="w-[100px]">Handling</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredParticipants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                        {searchTerm || divisionFilter !== "all" 
                          ? "Ingen spillere matcher søgningen"
                          : "Ingen tilmeldte spillere endnu"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredParticipants.map((participant, index) => (
                      <TableRow 
                        key={participant.enrollment_id}
                        className={!participant.is_active ? "opacity-50" : ""}
                      >
                        <TableCell className="font-medium">
                          {participant.overall_rank ? (
                            <span className="flex items-center gap-1">
                              {participant.overall_rank === 1 && "🥇"}
                              {participant.overall_rank === 2 && "🥈"}
                              {participant.overall_rank === 3 && "🥉"}
                              {participant.overall_rank > 3 && participant.overall_rank}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPlayerName(participant.first_name, participant.last_name)}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {participant.work_email || participant.private_email || "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {participant.job_title || "-"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {participant.team_name || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {participant.projected_division ? (
                            <Badge variant="outline">Div {participant.projected_division}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(participant.current_provision)}
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          {participant.deals_count || 0}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {format(new Date(participant.enrolled_at), "d. MMM yyyy", { locale: da })}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={participant.is_active ? "default" : "secondary"}>
                            {participant.is_active ? "Aktiv" : "Afmeldt"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {participant.is_active && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                >
                                  <UserMinus className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Fjern spiller fra ligaen?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Er du sikker på du vil fjerne {formatPlayerName(participant.first_name, participant.last_name)} fra ligaen? 
                                    Spilleren vil blive markeret som afmeldt og fjernet fra standings.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuller</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => removeParticipantMutation.mutate(participant.enrollment_id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Fjern spiller
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="text-sm text-muted-foreground">
              Viser {filteredParticipants.length} af {participants.length} deltagere
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
