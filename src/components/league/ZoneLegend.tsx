import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";

interface ZoneLegendProps {
  className?: string;
}

export function ZoneLegend({ className }: ZoneLegendProps) {
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground",
      "p-2 rounded-lg bg-muted/30",
      className
    )}>
      {/* Zone indicators */}
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-sm bg-green-500" />
        <span>Oprykker</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-sm bg-orange-500" />
        <span>Playoff</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-sm bg-red-500" />
        <span>Nedrykker</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-sm bg-yellow-500" />
        <span>Top 2</span>
      </div>
      
      {/* Division movement - compact */}
      <div className="flex items-center gap-1 text-green-600">
        <ArrowUp className="h-3 w-3" />
        <span>Oprykket</span>
      </div>
      <div className="flex items-center gap-1 text-red-600">
        <ArrowDown className="h-3 w-3" />
        <span>Nedrykket</span>
      </div>
    </div>
  );
}
