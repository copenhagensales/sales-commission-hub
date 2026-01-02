import { type MotivationalQuote, type PerformanceStatus } from "@/lib/gamification-quotes";
import { cn } from "@/lib/utils";

interface SalesMotivationalQuoteProps {
  quote: MotivationalQuote;
  status: PerformanceStatus;
}

const statusColors: Record<PerformanceStatus, string> = {
  behind: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  on_track: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  ahead: "text-green-400 bg-green-500/10 border-green-500/20",
  goal_reached: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
};

export function SalesMotivationalQuote({ quote, status }: SalesMotivationalQuoteProps) {
  const Icon = quote.icon;

  return (
    <div 
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all animate-fade-in",
        statusColors[status]
      )}
    >
      <Icon className="h-5 w-5 flex-shrink-0" />
      <p className="text-sm font-medium italic">"{quote.quote}"</p>
    </div>
  );
}
