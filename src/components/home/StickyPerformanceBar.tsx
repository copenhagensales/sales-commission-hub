import { useState, useEffect } from "react";
import { TrendingUp, Target } from "lucide-react";

interface StickyPerformanceBarProps {
  progressPercent: number;
  hasGoal: boolean;
  periodCommission: number;
  showThreshold?: number;
}

export function StickyPerformanceBar({
  progressPercent,
  hasGoal,
  periodCommission,
  showThreshold = 200,
}: StickyPerformanceBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > showThreshold);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [showThreshold]);

  const formatCommission = (amount: number) => {
    return new Intl.NumberFormat("da-DK", {
      style: "decimal",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + " kr";
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background/98 to-background/95 backdrop-blur-md border-b border-border/50 shadow-lg animate-in slide-in-from-top-2 duration-300 md:hidden">
      <div className="flex items-center justify-center gap-6 py-2.5 px-4 max-w-lg mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-full ${
            hasGoal && progressPercent >= 100 
              ? 'bg-emerald-500/10' 
              : 'bg-primary/10'
          }`}>
            <Target className={`w-3.5 h-3.5 ${
              hasGoal && progressPercent >= 100 
                ? 'text-emerald-500' 
                : 'text-primary'
            }`} />
          </div>
          <span className={`font-bold tabular-nums text-sm ${
            hasGoal && progressPercent >= 100 ? 'text-emerald-500' : ''
          }`}>
            {hasGoal ? `${Math.round(progressPercent)}%` : "–"}
          </span>
        </div>

        <div className="w-px h-6 bg-border/60" />

        {/* Commission */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-full bg-primary/10">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="font-bold tabular-nums text-sm">
            {formatCommission(periodCommission)}
          </span>
        </div>
      </div>
    </div>
  );
}