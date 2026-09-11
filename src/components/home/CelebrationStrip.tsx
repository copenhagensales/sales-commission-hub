import { Award, Cake } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FeedReactionRow } from "@/components/home/FeedReactionRow";
import { FeedCommentList } from "@/components/home/FeedCommentList";
import { buildTargetKey, useFeedReactions } from "@/hooks/useFeedReactions";
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
    toggleReaction,
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
            <div
              key={key}
              className="rounded-xl border border-primary/20 bg-background/80 px-4 py-3"
            >
              <div className="flex items-start gap-3">
                {celebration.type === "birthday" ? (
                  <Cake className="mt-0.5 h-5 w-5 flex-none text-foreground" aria-hidden="true" />
                ) : (
                  <Award className="mt-0.5 h-5 w-5 flex-none text-warning" aria-hidden="true" />
                )}
                <PlayerProfileHoverCard employeeId={celebration.employeeId}>
                  <div className="min-w-0 flex-1 cursor-default">
                    <p className="truncate font-medium text-foreground">{celebration.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {celebration.type === "anniversary"
                        ? `${celebration.years} års jubilæum`
                        : "Tillykke med fødselsdagen!"}
                    </p>
                  </div>
                </PlayerProfileHoverCard>
              </div>

              <div className="mt-3 space-y-2">
                <FeedReactionRow
                  targetType={celebration.type}
                  targetKey={key}
                  reactions={getReactions(key)}
                  disabled={!canInteract}
                  onToggle={(args) => toggleReaction.mutate(args)}
                />
                <FeedCommentList
                  targetType={celebration.type}
                  targetKey={key}
                  comments={getComments(key)}
                  disabled={!canInteract}
                  placeholder={
                    celebration.type === "birthday"
                      ? "Tillykke med dagen …"
                      : "Godt gået …"
                  }
                  onAdd={(args) => addComment.mutateAsync(args)}
                  onDelete={(id) => deleteComment.mutateAsync(id)}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
