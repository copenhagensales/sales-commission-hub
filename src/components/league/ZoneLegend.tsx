import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ZoneLegendProps {
  className?: string;
}

export function ZoneLegend({ className }: ZoneLegendProps) {
  return (
    <div className={cn("flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground", className)}>
      {/* Zone forklaringer */}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-green-500" />
        <span>Oprykningszone</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-orange-500" />
        <span>Playoff zone</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-red-500" />
        <span>Nedrykningszone</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-yellow-500" />
        <span>Top 2 (Division 1)</span>
      </div>
      
      {/* Division-bevægelse forklaringer */}
      <div className="flex items-center gap-2">
        <Badge className="bg-green-600 hover:bg-green-600 text-white text-xs px-1.5 py-0.5">
          <ArrowUp className="h-3 w-3 mr-0.5" />
          Div X
        </Badge>
        <span>Lige oprykket</span>
      </div>
      <div className="flex items-center gap-2">
        <Badge className="bg-red-600 hover:bg-red-600 text-white text-xs px-1.5 py-0.5">
          <ArrowDown className="h-3 w-3 mr-0.5" />
          Div X
        </Badge>
        <span>Lige nedrykket</span>
      </div>
    </div>
  );
}
