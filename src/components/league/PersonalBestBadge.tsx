import { cn } from "@/lib/utils";
import { TrendingUp, Flame } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PersonalBestBadgeProps {
  currentProvision: number;
  previousBest: number;
  className?: string;
}

export function PersonalBestBadge({ currentProvision, previousBest, className }: PersonalBestBadgeProps) {
  const improvement = currentProvision - previousBest;
  
  if (improvement <= 0) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold",
              "bg-gradient-to-r from-emerald-400 to-teal-500 text-white",
              "shadow-lg shadow-emerald-500/30",
              className
            )}
          >
            <Flame className="h-3 w-3" />
            <span>PB!</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <div>
              <p className="font-semibold">Ny personlig rekord!</p>
              <p className="text-muted-foreground">
                +{improvement.toLocaleString("da-DK")} kr over tidligere bedste
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
