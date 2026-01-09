import { cn } from "@/lib/utils";
import { ChevronUp, ChevronDown, Swords } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface RivalryData {
  name: string;
  provision: number;
  gap: number;
}

interface RivalryIndicatorProps {
  above: RivalryData | null;
  below: RivalryData | null;
  className?: string;
}

export function RivalryIndicator({ above, below, className }: RivalryIndicatorProps) {
  if (!above && !below) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2", className)}>
            <Swords className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col gap-0.5 text-[11px]">
              {above && (
                <div className="flex items-center gap-1 text-amber-600">
                  <ChevronUp className="h-3 w-3" />
                  <span className="font-mono">-{above.gap.toLocaleString("da-DK")}</span>
                </div>
              )}
              {below && (
                <div className="flex items-center gap-1 text-green-600">
                  <ChevronDown className="h-3 w-3" />
                  <span className="font-mono">+{below.gap.toLocaleString("da-DK")}</span>
                </div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-xs max-w-[200px]">
          <div className="space-y-2">
            {above && (
              <div>
                <p className="text-amber-600 font-medium flex items-center gap-1">
                  <ChevronUp className="h-3 w-3" /> Over dig
                </p>
                <p><strong>{above.name}</strong></p>
                <p className="text-muted-foreground">
                  {above.gap.toLocaleString("da-DK")} kr foran
                </p>
              </div>
            )}
            {below && (
              <div>
                <p className="text-green-600 font-medium flex items-center gap-1">
                  <ChevronDown className="h-3 w-3" /> Under dig
                </p>
                <p><strong>{below.name}</strong></p>
                <p className="text-muted-foreground">
                  {below.gap.toLocaleString("da-DK")} kr efter
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
