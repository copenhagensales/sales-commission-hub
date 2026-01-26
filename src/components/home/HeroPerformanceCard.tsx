import { useMemo } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, ArrowUpRight, Target, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

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

  // Get contextual motivational message based on progress
  const motivationalMessage = useMemo(() => {
    if (!hasGoal) return "Sæt et mål for at tracke din fremgang";
    if (progressPercent >= 120) return "Du er on fire! 🔥";
    if (progressPercent >= 100) return "Mål nået! Går du efter rekorden?";
    if (progressPercent >= 80) return "Målstregen er i sigte!";
    if (progressPercent >= 50) return "Du er på vej - keep going!";
    return "Hver samtale tæller!";
  }, [progressPercent, hasGoal]);

  // Get performance emoji based on progress
  const performanceEmoji = useMemo(() => {
    if (!hasGoal) return "👋";
    if (progressPercent >= 120) return "🔥";
    if (progressPercent >= 100) return "🏆";
    if (progressPercent >= 80) return "💪";
    if (progressPercent >= 50) return "📈";
    return "🚀";
  }, [progressPercent, hasGoal]);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/8 via-background to-accent/5 border border-border/50 p-5 md:p-6">
      {/* Subtle decorative elements */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
      
      <div className="relative z-10">
        {/* Header with greeting and logout */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {getGreeting()}, {firstName}! {performanceEmoji}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {motivationalMessage}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onLogout}
            className="gap-1.5 shrink-0 text-muted-foreground hover:text-foreground -mt-1 -mr-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden md:inline text-sm">Log ud</span>
          </Button>
        </div>

        {/* Two column metrics layout */}
        <div className="grid grid-cols-2 gap-3">
          {/* Progress percentage */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-background/80 border border-border/40">
            {hasGoal ? (
              <>
                <div className={`text-3xl md:text-4xl font-bold tabular-nums ${
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
              <Link to="/my-goals" className="flex flex-col items-center group py-1">
                <Target className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-xs text-muted-foreground mt-1.5 group-hover:text-primary">Sæt dit mål</p>
                <ArrowUpRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
            )}
          </div>

          {/* Commission amount */}
          <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-background/80 border border-border/40">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xl md:text-2xl font-bold text-foreground tabular-nums">
                {formatCommission(periodCommission)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">provision denne periode</p>
          </div>
        </div>
      </div>
    </section>
  );
}