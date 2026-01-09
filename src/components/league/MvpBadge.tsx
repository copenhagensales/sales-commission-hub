import { cn } from "@/lib/utils";
import { Star, Crown } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface MvpBadgeProps {
  type: "division" | "overall";
  className?: string;
}

export function MvpBadge({ type, className }: MvpBadgeProps) {
  const isOverall = type === "overall";
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
              isOverall
                ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30"
                : "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30",
              className
            )}
          >
            {isOverall ? (
              <Crown className="h-3 w-3" />
            ) : (
              <Star className="h-3 w-3" />
            )}
            <span>MVP</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {isOverall
            ? "MVP af ugen - Højeste provision i hele ligaen"
            : "Divisionens MVP - Højeste provision i divisionen"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
