import { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Target, ArrowRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HeroPerformanceCardProps {
  firstName: string;
  periodCommission: number;
  targetAmount: number;
  progressPercent: number;
  hasGoal: boolean;
  isEnrolledInLeague?: boolean;
  vacationPay?: number;
}

export function HeroPerformanceCard({
  firstName,
  periodCommission,
  targetAmount,
  progressPercent,
  hasGoal,
  isEnrolledInLeague = true,
  vacationPay = 0,
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
        label: "Sæt dit mål",
        href: "/my-goals",
        icon: Target,
      };
    }
    if (progressPercent < 80) {
      return {
        label: "Se fremgang",
        href: "/my-goals",
        icon: TrendingUp,
      };
    }
    if (progressPercent < 100) {
      return {
        label: "Se milestones",
        href: "/my-goals",
        icon: TrendingUp,
      };
    }
    return {
      label: "Se fremgang",
      href: "/my-goals",
      icon: Trophy,
    };
  }, [hasGoal, progressPercent]);

  // SVG progress ring calculations - responsive sizes
  const ringSize = { mobile: 88, desktop: 140 };
  const strokeWidth = { mobile: 8, desktop: 10 };
  
  const getCircleProps = (size: number, stroke: number) => {
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const cappedProgress = Math.min(animatedPercent, 100);
    const strokeDashoffset = circumference - (cappedProgress / 100) * circumference;
    return { radius, circumference, strokeDashoffset };
  };

  const mobileCircle = getCircleProps(ringSize.mobile, strokeWidth.mobile);
  const desktopCircle = getCircleProps(ringSize.desktop, strokeWidth.desktop);

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
        "relative overflow-hidden rounded-xl md:rounded-2xl border border-border/30",
        "bg-gradient-to-br",
        getGradientClass(),
        "backdrop-blur-xl shadow-xl md:shadow-2xl",
        getGlowClass()
      )}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-card/60 backdrop-blur-sm" />
      
      {/* Animated gradient shimmer */}
      <div className="absolute inset-0 opacity-30 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
      
      {/* Decorative elements - smaller on mobile */}
      <div className="absolute -top-16 -right-16 md:-top-20 md:-right-20 w-48 h-48 md:w-64 md:h-64 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-16 -left-16 md:-bottom-20 md:-left-20 w-36 h-36 md:w-48 md:h-48 bg-accent/10 rounded-full blur-3xl" />
      
      <div className="relative z-10 p-4 md:p-8">
        {/* Header with greeting - more compact on mobile */}
        <div className="mb-4 md:mb-6">
          <h1 className="text-lg md:text-2xl font-bold text-foreground flex items-center gap-1.5 md:gap-2">
            <span className="text-xl md:text-2xl">{performanceEmoji}</span>
            <span>{getGreeting()}, {firstName}!</span>
          </h1>
          <p className="text-muted-foreground text-xs md:text-sm mt-0.5 md:mt-1">
            {motivationalMessage}
          </p>
        </div>

        {/* Main content: Horizontal layout on mobile, better on desktop */}
        <div className="flex items-center gap-4 md:gap-10">
          {/* SVG Progress Ring - Mobile size */}
          <div className="relative flex-shrink-0 md:hidden">
            <svg 
              width={ringSize.mobile} 
              height={ringSize.mobile} 
              className="transform -rotate-90"
            >
              <circle
                cx={ringSize.mobile / 2}
                cy={ringSize.mobile / 2}
                r={mobileCircle.radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth.mobile}
                className="text-border/50"
              />
              <circle
                cx={ringSize.mobile / 2}
                cy={ringSize.mobile / 2}
                r={mobileCircle.radius}
                fill="none"
                strokeWidth={strokeWidth.mobile}
                strokeLinecap="round"
                strokeDasharray={mobileCircle.circumference}
                strokeDashoffset={mobileCircle.strokeDashoffset}
                className={cn(
                  getRingColor(),
                  "transition-all duration-1000 ease-out"
                )}
                style={{
                  filter: hasGoal && progressPercent >= 80 
                    ? 'drop-shadow(0 0 6px currentColor)' 
                    : undefined
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {hasGoal ? (
                <>
                  <span className={cn(
                    "text-xl font-bold tabular-nums",
                    progressPercent >= 100 ? 'text-emerald-500' :
                    progressPercent >= 80 ? 'text-primary' :
                    progressPercent >= 50 ? 'text-amber-500' :
                    'text-foreground'
                  )}>
                    {animatedPercent}%
                  </span>
                  <span className="text-[10px] text-muted-foreground">af mål</span>
                </>
              ) : (
                <Link to="/my-goals" className="flex flex-col items-center group">
                  <Target className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-[10px] text-muted-foreground mt-0.5 group-hover:text-primary">Sæt mål</span>
                </Link>
              )}
            </div>
          </div>

          {/* SVG Progress Ring - Desktop size */}
          <div className="relative flex-shrink-0 hidden md:block">
            <svg 
              width={ringSize.desktop} 
              height={ringSize.desktop} 
              className="transform -rotate-90"
            >
              <circle
                cx={ringSize.desktop / 2}
                cy={ringSize.desktop / 2}
                r={desktopCircle.radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth.desktop}
                className="text-border/50"
              />
              <circle
                cx={ringSize.desktop / 2}
                cy={ringSize.desktop / 2}
                r={desktopCircle.radius}
                fill="none"
                strokeWidth={strokeWidth.desktop}
                strokeLinecap="round"
                strokeDasharray={desktopCircle.circumference}
                strokeDashoffset={desktopCircle.strokeDashoffset}
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

          {/* Stats + CTA - More compact on mobile */}
          <div className="flex-1 flex flex-col gap-3 md:gap-4">
            {/* Commission stat */}
            <div className="space-y-0.5 md:space-y-1">
              <div className="flex items-center gap-1.5 md:gap-2">
                <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                <span className="text-xl md:text-3xl font-bold text-foreground tabular-nums">
                  {formatCommission(animatedCommission)} kr
                </span>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground">
                provision denne periode
              </p>
              {vacationPay > 0 && (
                <p className="text-xs text-emerald-500/80">
                  + {formatCommission(vacationPay)} kr feriepenge
                </p>
              )}
            </div>

            {/* CTA Buttons - Stacked on mobile */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Link to={ctaConfig.href} className="block">
                <Button 
                  size="sm"
                  className={cn(
                    "w-full sm:w-auto gap-1.5 group text-xs md:text-sm h-9 md:h-10",
                    "bg-primary hover:bg-primary/90",
                    "shadow-md shadow-primary/20",
                    "transition-all duration-300"
                  )}
                >
                  <ctaConfig.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                  {ctaConfig.label}
                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </Link>

              {/* Secondary CTA for league enrollment */}
              {!isEnrolledInLeague && (
                <Link to="/commission-league">
                  <Button variant="outline" size="sm" className="gap-1.5 w-full sm:w-auto text-xs h-9">
                    <Trophy className="w-3.5 h-3.5" />
                    Tilmeld liga
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
