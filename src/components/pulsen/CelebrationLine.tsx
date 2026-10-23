import { useState } from "react";
import type { Celebration } from "@/components/home/CelebrationStrip";
import { ReactButton, ReactionBubbles } from "@/components/home/FeedReactionRow";
import { FeedCommentList } from "@/components/home/FeedCommentList";
import { PulsenAvatar } from "@/components/pulsen/PulsenAvatar";
import { buildTargetKey, useFeedReactions } from "@/hooks/useFeedReactions";
import { shortName } from "@/lib/pulsen/format";
import { cn } from "@/lib/utils";

/** Samme målnøgle som forsidens CelebrationStrip, så hilsner deles. */
export const celebrationKey = (c: Celebration) => buildTargetKey(c.type, [c.employeeId, c.date.getFullYear()]);

const short = (full: string) => { const [f, ...r] = full.split(" "); return shortName(f, r.join(" ")); };

/** Dagens fødselsdage/jubilæer som smalle linjer (højst 3 + "+n mere"). */
export function CelebrationLines({ celebrations, variant = "line" }: { celebrations: Celebration[]; variant?: "line" | "dashed" }) {
  const [showAll, setShowAll] = useState(false);
  const fr = useFeedReactions(celebrations.map(celebrationKey));
  if (celebrations.length === 0) return null;
  const visible = showAll ? celebrations : celebrations.slice(0, 3);
  return (
    <div className={cn("flex flex-col", variant === "line" ? "gap-2" : "gap-1")}>
      {visible.map((c) => <Line key={celebrationKey(c)} c={c} fr={fr} variant={variant} />)}
      {celebrations.length > 3 && !showAll && (
        <button type="button" onClick={() => setShowAll(true)} className="min-h-[44px] self-start px-2 text-[13px] font-extrabold text-muted-foreground">
          +{celebrations.length - 3} mere
        </button>
      )}
    </div>
  );
}

function Line({ c, fr, variant }: { c: Celebration; fr: ReturnType<typeof useFeedReactions>; variant: "line" | "dashed" }) {
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const key = celebrationKey(c);
  const summary = fr.getReactions(key);
  const comments = fr.getComments(key);
  const greetings = summary.total + comments.length;
  const what = c.type === "birthday" ? "har fødselsdag 🇩🇰" : `${c.years} års jubilæum`;
  return (
    <div className={cn(variant === "line" ? "rounded-[20px] bg-card px-4 py-2" : "rounded-[16px] border border-dashed border-border px-3 py-1")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {variant === "line" && <span className="hidden whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground sm:inline">I dag</span>}
        <PulsenAvatar employeeId={c.employeeId} name={c.name} size={32} />
        <p className="min-w-0 flex-1 truncate text-[14px]">
          <b className="font-extrabold">{short(c.name)}</b> {what}
          {greetings > 0 && <span className="text-muted-foreground"> · {greetings} {greetings === 1 ? "hilsen" : "hilsner"}</span>}
        </p>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
          {summary.total > 0 && <ReactionBubbles summary={summary} size={22} />}
          <ReactButton compact summary={summary} disabled={!fr.canInteract} className="flex-none"
            onSet={(reaction) => fr.setReaction.mutate({ targetType: c.type, targetKey: key, reaction })} />
          <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)}
            className="min-h-[44px] flex-none whitespace-nowrap rounded-full bg-[hsl(var(--cph-light-blue))] px-4 text-[13px] font-extrabold text-foreground">
            Sig tillykke
          </button>
        </div>
      </div>
      {open && (
        <div className="pb-2 pt-1">
          <div className="flex items-center gap-1 border-y border-border py-0.5">
            <button type="button" disabled={!fr.canInteract} onClick={() => setComposing(true)}
              className="min-h-[44px] rounded-xl px-3 text-[14px] font-semibold text-muted-foreground hover:bg-muted">Skriv besked</button>
          </div>
          <div className="mt-2">
            <FeedCommentList targetType={c.type} targetKey={key} comments={comments} composing={composing}
              onCloseComposer={() => setComposing(false)} placeholder={c.type === "birthday" ? "Tillykke med dagen …" : "Godt gået …"}
              onAdd={(a) => fr.addComment.mutateAsync(a)} onDelete={(id) => fr.deleteComment.mutateAsync(id)} />
          </div>
        </div>
      )}
    </div>
  );
}
