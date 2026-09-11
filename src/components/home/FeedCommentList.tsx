import { useState } from "react";
import { MessageSquarePlus, Trash2 } from "lucide-react";
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
  disabled?: boolean;
  placeholder?: string;
}

export function FeedCommentList({
  targetType,
  targetKey,
  comments,
  onAdd,
  onDelete,
  disabled = false,
  placeholder = "Skriv en kort besked",
}: FeedCommentListProps) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const visible = expanded ? comments : comments.slice(0, VISIBLE_COUNT);
  const hidden = comments.length - visible.length;

  const submit = async () => {
    const body = value.trim();
    if (!body) return;
    setSaving(true);
    try {
      await onAdd({ targetType, targetKey, body });
      setValue("");
      setOpen(false);
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
    <div className="space-y-2">
      {visible.length > 0 && (
        <ul className="space-y-1">
          {visible.map((comment) => (
            <li key={comment.id} className="flex items-start gap-2 text-[13px] text-foreground">
              <span className="min-w-0 flex-1">
                <span className="break-words">{comment.body}</span>
                <span className="text-foreground/70"> — {comment.authorName}</span>
              </span>
              {comment.isMine && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 flex-none p-0 text-foreground/70 hover:text-foreground"
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

      {hidden > 0 && (
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-[13px] text-foreground/70"
          onClick={() => setExpanded(true)}
        >
          {hidden === 1 ? "1 besked mere" : `${hidden} beskeder mere`}
        </Button>
      )}

      {open ? (
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
                setOpen(false);
                setValue("");
              }
            }}
            className="h-8 text-[13px]"
            aria-label="Din besked, højst 200 tegn"
          />
          <Button
            type="button"
            size="sm"
            className="h-8"
            disabled={saving || !value.trim()}
            onClick={() => void submit()}
          >
            Send
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 rounded-full border-border bg-background text-[13px] font-semibold text-foreground hover:bg-accent hover:text-accent-foreground"
          disabled={disabled}
          onClick={() => setOpen(true)}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
          Skriv besked
        </Button>
      )}
    </div>
  );
}
