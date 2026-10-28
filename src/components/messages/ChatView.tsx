import { useState, useRef, useEffect } from "react";
import {
  useMessages, useSendMessage, useRealtimeMessages, useMarkAsRead, useTypingIndicator, useChatAktiv,
  erSynligMedFokus, onChatSignal, SendFejl, Message,
} from "@/hooks/useChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Paperclip, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { findEmployeeByAuth } from "@/lib/employeeLookup";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageBubble } from "./MessageBubble";
import { MessageSearch } from "./MessageSearch";
import { AttachmentPreview, type LokalFil } from "./AttachmentPreview";
import { TypingIndicator } from "./TypingIndicator";
import { MentionInput } from "./MentionInput";
import { toast } from "sonner";
import { SkeletonList, useDraftGuard } from "@/components/mobile";
import { validerFil, udstedUpload, uploadTilSti, udstedFejlTekst, FIL_ACCEPT, FIL_GRAENSER_TEKST } from "@/lib/sbFil";
import { laesKladde, gemKladde, sletKladde, registrerKladdeOprydning } from "@/lib/sbKladder";

registrerKladdeOprydning();

/** Besked vist straks i tråden, men endnu ikke bekræftet. Samme id bruges ved alle genforsøg. */
interface PendingMessage {
  id: string;
  content: string;
  replyToId?: string;
  fil: { sti: string; type: string; name: string } | null;
  status: "sending" | "afstemmer" | "failed";
  fejl?: string;
  ukendt?: boolean;
}

interface ChatViewProps {
  conversationId: string;
}

async function fetchCurrentEmployee(): Promise<{ id: string; full_name: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await findEmployeeByAuth<{ id: string; first_name: string | null; last_name: string | null }>(user, "id, first_name, last_name");
  return data ? { id: data.id, full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim() } : null;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [svarId, setSvarId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [fil, setFil] = useState<LokalFil | null>(null);
  const [filFejl, setFilFejl] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const inFlight = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const convRef = useRef(conversationId);
  convRef.current = conversationId;
  const queryClient = useQueryClient();

  const { data: messages, isLoading, hasOlder, isLoadingOlder, loadOlder } = useMessages(conversationId);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const { typingUsers, setTyping } = useTypingIndicator(conversationId);

  useRealtimeMessages(conversationId);

  const { data: currentEmployee } = useQuery({ queryKey: ["current-employee"], queryFn: fetchCurrentEmployee });
  const meId = currentEmployee?.id;

  useChatAktiv(conversationId);
  useDraftGuard(!!message.trim() || !!fil || pending.length > 0);

  // Kladde pr. bruger/samtale: indlæs ved skift, gem ved ændring (kun tekst + svarreference-id).
  const indlaest = useRef<string | null>(null);
  useEffect(() => {
    if (!meId) return;
    const k = laesKladde(meId, conversationId);
    setMessage(k?.tekst ?? "");
    setSvarId(k?.svarId ?? null);
    setReplyTo(null);
    indlaest.current = `${meId}:${conversationId}`;
  }, [meId, conversationId]);
  useEffect(() => {
    if (!meId || indlaest.current !== `${meId}:${conversationId}`) return;
    gemKladde(meId, conversationId, { tekst: message, svarId: replyTo?.id ?? svarId });
  }, [meId, conversationId, message, replyTo, svarId]);

  // Genskab/ryd svaruddrag ud fra den aktuelle tråd (aldrig originaltekst, når tråden viser pladsholder).
  useEffect(() => {
    const id = replyTo?.id ?? svarId;
    if (!id || !messages) return;
    const m = messages.find((x) => x.id === id);
    if (!m || m.status === "trukket_tilbage") { setReplyTo(null); setSvarId(null); return; }
    if (!replyTo || replyTo.content !== m.content) setReplyTo(m);
  }, [messages, svarId, replyTo]);
  useEffect(() => onChatSignal((s) => {
    if (["trukket", "slettet", "udloeb"].includes(s.haendelse) && (replyTo?.id === s.kildeId || svarId === s.kildeId)) {
      setReplyTo(null); setSvarId(null);
    }
  }), [replyTo, svarId]);

  // Kvitterer kun hentede/viste LEVEREDE beskeder fra andre uden egen kvittering – kun ved synligt vindue med fokus.
  const ukvitterede = (messages ?? [])
    .filter((m) => meId && m.sender_id !== meId && m.status === "leveret" && !m.read_receipts?.some((rr) => rr.employee_id === meId))
    .map((m) => m.id);
  const ukvitteretNoegle = ukvitterede.join(",");
  useEffect(() => {
    if (!conversationId || !ukvitterede.length) return;
    const kvitter = () => { if (erSynligMedFokus() && !markAsRead.isPending) markAsRead.mutate({ conversationId, messageIds: ukvitterede }); };
    kvitter();
    window.addEventListener("focus", kvitter);
    document.addEventListener("visibilitychange", kvitter);
    return () => {
      window.removeEventListener("focus", kvitter);
      document.removeEventListener("visibilitychange", kvitter);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, ukvitteretNoegle]);

  // Fristudløb (slettes_efter): genhent ved den nærmeste frist, også uden signal.
  const naesteFrist = (messages ?? []).reduce((min, m) => {
    if (!m.slettes_efter) return min;
    const t = new Date(m.slettes_efter).getTime();
    return t < min ? t : min;
  }, Infinity);
  useEffect(() => {
    if (!Number.isFinite(naesteFrist)) return;
    const ms = Math.min(Math.max(0, naesteFrist - Date.now()) + 500, 2 ** 31 - 1);
    const t = setTimeout(() => queryClient.invalidateQueries({ queryKey: ["chat-messages", conversationId] }), ms);
    return () => clearTimeout(t);
  }, [naesteFrist, conversationId, queryClient]);

  const nyesteId = messages?.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [nyesteId, pending.length, conversationId, isLoading]);

  useEffect(() => {
    setPending([]);
    setFilFejl(null);
    setFil((f) => { if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl); return null; });
  }, [conversationId]);
  useEffect(() => () => { setFil((f) => { if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl); return null; }); }, []);

  const handleTyping = () => {
    if (!currentEmployee) return;
    setTyping(true, currentEmployee.id, currentEmployee.full_name);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => setTyping(false, currentEmployee.id, currentEmployee.full_name), 2000);
  };

  const deliver = async (p: PendingMessage) => {
    if (inFlight.current.has(p.id)) return;
    inFlight.current.add(p.id);
    setPending((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: p.ukendt ? "afstemmer" : "sending", fejl: undefined } : x)));
    try {
      await sendMessage.mutateAsync({
        id: p.id,
        conversationId,
        content: p.content,
        replyToId: p.replyToId,
        attachmentPath: p.fil?.sti,
        attachmentType: p.fil?.type,
        attachmentName: p.fil?.name,
      });
      setPending((prev) => prev.filter((x) => x.id !== p.id));
    } catch (e) {
      const server = e instanceof SendFejl && e.art === "server";
      setPending((prev) => prev.map((x) => (x.id === p.id
        ? { ...x, status: "failed", ukendt: !server, fejl: server ? e.message : "Ikke sendt – prøv igen" } : x)));
    } finally {
      inFlight.current.delete(p.id);
    }
  };

  const handleSend = () => {
    if ((!message.trim() && !fil) || fil?.uploader || fil?.fejl) return;
    if (message.length > 4000) { toast.error("Beskeden må højst være 4.000 tegn"); return; }
    if (currentEmployee) setTyping(false, currentEmployee.id, currentEmployee.full_name);
    const p: PendingMessage = {
      id: crypto.randomUUID(),
      content: message.trim(),
      replyToId: replyTo?.id,
      fil: fil?.sti ? { sti: fil.sti, type: fil.type, name: fil.name } : null,
      status: "sending",
    };
    setPending((prev) => [...prev, p]);
    setMessage("");
    setReplyTo(null);
    setSvarId(null);
    if (meId) sletKladde(meId, conversationId);
    setFil((f) => { if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl); return null; });
    void deliver(p);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const upload = async (file: File, type: string, previewUrl: string | null) => {
    const conv = conversationId;
    setFil({ name: file.name, type, size: file.size, previewUrl, uploader: true, file });
    try {
      const u = await udstedUpload(conv, file, type);
      await uploadTilSti(u, file, type);
      // Langsomt svar for en anden samtale knyttes aldrig hertil.
      if (convRef.current !== conv) return;
      setFil((f) => (f && f.file === file ? { ...f, uploader: false, sti: u.sti } : f));
    } catch (e) {
      if (convRef.current !== conv) return;
      setFil((f) => (f && f.file === file ? { ...f, uploader: false, fejl: udstedFejlTekst(e) } : f));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const v = validerFil(file);
    if ("fejl" in v) { setFilFejl(v.fejl); return; }
    setFilFejl(null);
    setFil((f) => { if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl); return null; });
    const previewUrl = v.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    void upload(file, v.type, previewUrl);
  };

  const fjernFil = () => setFil((f) => { if (f?.previewUrl) URL.revokeObjectURL(f.previewUrl); return null; });

  const otherTypingUsers = typingUsers.filter(u => u.id !== currentEmployee?.id);

  if (isLoading) {
    return <div className="h-full p-3"><SkeletonList count={4} /></div>;
  }

  return (
    <div className="h-full flex flex-col min-w-0">
      <div className="border-b p-2 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setShowSearch(!showSearch)} className="h-8 px-2 md:px-3 max-md:h-11 max-md:w-11" aria-label="Søg i beskeder">
          <Search className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Søg</span>
        </Button>
      </div>

      {showSearch && <MessageSearch onClose={() => setShowSearch(false)} onSelectMessage={() => setShowSearch(false)} />}

      <ScrollArea className="flex-1 p-2 md:p-4">
        <div className="space-y-3 md:space-y-4">
          {hasOlder && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" className="min-h-11" onClick={loadOlder} disabled={isLoadingOlder}>
                {isLoadingOlder ? "Henter …" : "Indlæs ældre"}
              </Button>
            </div>
          )}
          {messages?.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isOwn={msg.sender_id === meId} currentEmployeeId={meId}
              conversationId={conversationId} onReply={(m) => { setReplyTo(m); setSvarId(m.id); }} />
          ))}
          {pending.map((p) => (
            <div key={p.id} className="flex justify-end" aria-live="polite">
              <div className="max-w-[80%] min-w-0">
                <div className={cn("rounded-2xl px-3 py-2 text-[15px] break-words", p.status === "failed" ? "bg-destructive/10 text-foreground border border-destructive/40" : "bg-primary/70 text-primary-foreground")}>
                  {p.content || p.fil?.name}
                </div>
                {p.status === "sending" ? (
                  <p className="mt-1 text-right text-[14px] text-muted-foreground">Sender …</p>
                ) : p.status === "afstemmer" ? (
                  <p className="mt-1 text-right text-[14px] text-muted-foreground">Afstemmer …</p>
                ) : (
                  <div className="mt-1 flex flex-col items-end">
                    {p.fejl && p.fejl !== "Ikke sendt – prøv igen" && <p className="text-right text-[14px] text-destructive">{p.fejl}</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void deliver(p)} className="flex min-h-11 items-center text-[14px] font-medium text-destructive active:opacity-70">
                        Ikke sendt – prøv igen
                      </button>
                      {!p.ukendt && (
                        <button type="button" className="flex min-h-11 items-center px-2 text-[14px] text-muted-foreground active:opacity-70"
                          onClick={() => { setPending((prev) => prev.filter((x) => x.id !== p.id)); if (!message) setMessage(p.content); }}>
                          Ret
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {messages?.length === 0 && pending.length === 0 && (
            <div className="text-center text-muted-foreground py-8">Ingen beskeder endnu. Start samtalen!</div>
          )}
        </div>
        <TypingIndicator users={otherTypingUsers} />
        <div ref={bottomRef} aria-hidden="true" />
      </ScrollArea>

      {replyTo && (
        <div className="px-2 md:px-4 py-2 bg-muted/50 border-t flex items-center justify-between gap-2">
          <div className="text-sm min-w-0 flex-1">
            <span className="text-muted-foreground">Svarer på: </span>
            <span className="font-medium">{replyTo.sender?.full_name}</span>
            <p className="text-muted-foreground truncate">{replyTo.content}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { setReplyTo(null); setSvarId(null); }} className="flex-shrink-0 h-8 w-8 p-0 max-md:h-11 max-md:w-11" aria-label="Fjern svar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {fil && <AttachmentPreview fil={fil} onRemove={fjernFil} onRetry={fil.fejl ? () => void upload(fil.file, fil.type, fil.previewUrl) : undefined} />}
      {filFejl && (
        <div className="px-2 md:px-4 py-2 border-t text-[14px] text-destructive flex items-center justify-between gap-2" role="alert">
          <span className="min-w-0">{filFejl}. {FIL_GRAENSER_TEKST}</span>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 max-md:h-11 max-md:w-11 shrink-0" onClick={() => setFilFejl(null)} aria-label="Luk">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="p-2 md:p-4 border-t safe-area-bottom">
        <div className="flex gap-1 md:gap-2 items-end">
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} accept={FIL_ACCEPT} />
          <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={!!fil?.uploader}
            className="h-10 w-10 flex-shrink-0 max-md:h-11 max-md:w-11" aria-label="Vedhæft fil" title={FIL_GRAENSER_TEKST}>
            {fil?.uploader ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <div className="flex-1 min-w-0">
            <MentionInput value={message} onChange={setMessage} onKeyDown={handleKeyDown} placeholder="Skriv en besked..." onTyping={handleTyping} />
          </div>
          <Button onClick={handleSend} disabled={(!message.trim() && !fil) || !!fil?.uploader || !!fil?.fejl}
            size="icon" className="h-10 w-10 flex-shrink-0 max-md:h-11 max-md:w-11" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
