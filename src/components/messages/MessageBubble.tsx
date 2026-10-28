import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Message, useEditMessage, useDeleteMessage, useToggleReaction, useMarkMessageAsRead, useAfgoer,
  erSynligMedFokus, serverTekst, erForaeldet,
} from "@/hooks/useChat";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MoreVertical, Reply, Pencil, Trash2, SmilePlus, Check, X, FileIcon, Undo2 } from "lucide-react";
import { useDraftGuard } from "@/components/mobile";
import { ReadReceipts } from "./ReadReceipts";
import { MessageWithLinks } from "./LinkPreview";
import { renderMentions } from "./MentionInput";
import { BeskedStatus } from "./BeskedStatus";
import { FilVedhaeftning } from "./FilVedhaeftning";
import { laesRetKladde, gemRetKladde, sletRetKladde, harRetLagerFejl } from "@/lib/sbKladder";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  currentEmployeeId?: string;
  conversationId: string;
  onReply: (message: Message) => void;
}

const EMOJI_OPTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "👏", "🎉"];
const TIME = 3600000;
const DAG = 86400000;

/** »Slettes om N dage« (N rundet op); N ≤ 0 → »Slettes i dag«. */
export function slettesTekst(slettesEfter: string, nu = Date.now()): string {
  const n = Math.ceil((new Date(slettesEfter).getTime() - nu) / DAG);
  return n <= 0 ? "Slettes i dag" : n === 1 ? "Slettes om 1 dag" : `Slettes om ${n} dage`;
}

export function MessageBubble({ message, isOwn, currentEmployeeId, conversationId, onReply }: MessageBubbleProps) {
  // Uafsendt redigeringskladde: besked-id, tekst og revisionen, redigeringen begyndte fra.
  // §1/§7: redigeringsstate ejes af nøglen (medarbejder, samtale, besked), den blev startet/gendannet under.
  const noegle = currentEmployeeId ? `${currentEmployeeId}\u0000${conversationId}\u0000${message.id}` : null;
  const [ret, setRet] = useState(() => {
    const g = currentEmployeeId ? laesRetKladde(currentEmployeeId, conversationId, message.id) : null;
    return { ejer: noegle, aaben: !!g, tekst: g?.tekst ?? message.content, revision: g?.revision ?? message.revision,
      lagerFejl: currentEmployeeId ? harRetLagerFejl(currentEmployeeId, conversationId, message.id) : false };
  });
  const egenState = ret.ejer === noegle;
  const { tekst: editContent, revision: retRevision, lagerFejl: retLagerFejl } = ret;
  const isEditing = egenState && ret.aaben; // gammel nøgles state vises/gemmes aldrig
  const noegleRef = useRef(noegle);
  noegleRef.current = noegle;
  const [nu, setNu] = useState(() => Date.now());

  const editMessage = useEditMessage();
  const deleteMessage = useDeleteMessage();
  const toggleReaction = useToggleReaction();
  const markAsRead = useMarkMessageAsRead();
  const afgoer = useAfgoer();
  useDraftGuard(egenState && isEditing && editContent !== message.content);
  // §7: når identiteten ankommer eller nøglen skifter, gendannes gemt tekst og startrevision én gang.
  // Gammel state skrives aldrig under den nye nøgle; serverteksten overskriver ikke en gemt kladde.
  useEffect(() => {
    if (ret.ejer === noegle) return;
    const g = currentEmployeeId ? laesRetKladde(currentEmployeeId, conversationId, message.id) : null;
    setRet({ ejer: noegle, aaben: !!g, tekst: g?.tekst ?? message.content, revision: g?.revision ?? message.revision,
      lagerFejl: currentEmployeeId ? harRetLagerFejl(currentEmployeeId, conversationId, message.id) : false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noegle]);
  useEffect(() => {
    if (!egenState || !isEditing || !currentEmployeeId) return;
    gemRetKladde(currentEmployeeId, conversationId, { beskedId: message.id, tekst: editContent, revision: retRevision });
    const fejl = harRetLagerFejl(currentEmployeeId, conversationId, message.id);
    setRet((r) => (r.ejer === noegle && r.lagerFejl !== fejl ? { ...r, lagerFejl: fejl } : r));
  }, [egenState, isEditing, editContent, retRevision, currentEmployeeId, conversationId, message.id, noegle]);
  const setEditContent = (tekst: string) => setRet((r) => (r.ejer === noegle ? { ...r, tekst } : r));
  /** Afslutter redigeringen for den nøgle, den tilhører; berører ikke en anden nøgles state. */
  const afslutRet = (ejer = noegle, emp = currentEmployeeId, conv = conversationId, msg = message.id) => {
    if (emp) sletRetKladde(emp, conv, msg);
    setRet((r) => (r.ejer === ejer ? { ...r, aaben: false, lagerFejl: false } : r));
  };

  const trukket = message.status === "trukket_tilbage";
  const leveret = message.status === "leveret";

  // Træk tilbage på leverede beskeder kun inden for én time fra leveret_at; synligheden opdateres ved grænsen.
  const traekGraense = leveret && message.leveret_at ? new Date(message.leveret_at).getTime() + TIME : 0;
  const kanTraekke = isOwn && leveret && traekGraense > nu;
  useEffect(() => {
    if (!kanTraekke) return;
    const t = setTimeout(() => setNu(Date.now()), Math.max(0, traekGraense - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [kanTraekke, traekGraense]);

  // Kvittering kun for leverede beskeder fra andre, når vinduet er synligt og har fokus.
  const hasRead = !!message.read_receipts?.some(r => r.employee_id === currentEmployeeId);
  useEffect(() => {
    if (isOwn || !currentEmployeeId || hasRead || !leveret) return;
    const kvitter = () => {
      if (erSynligMedFokus() && !markAsRead.isPending) markAsRead.mutate({ messageId: message.id, conversationId });
    };
    kvitter();
    window.addEventListener("focus", kvitter);
    document.addEventListener("visibilitychange", kvitter);
    return () => {
      window.removeEventListener("focus", kvitter);
      document.removeEventListener("visibilitychange", kvitter);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message.id, isOwn, currentEmployeeId, hasRead, leveret]);

  const startRet = () => setRet({ ejer: noegle, aaben: true, tekst: message.content, revision: message.revision, lagerFejl: false });

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editMessage.isPending) return;
    if (editContent.length > 4000) { toast.error("Beskeden må højst være 4.000 tegn"); return; }
    // Ejer fastholdes før første await; en sen afslutning rydder kun sin egen kladde.
    const ejer = noegle, emp = currentEmployeeId, conv = conversationId, msg = message.id;
    try {
      await editMessage.mutateAsync({ messageId: msg, content: editContent, conversationId: conv, revision: retRevision });
      if (noegleRef.current === ejer) afslutRet(ejer, emp, conv, msg);
      else if (emp) sletRetKladde(emp, conv, msg);
    } catch (e) {
      // Kladden bevares ved fejl.
      toast.error(erForaeldet(e) ? "Beskeden er ændret – prøv igen" : serverTekst(e, "Kunne ikke gemme ændringen"));
    }
  };

  const handleDelete = async () => {
    if (confirm("Er du sikker på at du vil slette denne besked?")) {
      try { await deleteMessage.mutateAsync({ messageId: message.id, conversationId }); }
      catch { toast.error("Kunne ikke slette beskeden"); }
    }
  };

  const handleTraek = () => {
    if (afgoer.isPending) return;
    afgoer.mutate({ messageId: message.id, revision: message.revision, handling: "traek", conversationId }, {
      onError: (e) => toast.error(erForaeldet(e) ? "Beskeden er ændret – prøv igen" : serverTekst(e, "Kunne ikke trække beskeden tilbage")),
    });
  };

  const handleReaction = async (emoji: string) => {
    await toggleReaction.mutateAsync({ messageId: message.id, emoji, conversationId });
  };

  const groupedReactions = (message.reactions || []).reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], hasOwn: false };
    acc[r.emoji].count++;
    acc[r.emoji].users.push(r.employee?.full_name || "Ukendt");
    if (r.employee_id === currentEmployeeId) acc[r.emoji].hasOwn = true;
    return acc;
  }, {} as Record<string, { count: number; users: string[]; hasOwn: boolean }>);

  const otherReadReceipts = (message.read_receipts || []).filter(r => r.employee_id !== message.sender_id);
  const isImage = message.attachment_type?.startsWith("image/");
  const hasUrls = /https?:\/\/[^\s]+/.test(message.content);
  const visHandlinger = !isEditing && !trukket && (leveret || !isOwn);
  const btn = "h-7 w-7 md:h-6 md:w-6 max-md:h-11 max-md:w-11";
  const ico = "h-3.5 w-3.5 md:h-3 md:w-3 max-md:h-4 max-md:w-4";

  return (
    <div className={cn("flex group", isOwn ? "justify-end" : "justify-start")}>
      <div className={cn("flex min-w-0 flex-col max-w-[85%] md:max-w-[70%]", isOwn ? "items-end" : "items-start")}>
        {message.reply_to && !trukket && (
          <div className={cn(
            "text-xs px-2 md:px-3 py-1 rounded-t-lg border-l-2 mb-1 max-w-full min-w-0",
            isOwn ? "bg-primary/10 border-primary ml-auto" : "bg-muted border-muted-foreground"
          )}>
            <span className="font-medium">{message.reply_to.sender?.full_name}</span>
            <p className="truncate text-muted-foreground">{message.reply_to.content}</p>
          </div>
        )}

        <div className={cn(
          "rounded-lg px-3 md:px-4 py-2 relative max-w-full min-w-0",
          trukket ? "bg-muted text-muted-foreground" : isOwn ? (leveret ? "bg-primary text-primary-foreground" : "bg-primary/60 text-primary-foreground") : "bg-muted"
        )}>
          {!isOwn && message.sender && (
            <div className="text-xs font-medium mb-1 opacity-70">{message.sender.full_name}</div>
          )}

          {trukket ? (
            <p className="italic">{message.content || "Trukket tilbage"}</p>
          ) : isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="min-h-[60px] bg-background text-foreground text-[16px]"
                maxLength={4000}
                disabled={editMessage.isPending}
                autoFocus
              />
              <p className="text-[14px] opacity-80">{editContent.length}/4.000</p>
              {retLagerFejl && <p className="text-[14px]" role="status">Kladden kunne ikke gemmes på enheden – den findes kun, mens siden er åben</p>}
              <div className="flex gap-1">
                <Button size="sm" className="max-md:min-h-11 max-md:min-w-11" onClick={handleSaveEdit} disabled={editMessage.isPending} aria-label="Gem ændring">
                  <Check className="h-3 w-3" />
                </Button>
                <Button size="sm" variant="ghost" className="max-md:min-h-11 max-md:min-w-11" onClick={() => afslutRet()} disabled={editMessage.isPending} aria-label="Annullér">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.attachment_path ? (
                <div className="mb-2">
                  <FilVedhaeftning messageId={message.id} sti={message.attachment_path} navn={message.attachment_name ?? null}
                    type={message.attachment_type ?? null} isOwn={isOwn} brugerId={currentEmployeeId} />
                </div>
              ) : message.attachment_url ? (
                // Kompatibilitetsundtagelse: historiske URL-rækker vises som hidtil indtil 24d2-konverteringen.
                <div className="mb-2">
                  {isImage ? (
                    <a href={message.attachment_url} target="_blank" rel="noopener noreferrer">
                      <img src={message.attachment_url} alt={message.attachment_name || "Billede"} className="max-w-full rounded max-h-60 object-cover" />
                    </a>
                  ) : (
                    <a href={message.attachment_url} target="_blank" rel="noopener noreferrer"
                      className={cn("flex items-center gap-2 p-2 rounded min-h-11", isOwn ? "bg-primary-foreground/10" : "bg-background")}>
                      <FileIcon className="h-4 w-4" />
                      <span className="text-sm underline">{message.attachment_name || "Fil"}</span>
                    </a>
                  )}
                </div>
              ) : null}

              {hasUrls ? (
                <MessageWithLinks content={message.content} />
              ) : (
                <div className="whitespace-pre-wrap break-words">{renderMentions(message.content)}</div>
              )}

              <div className={cn("text-xs mt-1 flex flex-wrap items-center gap-1", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                {format(new Date(message.created_at), "HH:mm", { locale: da })}
                {message.edited_at && <span>(redigeret)</span>}
                {message.slettes_efter && <span>· {slettesTekst(message.slettes_efter, nu)}</span>}
              </div>

              {isOwn && otherReadReceipts.length > 0 && <ReadReceipts receipts={otherReadReceipts} isOwn={isOwn} />}
            </>
          )}

          {visHandlinger && (
            <div className={cn(
              "transition-opacity md:absolute md:top-1",
              "opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100",
              "max-md:mt-1 max-md:flex",
              isOwn ? "md:left-0 md:-translate-x-full md:pr-1 max-md:justify-end" : "md:right-0 md:translate-x-full md:pl-1"
            )}>
              <div className="flex items-center gap-0.5 md:gap-1 max-md:gap-2 bg-background/80 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border text-foreground">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className={btn} aria-label="Reagér"><SmilePlus className={ico} /></Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" side={isOwn ? "left" : "right"}>
                    <div className="flex gap-1 flex-wrap max-w-[200px]">
                      {EMOJI_OPTIONS.map((emoji) => (
                        <button key={emoji} onClick={() => handleReaction(emoji)}
                          className="text-xl md:text-lg hover:scale-125 active:scale-110 transition-transform p-1.5 md:p-1 max-md:min-h-11 max-md:min-w-11">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                <Button variant="ghost" size="icon" className={btn} onClick={() => onReply(message)} aria-label="Svar"><Reply className={ico} /></Button>

                {isOwn && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className={btn} aria-label="Flere handlinger"><MoreVertical className={ico} /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={startRet} className="max-md:min-h-11">
                        <Pencil className="h-4 w-4 mr-2" /> Rediger
                      </DropdownMenuItem>
                      {kanTraekke && (
                        <DropdownMenuItem onClick={handleTraek} disabled={afgoer.isPending} className="max-md:min-h-11">
                          <Undo2 className="h-4 w-4 mr-2" /> Træk tilbage
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={handleDelete} className="text-destructive max-md:min-h-11">
                        <Trash2 className="h-4 w-4 mr-2" /> Slet
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          )}
        </div>

        {isOwn && !isEditing && !trukket && (
          <BeskedStatus message={message} conversationId={conversationId} currentEmployeeId={currentEmployeeId} onRet={startRet} />
        )}

        {!trukket && Object.keys(groupedReactions).length > 0 && (
          <div className={cn("flex flex-wrap gap-1 mt-1", isOwn ? "justify-end" : "justify-start")}>
            {Object.entries(groupedReactions).map(([emoji, data]) => (
              <button key={emoji} onClick={() => handleReaction(emoji)}
                className={cn("text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 border max-md:min-h-11 max-md:px-3",
                  data.hasOwn ? "bg-primary/20 border-primary" : "bg-muted border-transparent")}
                title={data.users.join(", ")}>
                <span>{emoji}</span>
                <span>{data.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
