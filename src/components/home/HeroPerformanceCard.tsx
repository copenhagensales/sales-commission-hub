import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Trophy, TrendingUp, ArrowUpRight, Target, LogOut, Flame, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  useActiveSeason, 
  useMyEnrollment, 
  useQualificationStandings,
  type QualificationStanding 
} from "@/hooks/useLeagueData";
import { useCurrentEmployeeId } from "@/hooks/useOnboarding";

interface HeroPerformanceCardProps {
  firstName: string;
  periodCommission: number;
  targetAmount: number;
  progressPercent: number;
  hasGoal: boolean;
  onLogout: () => void;
}

export function HeroPerformanceCard({
  firstName,
  periodCommission,
  targetAmount,
  progressPercent,
  hasGoal,
  onLogout,
}: HeroPerformanceCardProps) {
  const { data: season } = useActiveSeason();
  const { data: enrollment } = useMyEnrollment(season?.id);
  const isEnrolled = !!enrollment;
  const { data: currentEmployeeId } = useCurrentEmployeeId();
  const { data: allStandings = [] } = useQualificationStandings(season?.id);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Godmorgen";
    if (hour < 17) return "God eftermiddag";
    return "God aften";
  };

  const formatCommission = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  // Get user's league position
  const leaguePosition = useMemo(() => {
    if (!currentEmployeeId || allStandings.length === 0) return null;
    
    const myIndex = allStandings.findIndex(s => s.employee_id === currentEmployeeId);
    if (myIndex === -1) return null;
    
    const standing = allStandings[myIndex];
    const currentRank = standing.overall_rank || (myIndex + 1);
    const previousRank = standing.previous_overall_rank;
    
    let change: "up" | "down" | "same" | null = null;
    let changeAmount = 0;
    
    if (previousRank !== null && previousRank !== undefined) {
      changeAmount = previousRank - currentRank;
      if (changeAmount > 0) change = "up";
      else if (changeAmount < 0) change = "down";
      else change = "same";
    }
    
    return { rank: currentRank, change, changeAmount: Math.abs(changeAmount) };
  }, [currentEmployeeId, allStandings]);

  // Get contextual motivational message based on progress
  const motivationalMessage = useMemo(() => {
    if (!hasGoal) return "Sæt et mål for at tracke din fremgang";
    if (progressPercent >= 120) return "Du er on fire 🔥 Top 3 venter!";
    if (progressPercent >= 100) return "Mål nået! Går du efter rekorden?";
    if (progressPercent >= 80) return "Målstregen er i sigte - push through!";
    if (progressPercent >= 50) return "Du er på vej! Keep going!";
    return "Hver samtale tæller - du bygger momentum!";
  }, [progressPercent, hasGoal]);

  // Get performance emoji based on progress
  const performanceEmoji = useMemo(() => {
    if (!hasGoal) return "🎯";
    if (progressPercent >= 120) return "🔥";
    if (progressPercent >= 100) return "🏆";
    if (progressPercent >= 80) return "💪";
    if (progressPercent >= 50) return "📈";
    return "🚀";
  }, [progressPercent, hasGoal]);

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-6 md:p-8">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
      
      <div className="relative z-10">
        {/* Header with greeting and logout */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">
              {getGreeting()}, {firstName}! {performanceEmoji}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base">
              {motivationalMessage}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="gap-2 shrink-0 opacity-70 hover:opacity-100"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline">Log ud</span>
          </Button>
        </div>

        {/* Main performance metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {/* Progress percentage - hero metric */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-background/60 backdrop-blur-sm border border-border/50">
            {hasGoal ? (
              <>
                <div className={`text-4xl md:text-5xl font-bold tabular-nums ${
                  progressPercent >= 100 ? 'text-green-600 dark:text-green-400' :
                  progressPercent >= 80 ? 'text-primary' :
                  progressPercent >= 50 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-muted-foreground'
                }`}>
                  {Math.round(progressPercent)}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">af dit mål</p>
              </>
            ) : (
              <Link to="/my-goals" className="flex flex-col items-center group">
                <Target className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-sm text-muted-foreground mt-2 group-hover:text-primary">Sæt dit mål</p>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )}
          </div>

          {/* Commission amount */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-background/60 backdrop-blur-sm border border-border/50">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">
                {formatCommission(periodCommission)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">provision denne periode</p>
          </div>

          {/* League position */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-background/60 backdrop-blur-sm border border-border/50">
            {leaguePosition && isEnrolled ? (
              <>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  <span className="text-2xl md:text-3xl font-bold text-foreground">
                    #{leaguePosition.rank}
                  </span>
                  {leaguePosition.change && leaguePosition.changeAmount > 0 && (
                    <Badge 
                      variant="secondary" 
                      className={`text-xs ${
                        leaguePosition.change === 'up' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : leaguePosition.change === 'down'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {leaguePosition.change === 'up' && <ArrowUp className="w-3 h-3 mr-0.5" />}
                      {leaguePosition.change === 'down' && <ArrowDown className="w-3 h-3 mr-0.5" />}
                      {leaguePosition.change === 'same' && <Minus className="w-3 h-3 mr-0.5" />}
                      {leaguePosition.changeAmount}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">i ligaen</p>
              </>
            ) : isEnrolled ? (
              <>
                <Trophy className="w-8 h-8 text-yellow-500/50" />
                <p className="text-xs text-muted-foreground mt-2">Standings opdateres snart</p>
              </>
            ) : (
              <Link to="/commission-league" className="flex flex-col items-center group">
                <Trophy className="w-8 h-8 text-muted-foreground group-hover:text-yellow-500 transition-colors" />
                <p className="text-sm text-muted-foreground mt-2 group-hover:text-primary">Tilmeld ligaen</p>
                <ArrowUpRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
