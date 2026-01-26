import { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Target, LogOut, ArrowRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeroPerformanceCardProps {
  firstName: string;
  periodCommission: number;
  targetAmount: number;
  progressPercent: number;
  hasGoal: boolean;
  onLogout: () => void;
  isEnrolledInLeague?: boolean;
}

export function HeroPerformanceCard({
  firstName,
  periodCommission,
  targetAmount,
  progressPercent,
  hasGoal,
  onLogout,
  isEnrolledInLeague = true,
}: HeroPerformanceCardProps) {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const [animatedCommission, setAnimatedCommission] = useState(0);

  // Animate numbers on mount
  useEffect(() => {
    const duration = 1200;
    const steps = 60;
    const stepDuration = duration / steps;
    
    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;
      const eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
      
      setAnimatedPercent(Math.round(progressPercent * eased));
      setAnimatedCommission(Math.round(periodCommission * eased));
      
      if (currentStep >= steps) {
        clearInterval(timer);
        setAnimatedPercent(progressPercent);
        setAnimatedCommission(periodCommission);
      }
    }, stepDuration);
    
    return () => clearInterval(timer);
  }, [progressPercent, periodCommission]);

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
    }).format(amount);
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

  // Get performance tier for gradient styling
  const performanceTier = useMemo(() => {
    if (!hasGoal) return 'none';
    if (progressPercent >= 100) return 'flying';
    if (progressPercent >= 80) return 'ahead';
    if (progressPercent >= 50) return 'warmup';
    return 'start';
  }, [progressPercent, hasGoal]);

  // Get contextual CTA
  const ctaConfig = useMemo(() => {
    if (!hasGoal) {
      return {
        label: "Sæt dit mål for perioden",
        href: "/my-goals",
        icon: Target,
      };
    }
    if (progressPercent < 80) {
      return {
        label: "Se hvordan du indhenter",
        href: "/my-goals",
        icon: TrendingUp,
      };
    }
    if (progressPercent < 100) {
      return {
        label: "Se dine næste milestones",
        href: "/my-goals",
        icon: TrendingUp,
      };
    }
    return {
      label: "Se din fremgang",
      href: "/my-goals",
      icon: Trophy,
    };
  }, [hasGoal, progressPercent]);

  // SVG progress ring calculations
  const ringSize = 140;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cappedProgress = Math.min(animatedPercent, 100);
  const strokeDashoffset = circumference - (cappedProgress / 100) * circumference;

  // Get gradient class based on performance
  const getGradientClass = () => {
    switch (performanceTier) {
      case 'flying': return 'from-emerald-500/20 via-cyan-500/10 to-emerald-500/5';
      case 'ahead': return 'from-amber-500/15 via-emerald-500/10 to-amber-500/5';
      case 'warmup': return 'from-indigo-500/15 via-amber-500/10 to-indigo-500/5';
      case 'start': return 'from-slate-500/10 via-indigo-500/10 to-slate-500/5';
      default: return 'from-primary/10 via-background to-accent/5';
    }
  };

  // Get ring color based on performance
  const getRingColor = () => {
    if (!hasGoal) return 'stroke-muted-foreground/30';
    if (progressPercent >= 100) return 'stroke-emerald-500';
    if (progressPercent >= 80) return 'stroke-primary';
    if (progressPercent >= 50) return 'stroke-amber-500';
    return 'stroke-indigo-400';
  };

  // Get glow class based on performance
  const getGlowClass = () => {
    if (!hasGoal) return '';
    if (progressPercent >= 100) return 'hero-pulse-flying';
    if (progressPercent >= 80) return 'hero-pulse-ahead';
    if (progressPercent >= 50) return 'hero-pulse-warmup';
    return 'hero-pulse-slow';
  };

  return (
    <section 
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border/30",
        "bg-gradient-to-br",
        getGradientClass(),
        "backdrop-blur-xl shadow-2xl",
        getGlowClass()
      )}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-card/60 backdrop-blur-sm" />
      
      {/* Animated gradient shimmer */}
      <div className="absolute inset-0 opacity-30 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
      
      {/* Decorative elements */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="relative z-10 p-5 md:p-8">
        {/* Header with greeting and logout */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground">
              {performanceEmoji} {getGreeting()}, {firstName}!
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
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

        {/* Main content: Progress ring + Stats */}
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
          {/* SVG Progress Ring */}
          <div className="relative flex-shrink-0">
            <svg 
              width={ringSize} 
              height={ringSize} 
              className="transform -rotate-90"
            >
              {/* Background ring */}
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-border/50"
              />
              {/* Progress ring */}
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={radius}
                fill="none"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                className={cn(
                  getRingColor(),
                  "transition-all duration-1000 ease-out",
                  "pulse-ring-animated"
                )}
                style={{
                  filter: hasGoal && progressPercent >= 80 
                    ? 'drop-shadow(0 0 8px currentColor)' 
                    : undefined
                }}
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {hasGoal ? (
                <>
                  <span className={cn(
                    "text-3xl md:text-4xl font-bold tabular-nums number-animate",
                    progressPercent >= 100 ? 'text-emerald-500' :
                    progressPercent >= 80 ? 'text-primary' :
                    progressPercent >= 50 ? 'text-amber-500' :
                    'text-foreground'
                  )}>
                    {animatedPercent}%
                  </span>
                  <span className="text-xs text-muted-foreground mt-0.5">af dit mål</span>
                </>
              ) : (
                <Link to="/my-goals" className="flex flex-col items-center group">
                  <Target className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-xs text-muted-foreground mt-1 group-hover:text-primary">Sæt mål</span>
                </Link>
              )}
            </div>
          </div>

          {/* Stats + CTA */}
          <div className="flex-1 flex flex-col gap-4 text-center md:text-left">
            {/* Commission stat */}
            <div className="space-y-1">
              <div className="flex items-center justify-center md:justify-start gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <span className="text-2xl md:text-3xl font-bold text-foreground tabular-nums">
                  {formatCommission(animatedCommission)} kr
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                provision denne periode
              </p>
            </div>

            {/* Integrated CTA Button */}
            <Link to={ctaConfig.href} className="block">
              <Button 
                size="lg" 
                className={cn(
                  "w-full md:w-auto gap-2 group",
                  "bg-primary hover:bg-primary/90",
                  "shadow-lg shadow-primary/20",
                  "transition-all duration-300",
                  hasGoal && progressPercent >= 80 && "animate-pulse"
                )}
              >
                <ctaConfig.icon className="w-4 h-4" />
                {ctaConfig.label}
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>

            {/* Secondary CTA for league enrollment */}
            {!isEnrolledInLeague && (
              <Link to="/commission-league">
                <Button variant="outline" size="sm" className="gap-2 w-full md:w-auto">
                  <Trophy className="w-4 h-4" />
                  Tilmeld salgsligaen
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
