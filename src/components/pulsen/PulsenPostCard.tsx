import { useState } from "react";
import { EyeOff, MoreHorizontal, Pencil, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import { ReactButton, ReactionSummaryLine } from "@/components/home/FeedReactionRow";
import type { FeedCommentView, FeedReactionSummary } from "@/hooks/useFeedReactions";
import type { ReactionKey } from "@/lib/feedReactions";
import type { PulsenPost } from "@/hooks/usePulsen";
import { PulsenAvatar } from "./PulsenAvatar";
import { PULSEN_MAX_CHARS, pulsenRelativeTime, shortName, showCharCounter } from "@/lib/pulsen/format";
import { cn } from "@/lib/utils";

const TYPE_PILL: Partial<Record<PulsenPost["post_type"], { label: string; cls: string }>> = {
  praise: { label: "Ros", cls: "bg-[hsl(var(--cph-praise))] text-[hsl(var(--cph-praise-foreground))]" },
  question: { label: "Spørgsmål", cls: "bg-[hsl(var(--cph-light-blue))] text-foreground" },
  event: { label: "Begivenhed", cls: "bg-[hsl(var(--cph-light-blue))] text-foreground" },
};

export interface PostInteractions {
  summary: FeedReactionSummary;
  comments: FeedCommentView[];
  canInteract: boolean;
  onReact: (r: ReactionKey) => void;
  onComment: (body: string) => Promise<unknown>;
  onDeleteComment: (id: string) => Promise<unknown>;
}

interface Props {
  post: PulsenPost;
  isMine: boolean;
  canModerate: boolean;
  contextLabel?: string | null;
  imageUrl?: string | null;
  /** Kun Huset-indlæg har reaktioner og kommentarer. */
  interactions?: PostInteractions;
  onEdit: (body: string) => Promise<unknown>;
  onDelete: () => void;
  onHide: (hidden: boolean) => void;
  onBestAnswer: (commentId: string | null) => void;
}

function joinDanish(names: string[]) {
  return names.length <= 1 ? names[0] ?? "" : `${names.slice(0, -1).join(", ")} og ${names[names.length - 1]}`;
}

export function PulsenPostCard({ post, isMine, canModerate, contextLabel, imageUrl, interactions, onEdit, onDelete, onHide, onBestAnswer }: Props) {
  const [editing, setEditing] = useState(false);
  // Reserveret plads (4:3) indtil billedets egne mål kendes, så feedet ikke hopper.
  const [imgRatio, setImgRatio] = useState<string | null>(null);
  const [draft, setDraft] = useState(post.body);
  const [zoom, setZoom] = useState(false);
  const authorName = shortName(post.author?.first_name, post.author?.last_name);
  const praisedList = post.praisedAll?.length ? post.praisedAll : post.praised ? [post.praised] : [];
  const praisedName = praisedList.length ? joinDanish(praisedList.map((p) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim())) : null;
  const pill = TYPE_PILL[post.post_type];
  const meta = [contextLabel ?? post.author?.job_title, pulsenRelativeTime(post.created_at)].filter(Boolean).join(" · ");
  const img = post.localImageUrl ?? imageUrl;
  const showMenu = !post.pending && (isMine || canModerate);

  const saveEdit = async () => {
    try {
      await onEdit(draft);
      setEditing(false);
    } catch {
      toast.error("Ændringen blev ikke gemt");
    }
  };

  return (
    <article className={cn("rounded-[24px] bg-card p-5", post.pending && "opacity-60")} aria-busy={post.pending}>
      <header className="flex items-start gap-3">
        <PulsenAvatar employeeId={post.author_employee_id} name={authorName} />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[16px] leading-snug text-foreground">
            <span className="font-extrabold">{authorName}</span>
            {post.post_type === "praise" && praisedName && (
              <>
                <span className="text-muted-foreground"> gav ros til </span>
                <span className="font-extrabold">{praisedName}</span>
              </>
            )}
          </p>
          <p className="text-[13px] text-muted-foreground">
            {meta}
            {post.edited_at && " · Redigeret"}
            {post.pending && " · Gemmer …"}
          </p>
        </div>
        {pill && (
          <span className={cn("flex-none rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em]", pill.cls)}>
            {pill.label}
          </span>
        )}
        {showMenu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="Flere handlinger" className="-mr-2 -mt-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))]">
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              {isMine && (
                <DropdownMenuItem onSelect={() => { setDraft(post.body); setEditing(true); }}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Redigér
                </DropdownMenuItem>
              )}
              {isMine && (
                <DropdownMenuItem onSelect={onDelete} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Slet
                </DropdownMenuItem>
              )}
              {canModerate && (
                <DropdownMenuItem onSelect={() => onHide(!post.hidden_at)}>
                  <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" /> {post.hidden_at ? "Vis igen" : "Skjul"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {post.hidden_at && (
        <p className="mt-3 rounded-2xl bg-[hsl(var(--cph-light-blue))] px-3 py-2 text-[13px] font-extrabold text-foreground">
          Skjult – kun forfatteren og moderatorer kan se indlægget.
        </p>
      )}

      {editing ? (
        <div className="mt-3">
          <Textarea value={draft} maxLength={PULSEN_MAX_CHARS} onChange={(e) => setDraft(e.target.value)} className="min-h-[120px] rounded-2xl text-[17px]" aria-label="Redigér indlæg" />
          <div className="mt-2 flex items-center justify-end gap-2">
            {showCharCounter(draft.length) && <span className="mr-auto text-[13px] tabular-nums text-muted-foreground">{draft.length}/{PULSEN_MAX_CHARS}</span>}
            <button type="button" onClick={() => setEditing(false)} className="min-h-[44px] rounded-full px-4 text-[14px] font-extrabold text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))]">Annullér</button>
            <button type="button" onClick={saveEdit} disabled={!draft.trim()} className="min-h-[44px] rounded-full bg-[hsl(var(--cph-onyx))] px-5 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))] disabled:opacity-50">Gem</button>
          </div>
        </div>
      ) : (
        post.body && <p className="mt-3 whitespace-pre-wrap break-words text-[17px] leading-[1.5] text-foreground">{post.body}</p>
      )}

      {img && (
        <>
          <button type="button" onClick={() => setZoom(true)} aria-label="Vis billedet i fuld størrelse" className="mt-3 block w-full overflow-hidden rounded-[18px] bg-muted active:opacity-90">
            <img src={img} alt="" loading="lazy" className="max-h-[520px] w-full object-cover"
              style={{ aspectRatio: imgRatio ?? "4 / 3" }}
              onLoad={(e) => { const t = e.currentTarget; if (t.naturalWidth && t.naturalHeight) setImgRatio(`${t.naturalWidth} / ${t.naturalHeight}`); }} />
          </button>
          <Dialog open={zoom} onOpenChange={setZoom}>
            <DialogContent className="max-w-[min(96vw,1400px)] border-0 bg-transparent p-0 shadow-none">
              <DialogTitle className="sr-only">Billede fra {authorName}</DialogTitle>
              <img src={img} alt="" className="max-h-[90vh] w-full rounded-[18px] object-contain" />
            </DialogContent>
          </Dialog>
        </>
      )}

      {interactions && !post.pending && !post.hidden_at && (
        <PostFooter post={post} isMine={isMine} interactions={interactions} onBestAnswer={onBestAnswer} />
      )}
    </article>
  );
}

function PostFooter({ post, isMine, interactions, onBestAnswer }: { post: PulsenPost; isMine: boolean; interactions: PostInteractions; onBestAnswer: (id: string | null) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [composing, setComposing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  // Ældste først i tråden
  const comments = [...interactions.comments].reverse();
  const best = comments.find((c) => c.id === post.best_answer_comment_id) ?? null;
  const rest = comments.filter((c) => c.id !== best?.id);
  const visible = showAll ? rest : rest.slice(0, 1);
  const canPickBest = isMine && post.post_type === "question";

  const submit = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await interactions.onComment(value);
      setValue("");
      setComposing(false);
    } catch {
      toast.error("Kommentaren blev ikke gemt");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-1">
      <ReactionSummaryLine summary={interactions.summary} />
      <div className="flex items-center gap-1">
        <ReactButton summary={interactions.summary} onSet={interactions.onReact} disabled={!interactions.canInteract} />
        <button
          type="button"
          onClick={() => setComposing(true)}
          disabled={!interactions.canInteract}
          className="min-h-[44px] rounded-xl px-3 text-[14px] font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          Kommentér · <span className="tabular-nums">{comments.length}</span>
        </button>
      </div>

      {best && (
        <div className="mt-2 rounded-2xl bg-[hsl(var(--cph-light-blue))] px-4 py-3">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--cph-praise-foreground))]">★ Bedste svar · {best.authorName}</p>
          <p className="mt-1 break-words text-[15px] text-foreground">{best.body}</p>
          {canPickBest && (
            <button type="button" onClick={() => onBestAnswer(null)} className="mt-1 min-h-[44px] text-[13px] font-semibold text-muted-foreground hover:underline">Fjern som bedste svar</button>
          )}
        </div>
      )}

      {visible.length > 0 && (
        <ul className="mt-2 space-y-2">
          {visible.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <div className="min-w-0 flex-1 rounded-[16px] bg-[hsl(var(--cph-light-blue))] px-3 py-2">
                <p className="text-[13px] font-extrabold text-foreground">{c.authorName}</p>
                <p className="break-words text-[15px] text-foreground">{c.body}</p>
              </div>
              {canPickBest && (
                <button type="button" aria-label="Markér som bedste svar" onClick={() => onBestAnswer(c.id)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))]">
                  <Star className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
              {c.isMine && (
                <button type="button" aria-label="Slet din kommentar" onClick={() => interactions.onDeleteComment(c.id)} className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))]">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {rest.length > 1 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 min-h-[44px] text-[13px] font-semibold text-muted-foreground hover:underline">
          {showAll ? "Vis færre" : `Se alle ${rest.length} kommentarer`}
        </button>
      )}

      {composing && (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            value={value}
            maxLength={200}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); void submit(); }
              if (e.key === "Escape") setComposing(false);
            }}
            placeholder={post.post_type === "question" ? "Skriv et svar …" : "Skriv en kommentar …"}
            aria-label="Din kommentar, højst 200 tegn"
            className="h-11 min-w-0 flex-1 rounded-[16px] bg-[hsl(var(--cph-light-blue))] px-4 text-[15px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button type="button" onClick={() => void submit()} disabled={saving || !value.trim()} className="min-h-[44px] rounded-full bg-[hsl(var(--cph-onyx))] px-4 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))] disabled:opacity-50">Send</button>
        </div>
      )}
    </div>
  );
}
