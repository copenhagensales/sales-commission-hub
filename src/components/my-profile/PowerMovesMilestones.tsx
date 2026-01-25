import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

const POWER_MOVES = [
  { amount: 10000, name: "The Shield", emoji: "🛡️" },
  { amount: 15000, name: "The Starter", emoji: "🌱" },
  { amount: 20000, name: "The Player", emoji: "🎯" },
  { amount: 25000, name: "The Seed", emoji: "💰" },
  { amount: 30000, name: "The Builder", emoji: "🏗️" },
  { amount: 35000, name: "The Accelerator", emoji: "⚡" },
  { amount: 40000, name: "The Veteran", emoji: "🎖️" },
  { amount: 50000, name: "The Multiplier", emoji: "👑" },
];

interface PowerMovesMilestonesProps {
  currentAmount: number;
  projectedAmount: number;
  className?: string;
}

export function PowerMovesMilestones({ currentAmount, projectedAmount, className }: PowerMovesMilestonesProps) {
  // Current achievement (what user has NOW)
  const currentAchieved = POWER_MOVES.filter(m => currentAmount >= m.amount);
  const currentLast = currentAchieved[currentAchieved.length - 1] || null;
  const currentNext = POWER_MOVES.find(m => currentAmount < m.amount) || null;
  const currentDistanceToNext = currentNext ? currentNext.amount - currentAmount : 0;
  
  // Projected achievement (where user will END UP)
  const projectedAchieved = POWER_MOVES.filter(m => projectedAmount >= m.amount);
  const projectedLast = projectedAchieved[projectedAchieved.length - 1] || null;
  const projectedNext = POWER_MOVES.find(m => projectedAmount < m.amount) || null;
  const projectedDistanceToNext = projectedNext ? projectedNext.amount - projectedAmount : 0;

  // Check if projection unlocks new milestones beyond current
  const willUnlockNew = projectedAchieved.length > currentAchieved.length;
  
  // If no milestones at all, don't render
  if (!currentNext && !projectedNext) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-warning", className)}>
        <span>👑</span>
        <span className="font-medium">Boss Mode Aktiv!</span>
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2 text-xs flex-wrap", className)}>
      <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
      
      {/* Current status */}
      {currentLast && (
        <span className="text-muted-foreground">
          {currentLast.emoji} {currentLast.name} ✓
        </span>
      )}
      
      {/* Arrow to next */}
      {(currentNext || projectedNext) && (
        <span className="text-muted-foreground">→</span>
      )}
      
      {/* Next milestone info */}
      {willUnlockNew && projectedLast ? (
        // Projection unlocks new milestone(s)
        <span className="text-primary font-medium">
          {projectedLast.emoji} {projectedLast.name} ved månedens udgang
          {projectedNext && (
            <span className="text-muted-foreground font-normal">
              {" "}· {projectedNext.name} kun {projectedDistanceToNext.toLocaleString("da-DK")} kr væk
            </span>
          )}
        </span>
      ) : currentNext ? (
        // Show current next milestone with distance
        <span className={cn(
          "font-medium",
          currentDistanceToNext < 3000 ? "text-primary animate-pulse" : "text-muted-foreground"
        )}>
          {currentNext.emoji} {currentNext.name}: {currentDistanceToNext.toLocaleString("da-DK")} kr
        </span>
      ) : null}
    </div>
  );
}
