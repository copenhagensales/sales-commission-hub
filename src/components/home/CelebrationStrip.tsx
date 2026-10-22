import { useState } from "react";
import { Award, Cake, MessageCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ReactButton, ReactionSummaryLine } from "@/components/home/FeedReactionRow";
import { FeedCommentList } from "@/components/home/FeedCommentList";
import { buildTargetKey, useFeedReactions } from "@/hooks/useFeedReactions";
import type { ReactionKey } from "@/lib/feedReactions";
import { PlayerProfileHoverCard } from "@/components/profile-card/PlayerProfileHoverCard";

export interface Celebration {
  employeeId: string;
  type: "birthday" | "anniversary";
  name: string;
  years?: number;
  date: Date;
  isToday: boolean;
}

interface CelebrationStripProps {
  celebrations: Celebration[];
}

export function CelebrationStrip({ celebrations }: CelebrationStripProps) {
  const targets = celebrations.map((celebration) => ({
    celebration,
    key: buildTargetKey(celebration.type, [
      celebration.employeeId,
      celebration.date.getFullYear(),
    ]),
  }));

  const {
    getReactions,
    getComments,
    setReaction,
    addComment,
    deleteComment,
    canInteract,
  } = useFeedReactions(targets.map((t) => t.key));

  if (celebrations.length === 0) return null;

  return (
    <Card className="border border-border bg-card rounded-3xl animate-fade-in">
      <CardContent className="py-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {targets.map(({ celebration, key }) => (
            <CelebrationItem
              key={key}
              celebration={celebration}
              targetKey={key}
              summary={getReactions(key)}
              comments={getComments(key)}
              canInteract={canInteract}
              onReact={(reaction) =>
                setReaction.mutate({ targetType: celebration.type, targetKey: key, reaction })
              }
              onAdd={(args) => addComment.mutateAsync(args)}
              onDelete={(id) => deleteComment.mutateAsync(id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface CelebrationItemProps {
  celebration: Celebration;
  targetKey: string;
  summary: ReturnType<ReturnType<typeof useFeedReactions>["getReactions"]>;
  comments: ReturnType<ReturnType<typeof useFeedReactions>["getComments"]>;
  canInteract: boolean;
  onReact: (reaction: ReactionKey) => void;
  onAdd: (args: { targetType: Celebration["type"]; targetKey: string; body: string }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
}

function CelebrationItem({
  celebration,
  targetKey,
  summary,
  comments,
  canInteract,
  onReact,
  onAdd,
  onDelete,
}: CelebrationItemProps) {
  const [composing, setComposing] = useState(false);
  const subtitle =
    celebration.type === "anniversary"
      ? `${celebration.years} års jubilæum${celebration.isToday ? " · i dag" : ""}`
      : `Fødselsdag${celebration.isToday ? " · i dag" : ""}`;

  return (
    <div className="rounded-3xl bg-card px-4 py-4">
      <div className="flex items-center gap-3">
        <PlayerProfileHoverCard employeeId={celebration.employeeId}>
          <span className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-xl bg-warning/15">
            {celebration.type === "birthday" ? (
              <Cake className="h-5 w-5 text-warning" aria-hidden="true" />
            ) : (
              <Award className="h-5 w-5 text-warning" aria-hidden="true" />
            )}
          </span>
        </PlayerProfileHoverCard>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[20px] font-semibold leading-tight text-foreground">{celebration.name}</p>
          <p className="text-[14px] text-muted-foreground">{subtitle}</p>
        </div>
      </div>

      <div className="mt-2">
        <ReactionSummaryLine summary={summary} />
      </div>

      <div className="my-1 flex items-center gap-1 border-y border-border py-0.5">
        <ReactButton summary={summary} onSet={onReact} disabled={!canInteract} />
        <button
          type="button"
          disabled={!canInteract}
          onClick={() => setComposing(true)}
          className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-[14px] font-semibold text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          Skriv besked
        </button>
      </div>

      <div className="mt-2">
        <FeedCommentList
          targetType={celebration.type}
          targetKey={targetKey}
          comments={comments}
          composing={composing}
          onCloseComposer={() => setComposing(false)}
          placeholder={celebration.type === "birthday" ? "Tillykke med dagen …" : "Godt gået …"}
          onAdd={onAdd}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}
