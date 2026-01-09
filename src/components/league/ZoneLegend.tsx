import { cn } from "@/lib/utils";

interface ZoneLegendProps {
  className?: string;
}

export function ZoneLegend({ className }: ZoneLegendProps) {
  return (
    <div className={cn("flex flex-wrap gap-4 text-sm text-muted-foreground", className)}>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-green-500" />
        <span>Oprykningszone</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-orange-500" />
        <span>Duel zone</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-red-500" />
        <span>Nedrykningszone</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded bg-yellow-500" />
        <span>Top 2 (Division 1)</span>
      </div>
    </div>
  );
}
