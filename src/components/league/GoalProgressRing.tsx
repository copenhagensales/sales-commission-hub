import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GoalProgressRingProps {
  progress: number; // Current progress percentage (commission / target * 100)
  expectedPercent: number; // Expected progress at this point in the period
  current: number; // Current commission amount
  target: number; // Target amount
  expectedAmount: number; // Expected amount at this point
  size?: number;
  className?: string;
}

export function GoalProgressRing({
  progress,
  expectedPercent,
  current,
  target,
  expectedAmount,
  size = 38,
  className,
}: GoalProgressRingProps) {
  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  
  // Clamp progress to 0-100 for the ring, but show actual % in text
  const ringProgress = Math.min(100, Math.max(0, progress));
  const strokeDashoffset = circumference - (ringProgress / 100) * circumference;
  
  // Expected indicator position
  const expectedOffset = circumference - (Math.min(100, expectedPercent) / 100) * circumference;
  
  // Color based on performance vs expected
  const ratio = expectedPercent > 0 ? progress / expectedPercent : 1;
  const getColor = () => {
    if (ratio >= 1) return "text-green-500";
    if (ratio >= 0.8) return "text-yellow-500";
    return "text-red-500";
  };
  
  const getStatus = () => {
    if (ratio >= 1.1) return { text: "Foran skema! 🔥", color: "text-green-500" };
    if (ratio >= 1) return { text: "On track ✓", color: "text-green-500" };
    if (ratio >= 0.8) return { text: "Lidt bagud", color: "text-yellow-500" };
    return { text: "Markant bagud", color: "text-red-500" };
  };
  
  const status = getStatus();
  
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(value);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div className={cn("relative inline-flex items-center justify-center cursor-help", className)}>
            <svg width={size} height={size} className="transform -rotate-90">
              {/* Background circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-muted/20"
              />
              {/* Expected indicator (subtle dashed line) */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                strokeDasharray={`2 4`}
                strokeDashoffset={expectedOffset}
                className="text-muted-foreground/40"
                style={{
                  strokeDasharray: `${(expectedPercent / 100) * circumference} ${circumference}`,
                }}
              />
              {/* Progress circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={cn("transition-all duration-700 ease-out", getColor())}
              />
            </svg>
            <span className={cn(
              "absolute text-[9px] font-bold tabular-nums",
              getColor()
            )}>
              {Math.round(progress)}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="p-3 max-w-[200px]">
          <div className="space-y-1.5 text-xs">
            <p className="font-semibold">
              {formatCurrency(current)} <span className="text-muted-foreground font-normal">af {formatCurrency(target)}</span>
            </p>
            <p className="text-muted-foreground">
              Forventet nu: {formatCurrency(expectedAmount)}
            </p>
            <p className={cn("font-medium", status.color)}>
              {status.text}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function GoalProgressRingEmpty({ size = 38 }: { size?: number }) {
  return (
    <div 
      className="inline-flex items-center justify-center text-muted-foreground/30"
      style={{ width: size, height: size }}
    >
      <span className="text-[10px]">–</span>
    </div>
  );
}
