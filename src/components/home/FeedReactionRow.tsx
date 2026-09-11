import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FEED_EMOJIS,
  type FeedEmoji,
  type FeedReactionSummary,
  type FeedTargetType,
} from "@/hooks/useFeedReactions";

interface FeedReactionRowProps {
  targetType: FeedTargetType;
  targetKey: string;
  reactions: FeedReactionSummary[];
  onToggle: (args: { targetType: FeedTargetType; targetKey: string; emoji: FeedEmoji }) => void;
  disabled?: boolean;
  className?: string;
}

export function FeedReactionRow({
  targetType,
  targetKey,
  reactions,
  onToggle,
  disabled = false,
  className,
}: FeedReactionRowProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {FEED_EMOJIS.map(({ key, symbol, label }) => {
          const summary = reactions.find((r) => r.emoji === key);
          const count = summary?.count ?? 0;
          const mine = summary?.mine ?? false;
          const names = summary?.names ?? [];

          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={mine}
                  aria-label={
                    count > 0
                      ? `${label} — ${count}${mine ? ", din reaktion er givet" : ""}`
                      : `${label} — ingen endnu`
                  }
                  disabled={disabled}
                  onClick={() => onToggle({ targetType, targetKey, emoji: key })}
                  className={cn(
                    "h-8 gap-1.5 rounded-full border px-2.5 text-[13px] font-semibold",
                    mine
                      ? "border-[hsl(var(--cph-onyx))] bg-[hsl(var(--cph-light-blue))] text-[hsl(var(--cph-onyx))]"
                      : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span aria-hidden="true">{symbol}</span>
                  <span className="sr-only">{label}</span>
                  <span className="tabular-nums">{count}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {names.length > 0 ? `${label}: ${names.join(", ")}` : `${label} — ingen endnu`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
