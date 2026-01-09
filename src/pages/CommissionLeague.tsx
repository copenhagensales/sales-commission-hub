import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users, Calendar, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePositionPermissions } from "@/hooks/usePositionPermissions";
import {
  useActiveSeason,
  useMyEnrollment,
  useQualificationStandings,
  useMyQualificationStanding,
  useEnrollInSeason,
  useEnrollmentCount,
} from "@/hooks/useLeagueData";
import { QualificationCountdown } from "@/components/league/QualificationCountdown";
import { QualificationBoard } from "@/components/league/QualificationBoard";
import { MyQualificationStatus } from "@/components/league/MyQualificationStatus";
import { SeasonSettingsDialog } from "@/components/league/SeasonSettingsDialog";
import { format } from "date-fns";
import { da } from "date-fns/locale";

export default function CommissionLeague() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const positionQuery = usePositionPermissions();
  const isOwner = positionQuery.data?.position?.name?.toLowerCase() === "ejer";
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | undefined>();
  const [isCalculating, setIsCalculating] = useState(false);

  // Fetch current employee ID
  useEffect(() => {
    const fetchEmployeeId = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (data) setCurrentEmployeeId(data.id);
    };
    fetchEmployeeId();
  }, [user?.id]);

  const { data: season, isLoading: seasonLoading } = useActiveSeason();
  const { data: enrollment, isLoading: enrollmentLoading } = useMyEnrollment(season?.id);
  const { data: standings, isLoading: standingsLoading, refetch: refetchStandings } = useQualificationStandings(season?.id);
  const { data: myStanding } = useMyQualificationStanding(season?.id);
  const { data: enrollmentCount } = useEnrollmentCount(season?.id);
  const enrollMutation = useEnrollInSeason();

  // Real-time subscription
  useEffect(() => {
    if (!season?.id) return;

    const channel = supabase
      .channel(`qualification-${season.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "league_qualification_standings",
          filter: `season_id=eq.${season.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["league-qualification-standings", season.id] });
          queryClient.invalidateQueries({ queryKey: ["league-my-qualification-standing", season.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [season?.id, queryClient]);

  const handleEnroll = async () => {
    if (!season?.id) return;
    try {
      await enrollMutation.mutateAsync(season.id);
      toast.success("Du er nu tilmeldt Cph Sales Ligaen! 🎉");
      // Trigger standings calculation
      handleCalculateStandings();
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke tilmelde");
    }
  };

  const handleCalculateStandings = async () => {
    if (!season?.id) return;
    setIsCalculating(true);
    try {
      const { error } = await supabase.functions.invoke("league-calculate-standings", {
        body: { seasonId: season.id },
      });
      if (error) throw error;
      await refetchStandings();
      toast.success("Stillinger opdateret!");
    } catch (error: any) {
      console.error("Calculate standings error:", error);
      // Don't show error if function doesn't exist yet
    } finally {
      setIsCalculating(false);
    }
  };

  const playersPerDivision = season?.config?.players_per_division || 10;

  if (seasonLoading || enrollmentLoading) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-slate-900 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  // No active season
  if (!season) {
    return (
      <MainLayout>
        <div className="min-h-screen bg-slate-900 p-6">
          <div className="max-w-4xl mx-auto">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700">
              <CardContent className="py-16 text-center">
                <Trophy className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
                <h1 className="text-2xl font-bold mb-2">Cph Sales Ligaen</h1>
                <p className="text-muted-foreground mb-6">
                  Der er ingen aktiv sæson lige nu. Kom tilbage senere!
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  const isQualificationPhase = season.status === "qualification";
  const isEnrolled = !!enrollment;

  return (
    <MainLayout>
      <div className="min-h-screen bg-slate-900 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 text-yellow-500" />
                <h1 className="text-2xl md:text-3xl font-bold">Cph Sales Ligaen</h1>
                <Badge variant="secondary">Sæson {season.season_number}</Badge>
              </div>
              <p className="text-muted-foreground mt-1">
                {isQualificationPhase ? "Kvalifikationsperiode" : "Sæson i gang"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isOwner && season && (
                <SeasonSettingsDialog season={season} />
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCalculateStandings}
                disabled={isCalculating}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isCalculating ? "animate-spin" : ""}`} />
                Opdater
              </Button>
              {isQualificationPhase && (
                <QualificationCountdown endDate={season.qualification_end_at} />
              )}
            </div>
          </div>

          {/* Not enrolled - show landing */}
          {!isEnrolled && (
            <Card className="bg-gradient-to-br from-primary/20 via-slate-800 to-slate-900 border-primary/30 overflow-hidden">
              <CardContent className="py-8">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">
                      🏆 Deltag i Cph Sales Ligaen!
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Kæmp mod dine kolleger i et spændende liga-system baseret på din provision.
                      Op- og nedrykning hver uge!
                    </p>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-primary" />
                        <span>10 spillere pr. division</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-primary" />
                        <span>Top 2 rykker op hver uge</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-primary" />
                        <span>#8 spiller duel mod #3 i divisionen under</span>
                      </div>
                    </div>

                    <Button
                      size="lg"
                      onClick={handleEnroll}
                      disabled={enrollMutation.isPending}
                    >
                      {enrollMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Trophy className="h-4 w-4 mr-2" />
                      )}
                      Tilmeld mig nu
                    </Button>
                  </div>

                  <div className="bg-slate-900/50 rounded-xl p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">Kvalifikationsperiode</span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      {format(new Date(season.qualification_source_start), "d. MMMM", { locale: da })}
                      {" → "}
                      {format(new Date(season.qualification_source_end), "d. MMMM yyyy", { locale: da })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Din provision i denne periode bestemmer hvilken division du starter i.
                    </p>

                    <div className="mt-6 pt-4 border-t border-slate-700">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tilmeldte spillere</span>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="font-bold">{enrollmentCount || 0}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enrolled - show dashboard */}
          {isEnrolled && (
            <>
              {/* My Status */}
              <MyQualificationStatus
                standing={myStanding || null}
                totalPlayers={standings?.length || 0}
                playersPerDivision={playersPerDivision}
              />

              {/* Leaderboard */}
              <Card className="bg-slate-800/30 border-slate-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Kvalifikations-stillingen</CardTitle>
                      <CardDescription>
                        Live opdatering • {standings?.length || 0} tilmeldte
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      Opdateret {standings?.[0]?.last_calculated_at
                        ? format(new Date(standings[0].last_calculated_at), "HH:mm", { locale: da })
                        : "-"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="all">
                    <TabsList className="mb-4">
                      <TabsTrigger value="all">Alle Divisioner</TabsTrigger>
                      <TabsTrigger value="my">Min Division</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all">
                      <QualificationBoard
                        standings={standings || []}
                        playersPerDivision={playersPerDivision}
                        isLoading={standingsLoading}
                        currentEmployeeId={currentEmployeeId}
                      />
                    </TabsContent>

                    <TabsContent value="my">
                      <QualificationBoard
                        standings={(standings || []).filter(
                          (s) => s.projected_division === myStanding?.projected_division
                        )}
                        playersPerDivision={playersPerDivision}
                        isLoading={standingsLoading}
                        currentEmployeeId={currentEmployeeId}
                      />
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}

          {/* Rules */}
          <Card className="bg-slate-800/30 border-slate-700">
            <CardHeader>
              <CardTitle className="text-lg">📋 Sådan fungerer det</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6">
                <div>
                  <h4 className="font-semibold mb-2 text-green-400">✅ Oprykning</h4>
                  <p className="text-sm text-muted-foreground">
                    Top 2 i hver division rykker automatisk op til divisionen over.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-orange-400">⚔️ Duel</h4>
                  <p className="text-sm text-muted-foreground">
                    #8 i en division spiller duel mod #3 i divisionen under. Vinderen spiller oppe.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-red-400">⬇️ Nedrykning</h4>
                  <p className="text-sm text-muted-foreground">
                    #9 og #10 rykker automatisk ned til divisionen under.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
