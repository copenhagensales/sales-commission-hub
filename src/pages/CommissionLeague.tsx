import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Users, Calendar, ChevronRight, ChevronLeft, Loader2, Eye, AlertTriangle, Sparkles } from "lucide-react";
import confetti from "canvas-confetti";

import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUnifiedPermissions } from "@/hooks/useUnifiedPermissions";
import {
  useActiveSeason,
  useViewableSeasons,
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
import { useLeagueTodayProvision } from "@/hooks/useLeagueTodayProvision";
import { useLeagueWeeklyProvision } from "@/hooks/useLeagueWeeklyProvision";
import { useLeagueRoundProvision } from "@/hooks/useLeagueRoundProvision";
import { PrizeShowcase } from "@/components/league/PrizeShowcase";
import { FinalRoundBanner } from "@/components/league/FinalRoundBanner";
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
import { ZoneLegend } from "@/components/league/ZoneLegend";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { getRandomQuote, getPerformanceStatus } from "@/lib/gamification-quotes";
import { LeagueMotivationBar } from "@/components/league/LeagueMotivationBar";
import { usePersonalWeeklyStats } from "@/hooks/usePersonalWeeklyStats";

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

  const [viewedSeasonId, setViewedSeasonId] = useState<string | undefined>(undefined);
  const { data: viewableSeasons } = useViewableSeasons();
  const { data: season, isLoading: seasonLoading } = useActiveSeason(viewedSeasonId);
  // Detect if user is browsing a historical (non-live) season
  const liveSeasonExists = (viewableSeasons || []).some(s => s.status === "qualification" || s.status === "active");
  const isViewingHistorical = !!viewedSeasonId && season?.status === "completed";
  const { data: enrollment, isLoading: enrollmentLoading } = useMyEnrollment(season?.id);
  const { data: standings, isLoading: standingsLoading, refetch: refetchStandings } = useQualificationStandings(season?.id);
  const { data: myStanding } = useMyQualificationStanding(season?.id);
  const { data: enrollmentCount } = useEnrollmentCount(season?.id);
  const enrollMutation = useEnrollInSeason();
  const unenrollMutation = useUnenrollFromSeason();
  const unenrollAndFanMutation = useUnenrollAndBecomeFan();
  const fanMutation = useEnrollAsFan();

  // Active or completed season hooks (vis også historik for afsluttede sæsoner)
  const seasonHistoryEligible = season?.status === "active" || season?.status === "completed";
  const seasonIdForHistory = seasonHistoryEligible ? season?.id : undefined;
  const { data: currentRound } = useCurrentRound(seasonIdForHistory);
  const { data: seasonStandings, isLoading: seasonStandingsLoading } = useSeasonStandings(seasonIdForHistory);
  const { data: roundHistory } = useRoundHistory(seasonIdForHistory);
  const { data: mySeasonStanding } = useMySeasonStanding(seasonIdForHistory);
  // Default to last round (active round) index; update when roundHistory loads
  const activeRoundIndex = useMemo(() => {
    if (!roundHistory || roundHistory.length === 0) return 0;
    const activeIdx = roundHistory.findIndex(r => r.status === "active");
    return activeIdx >= 0 ? activeIdx : roundHistory.length - 1;
  }, [roundHistory]);
  const [selectedRoundIndex, setSelectedRoundIndex] = useState<number | null>(null);
  const effectiveIndex = selectedRoundIndex ?? activeRoundIndex;
  const selectedRound = roundHistory ? roundHistory[effectiveIndex] : undefined;
  const { data: selectedRoundStandings } = useRoundStandings(selectedRound?.status !== "active" ? selectedRound?.id : undefined);
  const { data: prizeLeaders } = usePrizeLeaders(
    season?.id,
    season?.start_date,
    season?.status === "active" ? (currentRound?.round_number ?? undefined) : undefined
  );
  const { data: weeklyStats } = usePersonalWeeklyStats(currentEmployeeId);

  // Today's provision for all enrolled players
  const allEmployeeIds = useMemo(() => {
    const ids = new Set<string>();
    (standings || []).forEach(s => ids.add(s.employee_id));
    (seasonStandings || []).forEach(s => ids.add(s.employee_id));
    return Array.from(ids);
  }, [standings, seasonStandings]);
  const { data: todayProvisionMap } = useLeagueTodayProvision(allEmployeeIds.length > 0 ? allEmployeeIds : undefined);
  const { data: weeklyProvisionMap } = useLeagueWeeklyProvision(allEmployeeIds.length > 0 ? allEmployeeIds : undefined);
  const { data: roundProvisionMap } = useLeagueRoundProvision(currentRound, allEmployeeIds.length > 0 ? allEmployeeIds : undefined);

  // Final-round detection: sidste planlagte runde i sæsonen
  const seasonConfig = (season?.config ?? {}) as { round_multipliers?: number[] };
  const totalPlannedRounds = seasonConfig.round_multipliers?.length ?? 6;
  const finalMultiplier = seasonConfig.round_multipliers?.[totalPlannedRounds - 1] ?? 2;
  const isFinalRound =
    season?.status === "active" &&
    currentRound?.status === "active" &&
    currentRound?.round_number === totalPlannedRounds;

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
      toast.success("Du er nu tilmeldt Superligaen! 🎉");
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
                <h1 className="text-2xl font-bold mb-2">Superligaen</h1>
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
  const isCompletedPhase = season.status === "completed";

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

  // Today provision for sticky bar
  const myTodayProvision = currentEmployeeId ? (todayProvisionMap?.[currentEmployeeId] ?? 0) : 0;

  // Confetti when entering top 3
  useEffect(() => {
    if (!currentEmployeeId || !stickyData) return;
    const currentRankVal = stickyData.rank;
    if (currentRankVal <= 3) {
      const key = `confetti-top3-${currentEmployeeId}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, "1");
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
    }
  }, [stickyData?.rank, currentEmployeeId]);

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
          todayProvision={myTodayProvision}
        />
      )}
      <div className="min-h-screen bg-slate-900 p-2 sm:p-4 md:p-6">
        <div className="max-w-6xl mx-auto space-y-3 sm:space-y-6">
          {/* Header - Hero with gradient */}
          <div ref={headerRef}>
              <div className="rounded-xl bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 border border-indigo-500/20 border-t-2 border-t-indigo-500/30 p-4 sm:p-6 md:p-8 shadow-lg shadow-indigo-500/5">
                {/* Mobile: stacked center-first | Desktop: 3-column grid */}
                <div className="flex flex-col items-center text-center gap-5 md:grid md:grid-cols-[1fr_auto_1fr] md:items-center md:text-left md:gap-6">

                  {/* === LEFT COLUMN === */}
                  <div className="order-2 md:order-1 flex flex-col gap-1.5">
                    {isFinalRound ? (
                      <div className="inline-flex items-center gap-2 self-center md:self-start rounded-full bg-gradient-to-r from-amber-500/20 to-red-500/20 px-3 py-1 ring-1 ring-amber-400/50">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                          🏆 Finale · Runde {currentRound?.round_number}
                        </span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 self-center md:self-start">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                          {isQualificationPhase ? "Kvalifikationsrunde" : `Runde ${currentRound?.round_number ?? "?"}`}
                        </span>
                        {currentRound?.status === "active" && !isQualificationPhase && (
                          <span className="text-[10px] text-muted-foreground">(i gang)</span>
                        )}
                      </div>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {enrollmentCount ?? 0} spillere tilmeldt
                    </span>
                    {isFan && (
                      <Badge variant="outline" className="text-xs border-yellow-500/50 text-yellow-400 w-fit self-center md:self-start">
                        <Eye className="h-3 w-3 mr-1" />
                        Fan
                      </Badge>
                    )}
                  </div>

                  {/* === CENTER COLUMN === */}
                  <div className="order-1 md:order-2 flex flex-col items-center gap-2">
                    <div className="flex items-center gap-3">
                      <Trophy className="h-9 w-9 md:h-10 md:w-10 text-yellow-500 trophy-glow drop-shadow-[0_0_12px_rgba(234,179,8,0.4)]" />
                      <h1 className="text-3xl md:text-4xl font-extrabold uppercase tracking-wider bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                        Sæson {season.season_number}
                      </h1>
                    </div>
                    <span className="text-xs text-muted-foreground/60">Formand: Oscar Belcher</span>

                    {/* Sæson-vælger – bladr mellem sæsoner */}
                    {viewableSeasons && viewableSeasons.length > 1 && (
                      <SeasonSwitcher
                        seasons={viewableSeasons}
                        currentSeasonId={season.id}
                        onChange={(id) => {
                          // If user picks the live season, clear override so default logic kicks in
                          const picked = viewableSeasons.find(s => s.id === id);
                          const isLive = picked?.status === "qualification" || picked?.status === "active";
                          setViewedSeasonId(isLive && liveSeasonExists ? undefined : id);
                          setSelectedRoundIndex(null);
                        }}
                      />
                    )}

                    {isViewingHistorical && (
                      <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                        Historisk visning
                      </Badge>
                    )}

                    <LeagueRulesSheet compact />
                  </div>

                  {/* === RIGHT COLUMN === */}
                  <div className="order-3 flex justify-center md:justify-end">
                    {isQualificationPhase && (
                      <QualificationCountdown endDate={season.qualification_end_at} startDate={season.qualification_source_start} />
                    )}
                  </div>

                </div>
              </div>
          </div>

          {/* Final Round Banner */}
          {isFinalRound && currentRound && (
            <FinalRoundBanner
              endDate={currentRound.end_date}
              multiplier={finalMultiplier}
              roundNumber={currentRound.round_number}
            />
          )}

          {/* Motivation Coach Bar */}
          {isEnrolled && !isFan && currentEmployeeId && (
            <LeagueMotivationBar
              employeeId={currentEmployeeId}
              myStanding={isActivePhase ? (mySeasonStanding ?? null) : (myStanding ?? null)}
              standings={isActivePhase ? (seasonStandings || []) : (standings || [])}
              dailyTarget={0}
              todayTotal={0}
              currentWeekTotal={weeklyStats?.currentWeek?.weekTotal ?? 0}
            />
          )}

          {/* Prize Showcase */}
          <PrizeShowcase
            standings={isActivePhase ? (seasonStandings || []) : (standings || [])}
            prizeLeaders={prizeLeaders}
            seasonStatus={season.status || ""}
            isActive={isActivePhase}
            roundProvisionMap={roundProvisionMap || {}}
          />

          {/* Not enrolled - show landing (skjules når sæson er afsluttet) */}
          {!isEnrolled && !isCompletedPhase && (
            <Card className="bg-gradient-to-br from-primary/20 via-slate-800 to-slate-900 border-primary/30 overflow-hidden">
              <CardContent className="py-8">
                <div className="grid md:grid-cols-2 gap-8 items-center">
                  <div>
                    <h2 className="text-2xl font-bold mb-4">
                      🏆 Deltag i Superligaen!
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

          {/* Enrolled - show qualification dashboard (only during qualification) */}
          {isQualificationPhase && isEnrolled && (
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

              {/* Unenroll button (only for active players, not fans) */}
              <div className="flex justify-end">
                {isFan ? null : (
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
                <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Trophy className="h-5 w-5 text-yellow-400" />
                      <div>
                        <CardTitle className="text-lg font-bold">
                          Kvalifikationsrunde
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-0.5">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          <span className="text-emerald-400 text-xs font-medium">Live</span>
                          <span className="text-muted-foreground text-xs">• {standings?.length || 0} tilmeldte</span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs">
                        Opdateret {standings?.[0]?.last_calculated_at
                          ? format(new Date(standings[0].last_calculated_at), "HH:mm", { locale: da })
                          : "-"}
                      </span>
                      <ZoneLegend />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-2 sm:px-6">
                  <Tabs defaultValue="all">
                    <TabsList className="mb-2 sm:mb-3 w-full sm:w-auto">
                      <TabsTrigger value="all" className="text-xs sm:text-sm flex-1 sm:flex-none">Alle Divisioner</TabsTrigger>
                      {!isFan && <TabsTrigger value="my" className="text-xs sm:text-sm flex-1 sm:flex-none">Min Division</TabsTrigger>}
                    </TabsList>

                    <TabsContent value="all">
                      <QualificationBoard
                        standings={standings || []}
                        playersPerDivision={playersPerDivision}
                        isLoading={standingsLoading}
                        currentEmployeeId={currentEmployeeId}
                        todayProvisionMap={todayProvisionMap || {}}
                        weeklyProvisionMap={weeklyProvisionMap || {}}
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
                          todayProvisionMap={todayProvisionMap || {}}
                          weeklyProvisionMap={weeklyProvisionMap || {}}
                        />
                      </TabsContent>
                    )}
                  </Tabs>
                </CardContent>
              </Card>
            </>
          )}

          {/* Completed season banner */}
          {isCompletedPhase && (
            <Card className="bg-gradient-to-r from-amber-500/10 to-yellow-600/10 border-amber-500/40">
              <CardContent className="py-4 flex items-center gap-3">
                <Trophy className="h-6 w-6 text-yellow-400" />
                <div>
                  <p className="font-bold">Sæson {season.season_number} afsluttet</p>
                  <p className="text-sm text-muted-foreground">Endeligt resultat vises herunder.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active or Completed Season UI */}
          {(isActivePhase || isCompletedPhase) && (isEnrolled || isCompletedPhase) && (
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
                          Division {mySeasonStanding.current_division === 1 ? "Superligaen" : `${mySeasonStanding.current_division - 1}. Div`}
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

              {/* Active season with round navigation */}
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
                    <ZoneLegend />
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Round navigation – chips */}
                  <div className="flex flex-wrap items-center gap-1.5 mb-4 overflow-x-auto pb-1">
                    <Button
                      variant={effectiveIndex === -1 ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7 px-2.5 shrink-0"
                      onClick={() => setSelectedRoundIndex(-1)}
                    >
                      Kval
                    </Button>
                    {(roundHistory || []).map((r, idx) => (
                      <Button
                        key={r.id}
                        variant={effectiveIndex === idx ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7 px-2.5 shrink-0"
                        onClick={() => setSelectedRoundIndex(idx)}
                      >
                        R{r.round_number}
                        {r.status === "active" && (
                          <span className="ml-1 relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                        )}
                      </Button>
                    ))}
                  </div>

                  {effectiveIndex === -1 ? (
                    <QualificationBoard
                      standings={standings || []}
                      playersPerDivision={playersPerDivision}
                      isLoading={standingsLoading}
                      currentEmployeeId={currentEmployeeId}
                      todayProvisionMap={{}}
                      weeklyProvisionMap={{}}
                    />
                  ) : selectedRound?.status === "active" ? (
                    <ActiveSeasonBoard
                      standings={seasonStandings || []}
                      playersPerDivision={playersPerDivision}
                      isLoading={seasonStandingsLoading}
                      currentEmployeeId={currentEmployeeId}
                      todayProvisionMap={todayProvisionMap || {}}
                      weeklyProvisionMap={weeklyProvisionMap || {}}
                      roundProvisionMap={roundProvisionMap || {}}
                      currentRoundNumber={currentRound?.round_number}
                    />
                  ) : selectedRound && selectedRoundStandings && selectedRoundStandings.length > 0 ? (
                    <RoundResultsCard
                      round={selectedRound}
                      standings={selectedRoundStandings}
                      playersPerDivision={playersPerDivision}
                      currentEmployeeId={currentEmployeeId}
                    />
                  ) : (
                    <Card className="bg-card border-border">
                      <CardContent className="py-10 text-center">
                        <p className="text-muted-foreground text-sm">Ingen rundedata endnu.</p>
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
              </Card>
            </>
          )}

        </div>
      </div>
    </MainLayout>
  );
}