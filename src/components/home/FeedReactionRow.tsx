import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FEED_EMOJI_OPTIONS,
  emojiLabel,
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
  const [open, setOpen] = useState(false);

  const pick = (emoji: string) => {
    onToggle({ targetType, targetKey, emoji });
    setOpen(false);
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
        {reactions.map(({ emoji, count, names, mine }) => {
          const label = emojiLabel(emoji);
          return (
            <Tooltip key={emoji}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-pressed={mine}
                  aria-label={`${label} — ${count}${mine ? ", din reaktion er givet" : ""}`}
                  disabled={disabled}
                  onClick={() => onToggle({ targetType, targetKey, emoji })}
                  className={cn(
                    "h-8 gap-1.5 rounded-full border px-2.5 text-[13px] font-semibold",
                    mine
                      ? "border-[hsl(var(--cph-onyx))] bg-[hsl(var(--cph-light-blue))] text-[hsl(var(--cph-onyx))]"
                      : "border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <span aria-hidden="true">{emoji}</span>
                  <span className="tabular-nums">{count}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {names.length > 0 ? `${label}: ${names.join(", ")}` : `${label} — ingen endnu`}
              </TooltipContent>
            </Tooltip>
          );
        })}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              aria-label="Vælg en reaktion"
              className="h-8 w-8 flex-none rounded-full border-border bg-background p-0 text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <SmilePlus className="h-4 w-4" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1">
              {FEED_EMOJI_OPTIONS.map(({ symbol, label }) => (
                <Button
                  key={symbol}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-label={label}
                  className="h-9 w-9 p-0 text-[18px]"
                  onClick={() => pick(symbol)}
                >
                  <span aria-hidden="true">{symbol}</span>
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </TooltipProvider>
  );
}
