import { useState } from "react";
import { ChevronDown, Smile } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DEFAULT_REACTION,
  REACTIONS,
  reactionOption,
  type ReactionKey,
} from "@/lib/feedReactions";
import type { FeedReactionSummary } from "@/hooks/useFeedReactions";

interface ReactButtonProps {
  summary: FeedReactionSummary;
  onSet: (reaction: ReactionKey) => void;
  disabled?: boolean;
  className?: string;
  /** Kun ikon, ingen tekst (Pulsens milepælslinjer). Standard uændret. */
  compact?: boolean;
}

/** "Reagér" giver 👏 med ét klik; pilen åbner vælgeren med de 5 reaktioner. */
export function ReactButton({ summary, onSet, disabled, className, compact = false }: ReactButtonProps) {
  const [open, setOpen] = useState(false);
  const mine = summary.myReaction ? reactionOption(summary.myReaction) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("flex items-center", className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSet(summary.myReaction ?? DEFAULT_REACTION)}
          aria-pressed={!!mine}
          aria-label={mine ? `Din reaktion: ${mine.label}. Klik for at fjerne` : "Reagér med Godt gået"}
          className={cn(
            "flex min-h-[44px] items-center gap-2 rounded-l-xl px-3 text-[14px] font-semibold transition-colors hover:bg-muted disabled:opacity-50",
            mine ? "text-primary" : "text-muted-foreground"
          )}
        >
          {mine ? (
            <span aria-hidden="true" className="text-[18px] leading-none">{mine.emoji}</span>
          ) : (
            <Smile className="h-5 w-5" aria-hidden="true" />
          )}
          {!compact && (mine ? mine.label : "Reagér")}
          {compact && summary.total > 0 && (
            <span className="tabular-nums" aria-label={`${summary.total} reaktioner`}>{summary.total}</span>
          )}
        </button>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Vælg reaktion"
            className="flex min-h-[44px] min-w-[32px] items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent align="start" className="w-auto rounded-2xl p-1.5">
        <div className="flex gap-1" role="group" aria-label="Reaktioner">
          {REACTIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={summary.myReaction === r.key}
              onClick={() => {
                onSet(r.key);
                setOpen(false);
              }}
              className={cn(
                "flex min-h-[56px] min-w-[60px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 transition-colors hover:bg-muted",
                summary.myReaction === r.key && "bg-muted"
              )}
            >
              <span aria-hidden="true" className="text-[24px] leading-none">{r.emoji}</span>
              <span className="text-[11px] text-muted-foreground">{r.label}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ReactionBubbles({ summary, size = 24 }: { summary: FeedReactionSummary; size?: number }) {
  return (
    <span className="flex" aria-hidden="true">
      {summary.groups.slice(0, 3).map((g, i) => (
        <span
          key={g.key}
          style={{ width: size, height: size, fontSize: size * 0.6, zIndex: 3 - i }}
          className={cn(
            "relative flex items-center justify-center rounded-full border border-border bg-card leading-none",
            i > 0 && "-ml-1.5"
          )}
        >
          {g.emoji}
        </span>
      ))}
    </span>
  );
}

function summaryText(summary: FeedReactionSummary): string {
  const others = summary.otherNames;
  if (summary.myReaction) {
    return others.length === 0 ? "Dig" : `Dig og ${others.length} ${others.length === 1 ? "anden" : "andre"}`;
  }
  if (others.length === 1) return others[0];
  if (others.length === 2) return `${others[0]} og ${others[1]}`;
  const rest = others.length - 2;
  return `${others[0]}, ${others[1]} og ${rest} ${rest === 1 ? "anden" : "andre"}`;
}

/** LinkedIn-agtig opsummering; klik folder fordelingen ud. */
export function ReactionSummaryLine({ summary }: { summary: FeedReactionSummary }) {
  const [open, setOpen] = useState(false);
  if (summary.total === 0) return null;
  return (
    <div className="min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${summary.total} reaktioner. Vis fordeling`}
        className="flex min-h-[44px] w-full min-w-0 max-w-full items-center gap-2 text-left text-[13px] text-muted-foreground hover:underline"
      >
        <span className="shrink-0"><ReactionBubbles summary={summary} /></span>
        <span className="min-w-0 flex-1 truncate">{summaryText(summary)}</span>
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5 pb-2">
          {summary.groups.map((g) => (
            <span key={g.key} className="rounded-full border border-border bg-muted/50 px-2.5 py-1 text-[12px] text-foreground">
              {g.emoji} {g.label} · {g.count}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
