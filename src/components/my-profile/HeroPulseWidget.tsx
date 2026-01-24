import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, TrendingUp, TrendingDown, Minus, Flame, Rocket, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { PulseThresholds, getPulseStatus } from "@/hooks/useGamificationConfig";

interface HeroPulseWidgetProps {
  pulsePercent: number;
  todayTotal: number;
  actualDailyAvg: number;
  thresholds: PulseThresholds;
  className?: string;
}

const STATUS_CONFIG = {
  flying: {
    label: "Flyver! 🚀",
    icon: Rocket,
    colorClass: "text-success",
    bgClass: "bg-success/10",
    borderClass: "border-success/30",
    pulseClass: "hero-pulse-flying",
    gradient: "from-success/20 to-success/5",
  },
  ahead: {
    label: "Foran plan",
    icon: TrendingUp,
    colorClass: "text-success",
    bgClass: "bg-success/10",
    borderClass: "border-success/30",
    pulseClass: "hero-pulse-ahead",
    gradient: "from-success/15 to-success/5",
  },
  close: {
    label: "Tæt på mål",
    icon: Target,
    colorClass: "text-warning",
    bgClass: "bg-warning/10",
    borderClass: "border-warning/30",
    pulseClass: "hero-pulse-close",
    gradient: "from-warning/15 to-warning/5",
  },
  behind: {
    label: "Gap til plan",
    icon: TrendingDown,
    colorClass: "text-destructive",
    bgClass: "bg-destructive/10",
    borderClass: "border-destructive/30",
    pulseClass: "hero-pulse-behind",
    gradient: "from-destructive/15 to-destructive/5",
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

      <CardContent className="relative p-6">
        {/* Header */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <Zap className={cn("h-5 w-5", config.colorClass)} />
          <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Din Puls
          </span>
          <Zap className={cn("h-5 w-5", config.colorClass)} />
        </div>

        {/* Main Pulse Circle */}
        <div className="flex justify-center mb-4">
          <div
            className={cn(
              "relative flex items-center justify-center w-36 h-36 rounded-full border-4",
              config.borderClass,
              config.bgClass,
              config.pulseClass
            )}
          >
            {/* Inner glow effect */}
            <div
              className={cn(
                "absolute inset-2 rounded-full opacity-30",
                config.bgClass
              )}
            />

            {/* Percentage display */}
            <div className="relative z-10 text-center">
              <span
                className={cn(
                  "text-4xl font-bold tabular-nums",
                  config.colorClass
                )}
              >
                {Math.round(pulsePercent)}%
              </span>
            </div>
          </div>
        </div>

        {/* Status label */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <StatusIcon className={cn("h-5 w-5", config.colorClass)} />
          <span className={cn("text-lg font-semibold", config.colorClass)}>
            {config.label}
          </span>
        </div>

        {/* Supporting chips */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col items-center p-3 rounded-lg bg-card/50 border border-border/50">
            <span className="text-xs text-muted-foreground mb-1">I dag</span>
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(todayTotal)}
            </span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-card/50 border border-border/50">
            <span className="text-xs text-muted-foreground mb-1">Dit snit</span>
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(actualDailyAvg)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
