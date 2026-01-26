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
    <div className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-b shadow-sm animate-in slide-in-from-top-2 duration-200 md:hidden">
      <div className="flex items-center justify-center gap-6 py-2 px-4 max-w-lg mx-auto">
        {/* Progress */}
        <div className="flex items-center gap-1.5">
          <Target className={`w-4 h-4 ${
            hasGoal && progressPercent >= 100 
              ? 'text-green-500' 
              : 'text-primary'
          }`} />
          <span className="font-bold tabular-nums">
            {hasGoal ? `${Math.round(progressPercent)}%` : "—"}
          </span>
        </div>

        <div className="w-px h-5 bg-border" />

        {/* Commission */}
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="font-bold tabular-nums text-sm">
            {formatCommission(periodCommission)}
          </span>
        </div>
      </div>
    </div>
  );
}