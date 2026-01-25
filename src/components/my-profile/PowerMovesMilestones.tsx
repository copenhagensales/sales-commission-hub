import { cn } from "@/lib/utils";
import { TrendingUp } from "lucide-react";

interface PowerMovesMilestonesProps {
  currentAmount: number;
  projectedAmount: number;
  className?: string;
}

const MAX_AMOUNT = 50000;

export function PowerMovesMilestones({ currentAmount, projectedAmount, className }: PowerMovesMilestonesProps) {
  // Current position (what you have NOW)
  const currentProgress = Math.min(100, (currentAmount / MAX_AMOUNT) * 100);
  
  // Projected position (where you'll END UP)
  const projectedProgress = Math.min(100, (projectedAmount / MAX_AMOUNT) * 100);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Provision i perioden</span>
      </div>

      {/* Thick progress bar */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">0 kr</span>
        <div className="flex-1 relative h-5 bg-muted rounded-full overflow-hidden">
          {/* Projected progress (lighter) */}
          <div 
            className="absolute inset-y-0 left-0 bg-primary/30 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${projectedProgress}%` }}
          />
          {/* Current progress (solid green) */}
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-success to-success/80 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${currentProgress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">50k</span>
      </div>

      {/* Simple legend */}
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-success mr-1.5" />
          Du er her
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-full bg-primary/30 mr-1.5" />
          Målpunkt
        </span>
      </div>
    </div>
  );
}
