import { cn } from "@/lib/utils";

interface ProgressRingProps {
  rank: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function ProgressRing({
  rank,
  total,
  size = 32,
  strokeWidth = 3,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Progress is inverted: rank 1 = 100%, last rank = ~0%
  const progress = ((total - rank + 1) / total) * 100;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  // Color based on position
  const getColor = () => {
    const percentile = rank / total;
    if (percentile <= 0.2) return "text-green-500"; // Top 20%
    if (percentile <= 0.5) return "text-blue-500";  // Top 50%
    if (percentile <= 0.8) return "text-orange-500"; // Top 80%
    return "text-red-500"; // Bottom 20%
  };

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/30"
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
          className={cn("transition-all duration-500", getColor())}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-foreground">
        {rank}
      </span>
    </div>
  );
}
