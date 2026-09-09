import { useMemo, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, Target, ArrowRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    if (progressPercent >= 120) return "Du er i topform!";
    if (progressPercent >= 100) return "Mål nået! Går du efter rekorden?";
    if (progressPercent >= 80) return "Målstregen er i sigte!";
    if (progressPercent >= 50) return "Du er på vej - keep going!";
    return "Hver samtale tæller!";
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

  return (
    <section className="relative overflow-hidden rounded-3xl bg-[hsl(var(--cph-onyx))] p-6 md:p-10 text-[hsl(var(--cph-light-blue))]">
      {/* Top row: KPI + supporting numbers */}
      <div className="relative flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[hsl(var(--cph-emerald))]">
            Provision denne periode
          </p>
          <p className="mt-3 text-[clamp(44px,7vw,72px)] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
            {formatCommission(animatedCommission)} kr
          </p>
          {vacationPay > 0 && (
            <p className="mt-2 text-[13px] text-[hsl(var(--cph-light-blue)/0.72)]">
              + {formatCommission(vacationPay)} kr feriepenge
            </p>
          )}
        </div>

        <div className="flex gap-10 md:flex-col md:items-end md:gap-6 md:text-right">
          <div>
            <p className="text-[22px] font-extrabold leading-none tabular-nums">
              {hasGoal ? `${animatedPercent}%` : "—"}
            </p>
            <p className="mt-1 text-[13px] text-[hsl(var(--cph-light-blue)/0.72)]">af dit mål</p>
          </div>
          <div>
            <p className="text-[22px] font-extrabold leading-none tabular-nums text-[hsl(var(--cph-emerald))]">
              {hasGoal ? `${formatCommission(targetAmount)} kr` : "Intet mål"}
            </p>
            <p className="mt-1 text-[13px] text-[hsl(var(--cph-light-blue)/0.72)]">månedsmål</p>
          </div>
        </div>
      </div>

      {/* Progress line */}
      {hasGoal && (
        <div className="relative mt-8 h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--cph-light-blue)/0.14)]">
          <div
            className="h-full rounded-full bg-[hsl(var(--cph-emerald))] transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(animatedPercent, 100)}%` }}
          />
        </div>
      )}

      {/* Message + actions */}
      <div className="relative mt-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-[520px]">
          <span className="block h-[3px] w-10 rounded-sm bg-[hsl(var(--cph-emerald))]" />
          <h2 className="mt-4 text-[20px] font-extrabold leading-[1.25]">
            {hasGoal ? motivationalMessage : "Dit første mål venter."}
          </h2>
          <p className="mt-2 text-[15px] leading-[1.5] text-[hsl(var(--cph-light-blue)/0.72)]">
            {hasGoal
              ? `Du har ${formatCommission(Math.max(targetAmount - periodCommission, 0))} kr tilbage til dit mål.`
              : "Sæt et månedsmål, så følger vi din fremgang dag for dag."}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to={ctaConfig.href}>
            <Button
              className="h-auto w-full gap-2 rounded-xl bg-[hsl(var(--cph-light-blue))] px-[22px] py-[14px] text-[15px] font-extrabold text-[hsl(var(--cph-onyx))] hover:bg-white sm:w-auto"
            >
              {ctaConfig.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          {!isEnrolledInLeague && (
            <Link to="/commission-league">
              <Button
                variant="outline"
                className="h-auto w-full gap-2 rounded-xl border-[hsl(var(--cph-emerald)/0.45)] bg-transparent px-[22px] py-[14px] text-[15px] font-extrabold text-[hsl(var(--cph-emerald))] hover:bg-[hsl(var(--cph-emerald)/0.1)] hover:text-[hsl(var(--cph-emerald))] sm:w-auto"
              >
                <Trophy className="h-4 w-4" />
                Tilmeld liga
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}

