import { useRef, useState } from "react";
import { Eye, EyeOff, Flag, Link2, Lock, MoreHorizontal, Pencil, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePulsenPoll } from "@/hooks/usePulsen";
import { PulsenPollCard } from "./PulsenPollCard";
import { ReactButton, ReactionSummaryLine } from "@/components/home/FeedReactionRow";
import type { FeedCommentView, FeedReactionSummary } from "@/hooks/useFeedReactions";
import type { ReactionKey } from "@/lib/feedReactions";
import type { PulsenPost } from "@/hooks/usePulsen";
import { PulsenAvatar } from "./PulsenAvatar";
import { PULSEN_MAX_CHARS, pulsenRelativeTime, shortName, showCharCounter } from "@/lib/pulsen/format";
import { cn } from "@/lib/utils";
import { OmtaleFelt } from "./OmtaleFelt";
import { erOmtaleFejl, renderOmtaler, type Omtale } from "./omtaler";
import { ANMELD_KODER, anmeldTekst, begrundelseTekst, useSbBegrundelse, type AnmeldKode } from "@/hooks/useSbOpslag";

const TYPE_PILL: Partial<Record<PulsenPost["post_type"], { label: string; cls: string }>> = {
  praise: { label: "Ros", cls: "bg-[hsl(var(--cph-praise))] text-[hsl(var(--cph-praise-foreground))]" },
  question: { label: "Spørgsmål", cls: "bg-[hsl(var(--cph-light-blue))] text-foreground" },
  event: { label: "Begivenhed", cls: "bg-[hsl(var(--cph-light-blue))] text-foreground" },
  poll: { label: "Afstemning", cls: "bg-[hsl(var(--cph-light-blue))] text-foreground" },
};

export interface PostInteractions {
  summary: FeedReactionSummary;
  comments: FeedCommentView[];
  canInteract: boolean;
  onReact: (r: ReactionKey) => void;
  onComment: (body: string, mentions: Omtale[]) => Promise<unknown>;
  onDeleteComment: (id: string) => Promise<unknown>;
  /** S7: moderation, anmeldelse og forfatterens afgørelse for kommentarer. */
  onModerateComment?: (id: string, hide: boolean, kode?: AnmeldKode | null) => Promise<unknown>;
  onReportComment?: (id: string, kode: AnmeldKode) => Promise<unknown>;
  onDecideComment?: (id: string, revision: number, handling: "send" | "traek") => Promise<unknown>;
}

interface Props {
  post: PulsenPost;
  isMine: boolean;
  canModerate: boolean;
  contextLabel?: string | null;
  imageUrl?: string | null;
  /** Reaktioner og kommentarer i både Huset og team. */
  interactions?: PostInteractions;
  onEdit: (body: string, mentions: Omtale[]) => Promise<unknown>;
  onDelete: () => void;
  onHide: (hidden: boolean, kode?: AnmeldKode | null) => void;
  onBestAnswer: (commentId: string | null) => void;
  /** S7 */
  onCommentsClosed?: (closed: boolean) => void;
  onDecide?: (revision: number, handling: "send" | "traek") => Promise<unknown>;
  onReport?: (kode: AnmeldKode) => Promise<unknown>;
}

function joinDanish(names: string[]) {
  return names.length <= 1 ? names[0] ?? "" : `${names.slice(0, -1).join(", ")} og ${names[names.length - 1]}`;
}

export function PulsenPostCard({ post, isMine, canModerate, contextLabel, imageUrl, interactions, onEdit, onDelete, onHide, onBestAnswer, onCommentsClosed, onDecide, onReport }: Props) {
  const [editing, setEditing] = useState(false);
  // S7: begrundelsesdialog (anmeld/skjul) for opslag og kommentarer
  const [reasonFor, setReasonFor] = useState<{ art: "anmeld" | "skjul" | "anmeld_kommentar" | "skjul_kommentar"; id?: string } | null>(null);
  const pickReason = async (kode: AnmeldKode) => {
    const r = reasonFor; setReasonFor(null); if (!r) return;
    try {
      if (r.art === "anmeld" && onReport) { await onReport(kode); toast.success("Tak – vi kigger på det"); }
      else if (r.art === "skjul") onHide(true, kode);
      else if (r.art === "anmeld_kommentar" && r.id && interactions?.onReportComment) { await interactions.onReportComment(r.id, kode); toast.success("Tak – vi kigger på det"); }
      else if (r.art === "skjul_kommentar" && r.id && interactions?.onModerateComment) await interactions.onModerateComment(r.id, true, kode);
    } catch { toast.error("Det lykkedes ikke", { description: "Prøv igen." }); }
  };
  // Reserveret plads (4:3) indtil billedets egne mål kendes, så feedet ikke hopper.
  const [imgRatio, setImgRatio] = useState<string | null>(null);
  const [draft, setDraft] = useState(post.body);
  const [draftMentions, setDraftMentions] = useState<Omtale[]>(post.mentions ?? []);
  const [zoom, setZoom] = useState(false);
  const authorName = shortName(post.author?.first_name, post.author?.last_name);
  const praisedList = post.praisedAll?.length ? post.praisedAll : post.praised ? [post.praised] : [];
  const praisedName = praisedList.length ? joinDanish(praisedList.map((p) => `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim())) : null;
  const pill = TYPE_PILL[post.post_type];
  const meta = [contextLabel ?? post.author?.job_title, pulsenRelativeTime(post.created_at)].filter(Boolean).join(" · ");
  const img = post.localImageUrl ?? imageUrl;
  // Menuen findes på alle gemte opslag (»Kopiér link«); øvrige punkter kræver forfatter/moderator.
  const showMenu = !post.pending;
  const canManagePost = isMine || canModerate;
  const isPoll = post.post_type === "poll";
  const pollState = usePulsenPoll(post.id, isPoll && showMenu && canManagePost, { poll: false });
  const pollRow = pollState.query.data?.poll;
  const pollOpen = !!pollRow && !pollState.isClosed;
  const [confirmClose, setConfirmClose] = useState(false);
  const closePoll = () => {
    if (pollState.close.isPending) return;
    pollState.close.mutate(undefined, {
      onError: (e) => toast.error("Afstemningen blev ikke lukket", { description: e && typeof e === "object" && "message" in e ? String(e.message) : "Prøv igen" }),
      onSettled: () => setConfirmClose(false),
    });
  };

  const saveEdit = async () => {
    try {
      await onEdit(draft, draftMentions);
      setEditing(false);
    } catch (e) {
      toast.error(erOmtaleFejl(e) ? "Omtalen kunne ikke gemmes" : "Ændringen blev ikke gemt");
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
              <button type="button" aria-label="Flere handlinger" className="-mr-2 -mt-2 flex h-11 w-11 flex-none items-center justify-center rounded-full text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))] active:opacity-70">
                <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              <DropdownMenuItem onSelect={() => {
                navigator.clipboard.writeText(`${location.origin}/storkbook/indlaeg/${post.id}`)
                  .then(() => toast.success("Link kopieret"), () => toast.error("Linket kunne ikke kopieres"));
              }}>
                <Link2 className="mr-2 h-4 w-4" aria-hidden="true" /> Kopiér link
              </DropdownMenuItem>
              {!isMine && onReport && (
                <DropdownMenuItem onSelect={() => setReasonFor({ art: "anmeld" })}>
                  <Flag className="mr-2 h-4 w-4" aria-hidden="true" /> Anmeld
                </DropdownMenuItem>
              )}
              {isPoll && pollOpen && (isMine || canModerate) && (
                <DropdownMenuItem disabled={pollState.close.isPending} onSelect={() => setConfirmClose(true)}>
                  <Lock className="mr-2 h-4 w-4" aria-hidden="true" /> Luk nu
                </DropdownMenuItem>
              )}
              {isMine && !isPoll && (
                <DropdownMenuItem onSelect={() => { setDraft(post.body); setDraftMentions(post.mentions ?? []); setEditing(true); }}>
                  <Pencil className="mr-2 h-4 w-4" aria-hidden="true" /> Redigér
                </DropdownMenuItem>
              )}
              {isMine && (
                <DropdownMenuItem onSelect={onDelete} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" aria-hidden="true" /> Slet
                </DropdownMenuItem>
              )}
              {canModerate && (
                <DropdownMenuItem onSelect={() => (post.hidden_at ? onHide(false) : setReasonFor({ art: "skjul" }))}>
                  <EyeOff className="mr-2 h-4 w-4" aria-hidden="true" /> {post.hidden_at ? "Vis igen" : "Skjul"}
                </DropdownMenuItem>
              )}
              {canModerate && onCommentsClosed && !isPoll && (
                <DropdownMenuItem onSelect={() => onCommentsClosed(!post.comments_closed_at)}>
                  <Lock className="mr-2 h-4 w-4" aria-hidden="true" /> {post.comments_closed_at ? "Åbn kommentarer" : "Luk kommentarer"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {post.hidden_at && (
        <p className="mt-3 rounded-2xl bg-[hsl(var(--cph-light-blue))] px-3 py-2 text-[13px] font-extrabold text-foreground">
          Skjult – kun forfatteren og moderatorer kan se indlægget.{post.hidden_kode ? ` · ${anmeldTekst(post.hidden_kode)}` : ""}
        </p>
      )}

      {editing ? (
        <div className="mt-3">
          <OmtaleFelt value={draft} mentions={draftMentions} maxLength={PULSEN_MAX_CHARS} onChange={(t, m) => { setDraft(t); setDraftMentions(m); }} rows={5} aria-label="Redigér indlæg" />
          <div className="mt-2 flex items-center justify-end gap-2">
            {showCharCounter(draft.length) && <span className="mr-auto text-[13px] tabular-nums text-muted-foreground">{draft.length}/{PULSEN_MAX_CHARS}</span>}
            <button type="button" onClick={() => setEditing(false)} className="min-h-[44px] rounded-full px-4 text-[14px] font-extrabold text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))] active:opacity-70">Annullér</button>
            <button type="button" onClick={saveEdit} disabled={!draft.trim()} className="min-h-[44px] rounded-full bg-[hsl(var(--cph-onyx))] px-5 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))] disabled:opacity-50 active:opacity-70">Gem</button>
          </div>
        </div>
      ) : (
        post.body && <p className="mt-3 whitespace-pre-wrap break-words text-[17px] leading-[1.5] text-foreground">{renderOmtaler(post.body, post.mentions)}</p>
      )}

      {isPoll && !post.pending && <PulsenPollCard postId={post.id} />}

      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Luk afstemningen nu?</AlertDialogTitle>
            <AlertDialogDescription>Der kan ikke stemmes mere, og resultatet står som afsluttet.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Annullér</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-[44px]"
              disabled={pollState.close.isPending}
              onClick={(e) => {
                e.preventDefault();
                closePoll();
              }}
            >
              {pollState.close.isPending ? "Lukker …" : "Luk nu"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {isMine && <OpslagTjekStatus post={post} onDecide={onDecide} onRet={() => { setDraft(post.body); setDraftMentions(post.mentions ?? []); setEditing(true); }} />}
      {interactions && !post.pending && !post.hidden_at && (
        <PostFooter post={post} isMine={isMine} canModerate={canModerate} interactions={interactions} onBestAnswer={onBestAnswer} onReason={setReasonFor} />
      )}
      <ReasonDialog art={reasonFor?.art ?? null} onClose={() => setReasonFor(null)} onPick={(k) => void pickReason(k)} />
    </article>
  );
}

function PostFooter({ post, isMine, canModerate, interactions, onBestAnswer, onReason }: { post: PulsenPost; isMine: boolean; canModerate: boolean; interactions: PostInteractions; onBestAnswer: (id: string | null) => void; onReason: (r: { art: "anmeld_kommentar" | "skjul_kommentar"; id: string }) => void }) {
  const [showAll, setShowAll] = useState(false);
  const [composing, setComposing] = useState(false);
  const [value, setValue] = useState("");
  const [valueMentions, setValueMentions] = useState<Omtale[]>([]);
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  // Ældste først i tråden
  const comments = [...interactions.comments].reverse();
  const best = comments.find((c) => c.id === post.best_answer_comment_id) ?? null;
  const rest = comments.filter((c) => c.id !== best?.id);
  const visible = showAll ? rest : rest.slice(0, 1);
  const canPickBest = isMine && post.post_type === "question";
  /** Lille ordknap under en kommentar (ikon + ord). aria-label bevares til prøver/skærmlæser. */
  const tekstKnap = (props: { label: string; aria: string; ikon: typeof Flag; onClick: () => void; tone?: "normal" | "fare" }) => (
    <button key={props.aria} type="button" aria-label={props.aria} onClick={props.onClick}
      className={cn("flex min-h-[36px] items-center gap-1 rounded-full px-2 text-[12px] font-extrabold transition-colors max-md:min-h-[44px]",
        props.tone === "fare" ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive" : "text-muted-foreground hover:bg-[hsl(var(--cph-light-blue))] hover:text-foreground")}>
      <props.ikon className="h-3.5 w-3.5" aria-hidden="true" />{props.label}
    </button>
  );
  /** Anmeld/skjul – samme for bedste svar og tråden [Codex S7-c P2-2]. */
  const handlinger = (c: PostInteractions["comments"][number]) => (
    <>
      {!c.isMine && interactions.onReportComment && tekstKnap({ label: "Anmeld", aria: "Anmeld kommentar", ikon: Flag, onClick: () => onReason({ art: "anmeld_kommentar", id: c.id }) })}
      {canModerate && !c.isMine && interactions.onModerateComment && (c.hiddenAt
        ? tekstKnap({ label: "Vis igen", aria: "Vis kommentaren igen", ikon: Eye, onClick: () => void interactions.onModerateComment?.(c.id, false) })
        : tekstKnap({ label: "Skjul", aria: "Skjul kommentaren", ikon: EyeOff, onClick: () => onReason({ art: "skjul_kommentar", id: c.id }) }))}
    </>
  );

  const savingRef = useRef(false);
  const latestValue = useRef(value);
  latestValue.current = value;
  const submit = async () => {
    if (savingRef.current || !value.trim()) return;
    savingRef.current = true;
    const sent = value;
    setSaving(true);
    try {
      await interactions.onComment(sent, valueMentions);
      // Nulstil kun, hvis feltet stadig rummer den sendte version.
      if (latestValue.current === sent) {
        setValue("");
        setValueMentions([]);
        setComposing(false);
      }
    } catch (e) {
      if (erLukketFejl(e)) {
        // [Codex S7-c P2-3] kommentarerne blev lukket, mens feltet var åbent: luk feltet og hent opslagets lukkestatus
        toast.error("Kommentarerne er lukket på dette opslag");
        setComposing(false);
        void qc.invalidateQueries({ queryKey: ["pulsen-post", post.id] });
        void qc.invalidateQueries({ queryKey: ["pulsen-feed"] });
      } else toast.error(erOmtaleFejl(e) ? "Omtalen kunne ikke gemmes" : "Kommentaren blev ikke gemt");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 border-t border-border pt-1">
      <ReactionSummaryLine summary={interactions.summary} />
      <div className="flex items-center gap-1">
        <ReactButton summary={interactions.summary} onSet={interactions.onReact} disabled={!interactions.canInteract} />
        {post.comments_closed_at ? (
          <p className="flex min-h-[44px] items-center px-3 text-[14px] font-extrabold text-muted-foreground">Kommentarer er lukket · <span className="tabular-nums">{comments.length}</span></p>
        ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          disabled={!interactions.canInteract}
          className="min-h-[44px] rounded-full px-4 text-[14px] font-extrabold text-foreground hover:bg-[hsl(var(--cph-light-blue))] active:bg-[hsl(var(--cph-light-blue))] disabled:opacity-50"
        >
          Kommentér · <span className="tabular-nums">{comments.length}</span>
        </button>
        )}
      </div>

      {best && (
        <div className="mt-3 flex items-start gap-2">
          <PulsenAvatar name={best.authorName} size={32} className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="rounded-[18px] bg-[hsl(var(--cph-praise))] px-3.5 py-2">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--cph-praise-foreground))]">★ Bedste svar · {best.authorName}</p>
              <p className="mt-1 break-words text-[15px] leading-[1.45] text-foreground">{renderOmtaler(best.body, best.mentions)}</p>
              {best.hiddenAt && <p className="mt-1 text-[12px] font-semibold text-muted-foreground">Skjult{best.hiddenKode ? ` · ${anmeldTekst(best.hiddenKode)}` : ""}</p>}
            </div>
            <div className="-mt-0.5 flex flex-wrap items-center gap-0.5 px-1">
              {handlinger(best)}
              {canPickBest && tekstKnap({ label: "Fjern som bedste svar", aria: "Fjern som bedste svar", ikon: Star, onClick: () => onBestAnswer(null) })}
            </div>
          </div>
        </div>
      )}

      {visible.length > 0 && (
        <ul className="mt-3 space-y-3">
          {visible.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <PulsenAvatar name={c.authorName} size={32} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                {/* D2a: boble m. navn · tid; egne kommentarer i svag emerald, andres i lys blå; handlinger som små ordknapper under boblen */}
                <div className={cn("rounded-[18px] px-3.5 py-2", c.hiddenAt ? "bg-muted" : c.isMine ? "bg-[hsl(var(--cph-emerald)/0.14)]" : "bg-[hsl(var(--cph-light-blue))]")}>
                  <p className="text-[13px] font-extrabold text-foreground">{c.authorName}<span className="font-normal text-muted-foreground"> · {pulsenRelativeTime(c.createdAt)}</span></p>
                  <p className="break-words whitespace-pre-wrap text-[15px] leading-[1.45] text-foreground">{renderOmtaler(c.body, c.mentions)}</p>
                  {c.hiddenAt && <p className="mt-1 text-[12px] font-semibold text-muted-foreground">Skjult{c.hiddenKode ? ` · ${anmeldTekst(c.hiddenKode)}` : ""}</p>}
                  {c.isMine && c.status === "tjekkes" && <p className="mt-1 text-[12px] text-muted-foreground">✓ Tjekkes …</p>}
                  {c.isMine && c.status === "afventer_afsender" && <KommentarAfventer id={c.id} revision={c.revision ?? 1} onDecide={interactions.onDecideComment} onDelete={() => interactions.onDeleteComment(c.id)} />}
                </div>
                <div className="-mt-0.5 flex flex-wrap items-center gap-0.5 px-1">
                  {handlinger(c)}
                  {canPickBest && tekstKnap({ label: "Bedste svar", aria: "Markér som bedste svar", ikon: Star, onClick: () => onBestAnswer(c.id) })}
                  {c.isMine && tekstKnap({ label: "Slet", aria: "Slet din kommentar", ikon: X, onClick: () => void interactions.onDeleteComment(c.id), tone: "fare" })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {rest.length > 1 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 min-h-[44px] text-[13px] font-extrabold text-muted-foreground hover:underline">
          {showAll ? "Vis færre" : `Se alle ${rest.length} kommentarer`}
        </button>
      )}

      {composing && !post.comments_closed_at && (
        <div className="mt-2 flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <OmtaleFelt
              autoFocus
              disabled={saving}
              value={value}
              mentions={valueMentions}
              maxLength={200}
              rows={1}
              onChange={(t, m) => { setValue(t); setValueMentions(m); }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void submit(); }
                if (e.key === "Escape") setComposing(false);
              }}
              placeholder={post.post_type === "question" ? "Skriv et svar …" : "Skriv en kommentar …"}
              aria-label="Din kommentar, højst 200 tegn"
              className="min-h-[44px] resize-none rounded-[16px] py-2.5 text-[16px]"
            />
          </div>
          <button type="button" onClick={() => void submit()} disabled={saving || !value.trim()} className="min-h-[44px] rounded-full bg-[hsl(var(--cph-onyx))] px-4 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))] disabled:opacity-50 active:opacity-70">Send</button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- S7: tjekstatus, afgørelse og begrundelsesdialog
const erLukketFejl = (e: unknown) => /SB_KOMMENTARER_LUKKET/.test(String((e as { message?: unknown })?.message ?? e));
const ART_TITEL = { anmeld: "Anmeld opslaget", skjul: "Skjul opslaget", anmeld_kommentar: "Anmeld kommentaren", skjul_kommentar: "Skjul kommentaren" } as const;
function ReasonDialog({ art, onClose, onPick }: { art: keyof typeof ART_TITEL | null; onClose: () => void; onPick: (kode: AnmeldKode) => void }) {
  return (
    <Dialog open={!!art} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="rounded-[24px] sm:max-w-sm">
        <DialogTitle className="text-[18px] font-extrabold">{art ? ART_TITEL[art] : ""}</DialogTitle>
        <p className="text-[14px] text-muted-foreground">{art?.startsWith("anmeld") ? "Hvad er problemet? Moderatorerne får besked." : "Forfatteren får en privat besked med begrundelsen."}</p>
        <div className="mt-2 flex flex-col gap-2">
          {ANMELD_KODER.map((k) => (
            <button key={k.kode} type="button" onClick={() => onPick(k.kode)} className="min-h-[44px] rounded-2xl bg-card px-4 text-left text-[15px] font-extrabold text-foreground hover:bg-muted active:bg-muted">
              {k.tekst}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Eget opslag: gråt flueben mens det tjekkes; kort med begrundelse og valg, når det afventer forfatteren. */
function OpslagTjekStatus({ post, onDecide, onRet }: { post: PulsenPost; onDecide?: (revision: number, handling: "send" | "traek") => Promise<unknown>; onRet: () => void }) {
  const afventer = post.status === "afventer_afsender";
  const begr = useSbBegrundelse("opslag", post.id, post.revision, afventer);
  const [optaget, setOptaget] = useState(false);
  const afgoer = async (h: "send" | "traek") => {
    if (!onDecide || optaget) return;
    setOptaget(true);
    try { await onDecide(post.revision ?? 1, h); } catch { toast.error(h === "send" ? "Kunne ikke sende opslaget" : "Kunne ikke trække opslaget tilbage", { description: "Prøv igen." }); } finally { setOptaget(false); }
  };
  if (post.status === "tjekkes") return <p className="mt-2 text-[13px] text-muted-foreground">✓ Tjekkes … Andre ser opslaget, når tjekket er færdigt.</p>;
  if (!afventer) return null;
  return (
    <div className="mt-3 rounded-2xl bg-[hsl(var(--cph-light-blue))] p-3" role="status">
      <p className="text-[14px] font-extrabold text-foreground">Dit opslag afventer dig</p>
      <p className="mt-1 text-[14px] text-foreground">{begr.isLoading ? "Henter begrundelse …" : begrundelseTekst(begr.data, "opslag")}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {begr.data !== "cpr_fil" && begr.data !== "ikke_tjekket_fil" && (
          <button type="button" disabled={optaget} onClick={() => void afgoer("send")} className="min-h-[44px] rounded-full bg-[hsl(var(--cph-onyx))] px-3 text-[14px] font-extrabold text-[hsl(var(--cph-light-blue))] hover:bg-[hsl(var(--cph-onyx-pressed))] disabled:opacity-50">Send alligevel</button>
        )}
        <button type="button" disabled={optaget} onClick={onRet} className="min-h-[44px] rounded-full bg-card px-3 text-[14px] font-extrabold text-foreground hover:bg-muted disabled:opacity-50">Ret</button>
        <button type="button" disabled={optaget} onClick={() => void afgoer("traek")} className="min-h-[44px] rounded-full bg-card px-3 text-[14px] font-extrabold text-foreground hover:bg-muted disabled:opacity-50">Træk tilbage</button>
      </div>
    </div>
  );
}

/** Egen kommentar, der afventer forfatteren: begrundelse + Send alligevel / Slet. */
function KommentarAfventer({ id, revision, onDecide, onDelete }: { id: string; revision: number; onDecide?: (id: string, revision: number, handling: "send" | "traek") => Promise<unknown>; onDelete: () => Promise<unknown> }) {
  const begr = useSbBegrundelse("kommentar", id, revision, true);
  const [optaget, setOptaget] = useState(false);
  const send = async () => {
    if (!onDecide || optaget) return;
    setOptaget(true);
    try { await onDecide(id, revision, "send"); } catch { toast.error("Kunne ikke sende kommentaren", { description: "Prøv igen." }); } finally { setOptaget(false); }
  };
  return (
    <div className="mt-1 text-[13px] text-foreground" role="status">
      <p className="font-extrabold">Afventer dig</p>
      <p>{begr.isLoading ? "Henter begrundelse …" : begrundelseTekst(begr.data, "kommentar")}</p>
      <div className="mt-1 flex gap-2">
        <button type="button" disabled={optaget} onClick={() => void send()} className="min-h-[44px] rounded-full bg-[hsl(var(--cph-onyx))] px-3 text-[13px] font-extrabold text-[hsl(var(--cph-light-blue))] disabled:opacity-50">Send alligevel</button>
        <button type="button" disabled={optaget} onClick={() => void onDelete()} className="min-h-[44px] rounded-full bg-card px-3 text-[13px] font-extrabold text-foreground hover:bg-muted disabled:opacity-50">Slet</button>
      </div>
    </div>
  );
}
