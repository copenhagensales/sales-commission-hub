import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import type { FeedCommentView, FeedTargetType } from "@/hooks/useFeedReactions";

const MAX_LENGTH = 200;
const VISIBLE_COUNT = 2;

interface FeedCommentListProps {
  targetType: FeedTargetType;
  targetKey: string;
  comments: FeedCommentView[];
  onAdd: (args: { targetType: FeedTargetType; targetKey: string; body: string }) => Promise<unknown>;
  onDelete: (commentId: string) => Promise<unknown>;
  composing: boolean;
  onCloseComposer: () => void;
  placeholder?: string;
}

const initials = (name: string) =>
  name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export function FeedCommentList({
  targetType,
  targetKey,
  comments,
  onAdd,
  onDelete,
  composing,
  onCloseComposer,
  placeholder = "Skriv en kort besked",
}: FeedCommentListProps) {
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = expanded ? comments : comments.slice(0, VISIBLE_COUNT);

  const submit = async () => {
    const body = value.trim();
    if (!body) return;
    setSaving(true);
    try {
      await onAdd({ targetType, targetKey, body });
      setValue("");
      onCloseComposer();
    } catch (error) {
      toast({
        title: "Beskeden blev ikke gemt",
        description: error instanceof Error ? error.message : "Prøv igen",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {composing && (
        <div className="flex items-center gap-2">
          <Input
            autoFocus
            value={value}
            maxLength={MAX_LENGTH}
            placeholder={placeholder}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submit();
              }
              if (event.key === "Escape") {
                onCloseComposer();
                setValue("");
              }
            }}
            className="h-11 rounded-xl text-[14px]"
            aria-label="Din besked, højst 200 tegn"
          />
          <Button type="button" className="h-11" disabled={saving || !value.trim()} onClick={() => void submit()}>
            Send
          </Button>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((comment) => (
            <li key={comment.id} className="group flex items-start gap-2">
              <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[hsl(var(--cph-light-blue))] text-[12px] font-bold text-[hsl(var(--cph-onyx))]">
                {initials(comment.authorName)}
              </span>
              <div className="min-w-0 flex-1 rounded-2xl bg-muted px-3 py-2">
                <p className="text-[13px] font-semibold text-foreground">{comment.authorName}</p>
                <p className="break-words text-[15px] text-foreground">{comment.body}</p>
              </div>
              {comment.isMine && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 flex-none p-0 text-muted-foreground/50 hover:text-foreground"
                  aria-label="Slet din besked"
                  onClick={() => onDelete(comment.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {comments.length > VISIBLE_COUNT && (
        <button
          type="button"
          className="min-h-[36px] text-[13px] font-semibold text-muted-foreground hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Vis færre" : `Vis alle ${comments.length} beskeder`}
        </button>
      )}
    </div>
  );
}
