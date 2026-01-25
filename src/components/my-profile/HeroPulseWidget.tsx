import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, TrendingUp, Flame, Rocket, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PulseThresholds, getPulseStatus } from "@/hooks/useGamificationConfig";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeroPulseWidgetProps {
  pulsePercent: number;
  todayTotal: number;
  actualDailyAvg: number;
  thresholds: PulseThresholds;
  className?: string;
}

// Flipped narrative: Focus on achievements, not gaps
const STATUS_CONFIG = {
  flying: {
    label: "High Score! 🚀",
    icon: Rocket,
    colorClass: "text-[hsl(160_84%_39%)]", // Electric teal
    bgClass: "bg-[hsl(160_84%_39%/0.15)]",
    borderClass: "border-[hsl(160_84%_39%/0.4)]",
    pulseClass: "hero-pulse-flying",
    gradient: "from-[hsl(160_84%_39%/0.25)] to-[hsl(160_84%_39%/0.05)]",
  },
  ahead: {
    label: "Kører godt! 💪",
    icon: TrendingUp,
    colorClass: "text-success",
    bgClass: "bg-success/15",
    borderClass: "border-success/40",
    pulseClass: "hero-pulse-ahead",
    gradient: "from-success/20 to-success/5",
  },
  close: {
    label: "Tænd op! 🔥",
    icon: Flame,
    colorClass: "text-amber-400",
    bgClass: "bg-amber-500/10",
    borderClass: "border-amber-500/30",
    pulseClass: "hero-pulse-warmup",
    gradient: "from-amber-500/15 to-amber-500/5",
  },
  behind: {
    label: "Tid til boost!",
    icon: Zap,
    colorClass: "text-primary",
    bgClass: "bg-primary/10",
    borderClass: "border-primary/30",
    pulseClass: "hero-pulse-slow",
    gradient: "from-primary/15 to-primary/5",
  },
};

export function HeroPulseWidget({
  pulsePercent,
  todayTotal,
  actualDailyAvg,
  thresholds,
  className,
}: HeroPulseWidgetProps) {
  const status = getPulseStatus(pulsePercent, thresholds);
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0,
    }).format(value);
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
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-50",
          config.gradient
        )}
      />

      <CardContent className="relative p-4">
        {/* Header */}
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <Zap className={cn("h-4 w-4", config.colorClass)} />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Din Puls
          </span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-center">
                <p className="text-xs">
                  Viser din præstation i dag sammenlignet med dit daglige gennemsnit. 100% = du matcher dit snit.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Main Pulse Circle */}
        <div className="flex justify-center mb-3">
          <div
            className={cn(
              "relative flex items-center justify-center w-24 h-24 rounded-full border-[3px]",
              config.borderClass,
              config.bgClass,
              config.pulseClass
            )}
          >
            {/* Inner glow effect */}
            <div
              className={cn(
                "absolute inset-1.5 rounded-full opacity-30",
                config.bgClass
              )}
            />

            {/* Percentage display */}
            <div className="relative z-10 text-center">
              <span
                className={cn(
                  "text-2xl font-bold tabular-nums",
                  config.colorClass
                )}
              >
                {Math.round(pulsePercent)}%
              </span>
            </div>
          </div>
        </div>

        {/* Status label */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          <StatusIcon className={cn("h-4 w-4", config.colorClass)} />
          <span className={cn("text-sm font-semibold", config.colorClass)}>
            {config.label}
          </span>
        </div>

        {/* Supporting chips */}
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col items-center p-2 rounded-lg bg-card/50 border border-border/50">
            <span className="text-[10px] text-muted-foreground mb-0.5">I dag</span>
            <span className="text-sm font-bold text-foreground">
              {formatCurrency(todayTotal)}
            </span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-card/50 border border-border/50">
            <span className="text-[10px] text-muted-foreground mb-0.5">Dit snit</span>
            <span className="text-sm font-bold text-foreground">
              {formatCurrency(actualDailyAvg)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
