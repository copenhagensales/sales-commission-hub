import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Flame, Rocket, Trophy, Target, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PulseThresholds, getPulseStatus } from "@/hooks/useGamificationConfig";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeroStatusCardProps {
  pulsePercent: number;
  todayTotal: number;
  actualDailyAvg: number;
  thresholds: PulseThresholds;
  currentAmount: number;
  projectedFinal: number;
  targetAmount: number;
  willHitGoal: boolean;
  isAhead: boolean;
  isOnTrack: boolean;
  progressPercent: number;
  className?: string;
}

const STATUS_CONFIG = {
  flying: {
    label: "Over dit snit! 🚀",
    icon: Rocket,
    colorClass: "text-[hsl(160_84%_39%)]",
    bgClass: "bg-[hsl(160_84%_39%/0.15)]",
    borderClass: "border-[hsl(160_84%_39%/0.4)]",
    ringColor: "hsl(160 84% 39%)",
  },
  ahead: {
    label: "Foran dit snit 💪",
    icon: TrendingUp,
    colorClass: "text-success",
    bgClass: "bg-success/15",
    borderClass: "border-success/40",
    ringColor: "hsl(142 71% 45%)",
  },
  close: {
    label: "Tæt på dit snit 🔥",
    icon: Flame,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    ringColor: "hsl(38 92% 50%)",
  },
  behind: {
    label: "Under dit snit ⚡",
    icon: Zap,
    colorClass: "text-primary",
    bgClass: "bg-primary/10",
    borderClass: "border-primary/30",
    ringColor: "hsl(161 93% 40%)",
  },
};

export function HeroStatusCard({
  pulsePercent,
  todayTotal,
  actualDailyAvg,
  thresholds,
  currentAmount,
  projectedFinal,
  targetAmount,
  willHitGoal,
  isAhead,
  isOnTrack,
  progressPercent,
  className,
}: HeroStatusCardProps) {
  const status = getPulseStatus(pulsePercent, thresholds);
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  // Circle math
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const displayPercent = Math.min(pulsePercent, 100);
  const offset = circumference - (displayPercent / 100) * circumference;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = () => {
    if (progressPercent >= 100) {
      return (
        <Badge className="bg-success/20 text-success border-success/30 gap-1 text-xs">
          <Trophy className="h-3 w-3" />
          Mål nået!
        </Badge>
      );
    }
    if (willHitGoal && isAhead) {
      return (
        <Badge className="bg-success/20 text-success border-success/30 gap-1 text-xs">
          <Flame className="h-3 w-3" />
          Foran plan
        </Badge>
      );
    }
    if (isOnTrack) {
      return (
        <Badge className="bg-warning/20 text-warning border-warning/30 gap-1 text-xs">
          <Zap className="h-3 w-3" />
          På sporet
        </Badge>
      );
    }
    return (
      <Badge className="bg-warning/20 text-warning border-warning/30 gap-1 text-xs">
        <Target className="h-3 w-3" />
        Gap til plan
      </Badge>
    );
  };

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-2 transition-all duration-500",
        config.borderClass,
        className
      )}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-50" />

      <CardContent className="relative p-4">
        {/* Main content: Pulse ring centered with stats on sides */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: Current amount */}
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-1">Du er her nu</p>
            <p className="text-xl font-bold">
              {currentAmount.toLocaleString("da-DK")} <span className="text-sm font-normal text-muted-foreground">kr</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              af {targetAmount.toLocaleString("da-DK")} kr
            </p>
          </div>

          {/* Center: Pulse ring */}
          <div className="relative flex flex-col items-center">
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* SVG Ring */}
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox="0 0 100 100"
              >
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  className="text-muted/30"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={radius}
                  fill="none"
                  stroke={config.ringColor}
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="transition-all duration-1000 ease-out"
                  style={{ 
                    filter: `drop-shadow(0 0 6px ${config.ringColor})`
                  }}
                />
              </svg>

              {/* Inner content */}
              <div className={cn("absolute inset-3 rounded-full", config.bgClass)} />
              <div className="relative z-10 text-center">
                <span className={cn("text-xl font-bold tabular-nums", config.colorClass)}>
                  {Math.round(pulsePercent)}%
                </span>
              </div>
            </div>

            {/* Status label with tooltip */}
            <div className="flex items-center gap-1 mt-2">
              <StatusIcon className={cn("h-3.5 w-3.5", config.colorClass)} />
              <span className={cn("text-xs font-semibold", config.colorClass)}>
                {config.label}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[180px] text-center">
                    <p className="text-xs">
                      Din præstation i dag vs. dit daglige snit. 100% = du matcher dit snit.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Right: Projected */}
          <div className="flex-1 text-center">
            <p className="text-xs text-muted-foreground mb-1">Projiceret</p>
            <p className={cn("text-xl font-bold", willHitGoal ? "text-success" : "text-warning")}>
              {Math.round(projectedFinal).toLocaleString("da-DK")} <span className="text-sm font-normal text-muted-foreground">kr</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              + {Math.round(projectedFinal * 0.125).toLocaleString("da-DK")} feriepenge
            </p>
          </div>
        </div>

        {/* Bottom: Status badge and today stats */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center p-2 rounded-lg bg-card/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground">I dag</span>
              <span className="text-sm font-bold">{formatCurrency(todayTotal)}</span>
            </div>
            <div className="flex flex-col items-center p-2 rounded-lg bg-card/50 border border-border/50">
              <span className="text-[10px] text-muted-foreground">Dit snit</span>
              <span className="text-sm font-bold">{formatCurrency(actualDailyAvg)}</span>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardContent>
    </Card>
  );
}
