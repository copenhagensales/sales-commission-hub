import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users, Calendar, ChevronRight, ChevronLeft, Loader2, Eye, AlertTriangle, Sparkles } from "lucide-react";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import {
  useActiveSeason,
  useMyEnrollment,
  useQualificationStandings,
  useMyQualificationStanding,
  useEnrollInSeason,
  useUnenrollFromSeason,
  useUnenrollAndBecomeFan,
  useEnrollmentCount,
  useEnrollAsFan,
  NON_PARTICIPATING_ROLES,
} from "@/hooks/useLeagueData";
import {
  useCurrentRound,
  useSeasonStandings,
  useRoundStandings,
  useRoundHistory,
  useMySeasonStanding,
} from "@/hooks/useLeagueActiveData";
import { usePrizeLeaders } from "@/hooks/useLeaguePrizeData";
import { PrizeShowcase } from "@/components/league/PrizeShowcase";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { QualificationCountdown } from "@/components/league/QualificationCountdown";
import { QualificationBoard } from "@/components/league/QualificationBoard";
import { MyQualificationStatus } from "@/components/league/MyQualificationStatus";

import { ActiveSeasonBoard } from "@/components/league/ActiveSeasonBoard";
import { RoundResultsCard } from "@/components/league/RoundResultsCard";
import { LeagueStickyBar } from "@/components/league/LeagueStickyBar";
import { LeagueRulesSheet } from "@/components/league/LeagueRulesSheet";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { getRandomQuote, getPerformanceStatus } from "@/lib/gamification-quotes";

export default function CommissionLeague() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { role } = useUnifiedPermissions();
  const canParticipate = !NON_PARTICIPATING_ROLES.includes(role);
  const [currentEmployeeId, setCurrentEmployeeId] = useState<string | undefined>();
  const [isCalculating, setIsCalculating] = useState(false);
  const [stickyVisible, setStickyVisible] = useState(false);
  const headerRef = useRef<HTMLDivElement>(null);

  // Show sticky bar when header scrolls out of view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting),
      { threshold: 0 }
    );
    const el = headerRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, []);

  // Fetch current employee ID using robust RPC with email fallback
  useEffect(() => {
    const fetchEmployeeId = async () => {
      const { data, error } = await supabase.rpc("get_current_employee_id");
      if (!error && data) {
        setCurrentEmployeeId(data);
      }
    };
    fetchEmployeeId();
  }, []);

  const { data: season, isLoading: seasonLoading } = useActiveSeason();
  const { data: enrollment, isLoading: enrollmentLoading } = useMyEnrollment(season?.id);
  const { data: standings, isLoading: standingsLoading, refetch: refetchStandings } = useQualificationStandings(season?.id);
  const { data: myStanding } = useMyQualificationStanding(season?.id);
  const { data: enrollmentCount } = useEnrollmentCount(season?.id);
  const enrollMutation = useEnrollInSeason();
  const unenrollMutation = useUnenrollFromSeason();
  const unenrollAndFanMutation = useUnenrollAndBecomeFan();
  const fanMutation = useEnrollAsFan();

  // Active season hooks
  const { data: currentRound } = useCurrentRound(season?.status === "active" ? season?.id : undefined);
  const { data: seasonStandings, isLoading: seasonStandingsLoading } = useSeasonStandings(season?.status === "active" ? season?.id : undefined);
  const { data: roundHistory } = useRoundHistory(season?.status === "active" ? season?.id : undefined);
  const { data: mySeasonStanding } = useMySeasonStanding(season?.status === "active" ? season?.id : undefined);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState(-1); // -1 = "Samlet stilling"
  const selectedRound = selectedRoundIndex >= 0 && roundHistory ? roundHistory[selectedRoundIndex] : undefined;
  const { data: selectedRoundStandings } = useRoundStandings(selectedRound?.id);
  const { data: prizeLeaders } = usePrizeLeaders(
    season?.status === "active" ? season?.id : undefined,
    season?.start_date
  );

  const isEnrolled = !!enrollment;
  const isFan = enrollment?.is_spectator === true;

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
      toast.success("Du er nu tilmeldt Salgsligaen! 🎉");
      handleCalculateStandings();
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke tilmelde");
    }
  };

  const handleEnrollAsFan = async () => {
    if (!season?.id) return;
    try {
      await fanMutation.mutateAsync(season.id);
      toast.success("Du følger nu med som fan! 👀");
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke tilmelde som fan");
    }
  };

  const handleUnenroll = async () => {
    if (!season?.id) return;
    try {
      await unenrollMutation.mutateAsync(season.id);
      toast.success("Du følger ikke længere med");
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke afmelde");
    }
  };

  const handleUnenrollAndBecomeFan = async () => {
    if (!season?.id) return;
    try {
      await unenrollAndFanMutation.mutateAsync(season.id);
      toast.success("Du er nu fan og kan følge med! 👀");
    } catch (error: any) {
      toast.error(error.message || "Kunne ikke skifte til fan");
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
                <h1 className="text-2xl font-bold mb-2">Salgsligaen</h1>
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
  const isActivePhase = season.status === "active";

  // Compute sticky bar data
  const stickyData = (() => {
    if (isFan) return null;
    if (isActivePhase && mySeasonStanding) {
      const div = mySeasonStanding.current_division;
      const rank = mySeasonStanding.division_rank;
      const isTop = div === 1;
      const totalDivs = seasonStandings ? new Set(seasonStandings.map(s => s.current_division)).size : 1;
      const isBottom = div === totalDivs;
      let zone: "top" | "promo" | "playoff" | "relegation" | "safe" = "safe";
      if (isTop && rank <= 3) zone = "top";
      else if (!isTop && rank <= 3) zone = "promo";
      else if ((!isTop && (rank === 4 || rank === 5)) || (rank === playersPerDivision - 3 || rank === playersPerDivision - 4)) zone = "playoff";
      else if (!isBottom && rank >= playersPerDivision - 2) zone = "relegation";
      return { rank: mySeasonStanding.overall_rank, division: div, points: Number(mySeasonStanding.total_points), zone, isQualification: false };
    }
    if (isQualificationPhase && myStanding) {
      const div = myStanding.projected_division;
      const rank = myStanding.projected_rank;
      const isTop = div === 1;
      const totalDivs = standings ? new Set(standings.map(s => s.projected_division)).size : 1;
      const isBottom = div === totalDivs;
      let zone: "top" | "promo" | "playoff" | "relegation" | "safe" = "safe";
      if (isTop && rank <= 3) zone = "top";
      else if (!isTop && rank <= 3) zone = "promo";
      else if ((!isTop && (rank === 4 || rank === 5)) || (rank === playersPerDivision - 3 || rank === playersPerDivision - 4)) zone = "playoff";
      else if (!isBottom && rank >= playersPerDivision - 2) zone = "relegation";
      return { rank: myStanding.overall_rank, division: div, provision: myStanding.current_provision, zone, isQualification: true };
    }
    return null;
  })();

  return (
    <MainLayout>
      {/* Sticky status bar */}
      {stickyData && isEnrolled && (
        <LeagueStickyBar
          rank={stickyData.rank}
          division={stickyData.division}
          points={stickyData.points}
          provision={stickyData.provision}
          zone={stickyData.zone}
          isQualification={stickyData.isQualification}
          visible={stickyVisible}
        />
      )}
      <div className="min-h-screen bg-slate-900 p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header - Hero with gradient */}
          <div ref={headerRef}>
              <div className="rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950/80 to-purple-950/60 border border-indigo-500/20 p-5 md:p-6 shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <Trophy className="h-8 w-8 text-yellow-500 trophy-glow" />
                    <h1 className="text-2xl md:text-3xl font-bold">Sæson {season.season_number}</h1>
                    {isFan && (
                      <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400">
                        <Eye className="h-3 w-3 mr-1" />
                        Fan
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isQualificationPhase
                      ? `Kvalifikationsrunde • ${enrollmentCount ?? 0} spillere`
                      : `Runde ${currentRound?.round_number ?? "?"} ${currentRound?.status === "active" ? "(i gang)" : currentRound?.status === "completed" ? "(afsluttet)" : ""} • ${enrollmentCount ?? 0} spillere`
                    }
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-muted-foreground/60">Formand: Oscar Belcher</span>
                  </div>
                </div>
                {isQualificationPhase && (
                  <div className="flex-shrink-0">
                    <QualificationCountdown endDate={season.qualification_end_at} startDate={season.qualification_source_start} />
                  </div>
                )}
              </div>
          </div>

          {/* Prize Showcase */}
          <PrizeShowcase
            standings={isActivePhase ? (seasonStandings || []) : (standings || [])}
            prizeLeaders={prizeLeaders}
            seasonStatus={season.status || ""}
            isActive={isActivePhase}
          />

          {/* Rules box */}
          <LeagueRulesSheet />

          {/* Not enrolled - show landing */}
          {!isEnrolled && (
            <Card className="bg-gradient-to-br from-primary/20 via-slate-800 to-slate-900 border-primary/30 overflow-hidden">
              <CardContent className="py-8">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">
                      🏆 Deltag i Salgsligaen!
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      Kæmp mod dine kolleger i et spændende liga-system baseret på din provision.
                      Op- og nedrykning hver uge – og der kan vindes fede præmier!
                    </p>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-primary" />
                        <span>14 spillere pr. division</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-primary" />
                        <span>Top 3 rykker op hver uge</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-primary" />
                        <span>#4-5 spiller playoff mod #10-11 i divisionen over</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronRight className="h-4 w-4 text-primary" />
                        <span>🎁 Præmier til topplaceringer</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {canParticipate && (
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
                      )}
                      <Button
                        size="lg"
                        variant="outline"
                        onClick={handleEnrollAsFan}
                        disabled={fanMutation.isPending}
                      >
                        {fanMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Eye className="h-4 w-4 mr-2" />
                        )}
                        Følg som fan 👀
                      </Button>
                    </div>
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
              {/* My Status - only for active participants, not fans */}
              {!isFan && (
                <MyQualificationStatus
                  standing={myStanding || null}
                  totalPlayers={standings?.length || 0}
                  playersPerDivision={playersPerDivision}
                  standings={standings || []}
                />
              )}

              {/* Unenroll / stop following button */}
              <div className="flex justify-end">
                {isFan ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleUnenroll}
                    disabled={unenrollMutation.isPending}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {unenrollMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Stop med at følge
                  </Button>
                ) : (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        Træk mig fra ligaen – bliv fan
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Træk dig fra ligaen?
                        </AlertDialogTitle>
                        <AlertDialogDescription className="space-y-2">
                          <p>Du vil blive fjernet fra ranglisten og konverteret til fan, så du stadig kan følge med.</p>
                          <p className="font-semibold text-destructive">⚠️ Bemærk: Hvis du tilmelder dig igen senere, starter du i bunden af ranglisten.</p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Nej, fortryd</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleUnenrollAndBecomeFan}
                          disabled={unenrollAndFanMutation.isPending}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {unenrollAndFanMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Ja, træk mig og bliv fan
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>

              {/* Leaderboard */}
              <Card className="bg-slate-800/30 border-slate-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Kvalifikationsrunde</CardTitle>
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
                      {!isFan && <TabsTrigger value="my">Min Division</TabsTrigger>}
                    </TabsList>

                    <TabsContent value="all">
                      <QualificationBoard
                        standings={standings || []}
                        playersPerDivision={playersPerDivision}
                        isLoading={standingsLoading}
                        currentEmployeeId={currentEmployeeId}
                      />
                    </TabsContent>

                    {!isFan && (
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
                    )}
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}

          {/* Active Season UI */}
          {isActivePhase && isEnrolled && (
            <>
              {/* My status card for active season */}
              {!isFan && mySeasonStanding && (
                <Card className="bg-gradient-to-r from-primary/20 to-slate-800 border-primary/30">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Din placering</p>
                      <p className="text-2xl font-bold">
                        #{mySeasonStanding.overall_rank}
                        <span className="text-base font-normal text-muted-foreground ml-2">
                          Division {mySeasonStanding.current_division === 1 ? "Salgsligaen" : `${mySeasonStanding.current_division - 1}. Div`}
                        </span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold font-mono">{Number(mySeasonStanding.total_points).toLocaleString("da-DK", { maximumFractionDigits: 0 })} pt</p>
                      <p className="text-sm text-muted-foreground">{mySeasonStanding.rounds_played} runder spillet</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Active season tabs */}
              <Card className="bg-slate-800/30 border-slate-700">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Sæson {season.season_number}</CardTitle>
                      <CardDescription>
                        {currentRound ? `Runde ${currentRound.round_number} ${currentRound.status === "active" ? "(i gang)" : "(afsluttet)"}` : "Venter på runder"}
                        {" • "}{seasonStandings?.length || 0} spillere
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="standings">
                    <TabsList className="mb-4">
                      <TabsTrigger value="standings">Samlet stilling</TabsTrigger>
                      <TabsTrigger value="thisWeek">Denne uge</TabsTrigger>
                      <TabsTrigger value="history">Rundehistorik</TabsTrigger>
                    </TabsList>

                    <TabsContent value="standings">
                      <ActiveSeasonBoard
                        standings={seasonStandings || []}
                        playersPerDivision={playersPerDivision}
                        isLoading={seasonStandingsLoading}
                        currentEmployeeId={currentEmployeeId}
                      />
                    </TabsContent>

                    <TabsContent value="thisWeek">
                      {currentRound && currentRound.status === "completed" && roundStandings && roundStandings.length > 0 ? (
                        <RoundResultsCard
                          round={currentRound}
                          standings={roundStandings}
                          playersPerDivision={playersPerDivision}
                          currentEmployeeId={currentEmployeeId}
                        />
                      ) : (
                        <Card className="bg-card border-border">
                          <CardContent className="py-10 text-center">
                            <p className="text-muted-foreground text-sm">
                              {currentRound?.status === "active" 
                                ? `Runde ${currentRound.round_number} er stadig i gang. Resultater vises når runden afsluttes.`
                                : "Ingen rundedata endnu."}
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>

                    <TabsContent value="history">
                      {roundHistory && roundHistory.length > 0 ? (
                        <div className="space-y-3">
                          <div className="flex gap-2 flex-wrap">
                            {roundHistory.map((r) => (
                              <Button
                                key={r.id}
                                size="sm"
                                variant={selectedHistoryRoundId === r.id ? "default" : "outline"}
                                onClick={() => setSelectedHistoryRoundId(r.id)}
                              >
                                Runde {r.round_number}
                              </Button>
                            ))}
                          </div>
                          {selectedHistoryRoundId && historyRoundStandings && (
                            <RoundResultsCard
                              round={roundHistory.find(r => r.id === selectedHistoryRoundId)!}
                              standings={historyRoundStandings}
                              playersPerDivision={playersPerDivision}
                              currentEmployeeId={currentEmployeeId}
                            />
                          )}
                        </div>
                      ) : (
                        <Card className="bg-card border-border">
                          <CardContent className="py-10 text-center">
                            <p className="text-muted-foreground text-sm">Ingen afsluttede runder endnu.</p>
                          </CardContent>
                        </Card>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}

        </div>
      </div>
    </MainLayout>
  );
}