import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Target, Trophy, TrendingUp, Wallet, CalendarRange } from "lucide-react";
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
  /** e.g. "15. jun – 14. jul" */
  periodLabel?: string;
  /** Amount per remaining workday needed to reach the goal */
  dailyNeeded?: number;
  /** Remaining calendar days in the payroll period */
  remainingDays?: number;
}

const SEGMENTS = 20;

function formatAmount(amount: number) {
  return new Intl.NumberFormat("da-DK", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Counts up to `target` over 600ms, respecting reduced-motion. */
function useCountUp(target: number) {
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (prefersReducedMotion() || target === 0) {
      setValue(target);
      return;
    }
    const duration = 600;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(target * eased);
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        setValue(target);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return value;
}

export function HeroPerformanceCard({
  firstName,
  periodCommission,
  targetAmount,
  progressPercent,
  hasGoal,
  isEnrolledInLeague = true,
  vacationPay = 0,
  periodLabel,
  dailyNeeded = 0,
  remainingDays = 0,
}: HeroPerformanceCardProps) {
  const animatedCommission = useCountUp(periodCommission);
  const animatedPercent = useCountUp(progressPercent);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Godmorgen";
    if (hour < 17) return "God eftermiddag";
    return "God aften";
  }, []);

  const cappedPercent = Math.min(Math.max(animatedPercent, 0), 100);
  const filledSegments = Math.round((cappedPercent / 100) * SEGMENTS);

  const goalReached = hasGoal && progressPercent >= 100;

  const progressToneClass = !hasGoal
    ? "text-muted-foreground"
    : progressPercent >= 100
      ? "text-success"
      : progressPercent >= 60
        ? "text-primary"
        : "text-warning";

  const segmentToneClass = !hasGoal
    ? "bg-muted-foreground/40"
    : progressPercent >= 100
      ? "bg-success"
      : progressPercent >= 60
        ? "bg-primary"
        : "bg-warning";

  const metrics = [
    {
      icon: Target,
      label: "Mål i perioden",
      value: hasGoal ? `${formatAmount(targetAmount)} kr` : "Ikke sat",
      hint: hasGoal ? `${Math.round(progressPercent)}% nået` : "Sæt et mål for at tracke",
      tone: hasGoal ? progressToneClass : "text-muted-foreground",
    },
    {
      icon: TrendingUp,
      label: "Dagligt tempo",
      value: hasGoal
        ? goalReached
          ? "Mål nået"
          : `${formatAmount(dailyNeeded)} kr`
        : "–",
      hint: hasGoal
        ? goalReached
          ? "Alt herfra er ekstra"
          : `${remainingDays} dage tilbage`
        : `${remainingDays} dage tilbage`,
      tone: goalReached ? "text-success" : "text-foreground",
    },
    {
      icon: Wallet,
      label: "Feriepenge",
      value: `${formatAmount(vacationPay)} kr`,
      hint: "optjent i perioden",
      tone: "text-foreground",
    },
  ];

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
      {/* Restrained brand wash — no pulse, no shimmer */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.07] via-transparent to-transparent"
      />

      <div className="relative z-10 p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground md:text-xl">
              {greeting}, {firstName}
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">
              Din provision i denne lønperiode
            </p>
          </div>
          {periodLabel && (
            <div className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 py-1 text-[11px] text-muted-foreground md:text-xs">
              <CalendarRange className="h-3.5 w-3.5" />
              <span className="tabular-nums">{periodLabel}</span>
            </div>
          )}
        </div>

        {/* Main figure + metrics */}
        <div className="mt-5 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] md:items-end md:gap-8">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-4xl font-semibold tabular-nums tracking-tight text-foreground md:text-5xl">
                {formatAmount(animatedCommission)}
              </span>
              <span className="text-lg text-muted-foreground md:text-xl">kr</span>
            </div>

            {/* Segmented goal bar */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground md:text-xs">
                <span>{hasGoal ? "Fremgang mod mål" : "Intet mål sat"}</span>
                <span className={cn("font-semibold tabular-nums", progressToneClass)}>
                  {hasGoal ? `${Math.round(progressPercent)}%` : "–"}
                </span>
              </div>
              <div className="mt-1.5 flex gap-[3px]" role="presentation">
                {Array.from({ length: SEGMENTS }).map((_, index) => (
                  <span
                    key={index}
                    className={cn(
                      "h-2 flex-1 rounded-[2px] transition-colors duration-300",
                      index < filledSegments ? segmentToneClass : "bg-muted/60"
                    )}
                  />
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" className="h-9 gap-1.5">
                <Link to="/my-goals">
                  {hasGoal ? "Se dit mål" : "Sæt dit mål"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
              {!isEnrolledInLeague && (
                <Button asChild size="sm" variant="ghost" className="h-9 gap-1.5">
                  <Link to="/commission-league">
                    <Trophy className="h-3.5 w-3.5" />
                    Tilmeld liga
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Metric row */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 md:gap-3">
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-lg border border-border/50 bg-background/30 p-3"
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <metric.icon className="h-3.5 w-3.5" />
                  <span className="truncate">{metric.label}</span>
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-base font-semibold tabular-nums leading-tight md:text-lg",
                    metric.tone
                  )}
                >
                  {metric.value}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{metric.hint}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
