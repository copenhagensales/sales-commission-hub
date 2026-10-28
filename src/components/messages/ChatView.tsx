import { useState, useRef, useEffect } from "react";
import { useMessages, useSendMessage, useRealtimeMessages, useMarkAsRead, useTypingIndicator, useChatAktiv, erSynligMedFokus, Message } from "@/hooks/useChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Paperclip, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { findEmployeeByAuth } from "@/lib/employeeLookup";
import { useQuery } from "@tanstack/react-query";
import { MessageBubble } from "./MessageBubble";
import { MessageSearch } from "./MessageSearch";
import { AttachmentPreview } from "./AttachmentPreview";
import { TypingIndicator } from "./TypingIndicator";
import { MentionInput } from "./MentionInput";
import { useUploadAttachment } from "@/hooks/useChat";
import { toast } from "sonner";
import { SkeletonList } from "@/components/mobile";

/** Besked, der er vist straks i tråden, men endnu ikke bekræftet af serveren. */
interface PendingMessage {
  key: string;
  content: string;
  replyToId?: string;
  attachment: { url: string; type: string; name: string } | null;
  status: "sending" | "failed";
}

interface ChatViewProps {
  conversationId: string;
}

async function fetchCurrentEmployee(): Promise<{ id: string; full_name: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const { data } = await findEmployeeByAuth<{ id: string; first_name: string | null; last_name: string | null }>(
    user,
    "id, first_name, last_name"
  );

  
  return data ? { 
    id: data.id, 
    full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim() 
  } : null;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const inFlight = useRef<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: messages, isLoading, hasOlder, isLoadingOlder, loadOlder } = useMessages(conversationId);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const uploadAttachment = useUploadAttachment();
  const { typingUsers, setTyping } = useTypingIndicator(conversationId);
  
  useRealtimeMessages(conversationId);

  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee"],
    queryFn: fetchCurrentEmployee,
  });

  useChatAktiv(conversationId);

  // Kvitterer kun hentede/viste beskeder fra andre uden egen kvittering – kun når vinduet er synligt og har fokus.
  const meId = currentEmployee?.id;
  const ukvitterede = (messages ?? [])
    .filter((m) => meId && m.sender_id !== meId && !m.read_receipts?.some((rr) => rr.employee_id === meId))
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

  // Rul til nyeste besked ved åbning, ved ny besked og ved afsendelse (ikke når ældre historik indlæses).
  const nyesteId = messages?.length ? messages[messages.length - 1].id : null;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [nyesteId, pending.length, conversationId, isLoading]);

  useEffect(() => {
    setPending([]);
  }, [conversationId]);

  // Handle typing indicator
  const handleTyping = () => {
    if (currentEmployee) {
      setTyping(true, currentEmployee.id, currentEmployee.full_name);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        setTyping(false, currentEmployee.id, currentEmployee.full_name);
      }, 2000);
    }
  };

  const deliver = async (p: PendingMessage) => {
    if (inFlight.current.has(p.key)) return; // ingen dobbelt-afsendelse ved gentryk
    inFlight.current.add(p.key);
    setPending((prev) => prev.map((x) => (x.key === p.key ? { ...x, status: "sending" } : x)));
    try {
      await sendMessage.mutateAsync({
        conversationId,
        content: p.content,
        replyToId: p.replyToId,
        attachmentUrl: p.attachment?.url,
        attachmentType: p.attachment?.type,
        attachmentName: p.attachment?.name,
      });
      setPending((prev) => prev.filter((x) => x.key !== p.key));
    } catch {
      setPending((prev) => prev.map((x) => (x.key === p.key ? { ...x, status: "failed" } : x)));
    } finally {
      inFlight.current.delete(p.key);
    }
  };

  const handleSend = () => {
    if (!message.trim() && !attachment) return;

    // Stop typing indicator
    if (currentEmployee) {
      setTyping(false, currentEmployee.id, currentEmployee.full_name);
    }

    const p: PendingMessage = {
      key: crypto.randomUUID(),
      content: message.trim(),
      replyToId: replyTo?.id,
      attachment,
      status: "sending",
    };
    setPending((prev) => [...prev, p]);
    setMessage("");
    setReplyTo(null);
    setAttachment(null);
    void deliver(p);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Max 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Filen er for stor. Max 10MB.");
      return;
    }
    
    setIsUploading(true);
    try {
      const result = await uploadAttachment.mutateAsync(file);
      setAttachment(result);
    } catch (error) {
      toast.error("Kunne ikke uploade filen");
    } finally {
      setIsUploading(false);
    }
  };

  const handleReply = (msg: Message) => {
    setReplyTo(msg);
  };

  const otherTypingUsers = typingUsers.filter(u => u.id !== currentEmployee?.id);

  if (isLoading) {
    return (
      <div className="h-full p-3">
        <SkeletonList count={4} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search toggle - more compact on mobile */}
      <div className="border-b p-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSearch(!showSearch)}
          className="h-8 px-2 md:px-3 max-md:h-11 max-md:w-11"
          aria-label="Søg i beskeder"
        >
          <Search className="h-4 w-4 md:mr-1" />
          <span className="hidden md:inline">Søg</span>
        </Button>
      </div>

      {showSearch && (
        <MessageSearch 
          onClose={() => setShowSearch(false)}
          onSelectMessage={(msg) => {
            setShowSearch(false);
          }}
        />
      )}

      <ScrollArea className="flex-1 p-2 md:p-4" ref={scrollRef}>
        <div className="space-y-3 md:space-y-4">
          {hasOlder && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" className="min-h-11" onClick={loadOlder} disabled={isLoadingOlder}>
                {isLoadingOlder ? "Henter …" : "Indlæs ældre"}
              </Button>
            </div>
          )}
          {messages?.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === currentEmployee?.id}
              currentEmployeeId={currentEmployee?.id}
              conversationId={conversationId}
              onReply={handleReply}
            />
          ))}
          {pending.map((p) => (
            <div key={p.key} className="flex justify-end" aria-live="polite">
              <div className="max-w-[80%] min-w-0">
                <div className={cn("rounded-2xl px-3 py-2 text-[15px] break-words", p.status === "failed" ? "bg-destructive/10 text-foreground border border-destructive/40" : "bg-primary/70 text-primary-foreground")}>
                  {p.content || p.attachment?.name}
                </div>
                {p.status === "sending" ? (
                  <p className="mt-1 text-right text-[14px] text-muted-foreground">Sender …</p>
                ) : (
                  <button type="button" onClick={() => void deliver(p)}
                    className="mt-1 ml-auto flex min-h-11 items-center text-[14px] font-medium text-destructive active:opacity-70">
                    Ikke sendt – prøv igen
                  </button>
                )}
              </div>
            </div>
          ))}
          {messages?.length === 0 && pending.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              Ingen beskeder endnu. Start samtalen!
            </div>
          )}
        </div>
        
        <TypingIndicator users={otherTypingUsers} />
        <div ref={bottomRef} aria-hidden="true" />
      </ScrollArea>

      {/* Reply preview - more compact on mobile */}
      {replyTo && (
        <div className="px-2 md:px-4 py-2 bg-muted/50 border-t flex items-center justify-between gap-2">
          <div className="text-sm min-w-0 flex-1">
            <span className="text-muted-foreground">Svarer på: </span>
            <span className="font-medium">{replyTo.sender?.full_name}</span>
            <p className="text-muted-foreground truncate">{replyTo.content}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)} className="flex-shrink-0 h-8 w-8 p-0 max-md:h-11 max-md:w-11" aria-label="Fjern svar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Attachment preview */}
      {attachment && (
        <AttachmentPreview 
          attachment={attachment} 
          onRemove={() => setAttachment(null)} 
        />
      )}

      {/* Input area - optimized for mobile */}
      <div className="p-2 md:p-4 border-t safe-area-bottom">
        <div className="flex gap-1 md:gap-2 items-end">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="h-10 w-10 flex-shrink-0 max-md:h-11 max-md:w-11"
            aria-label="Vedhæft fil"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
          <div className="flex-1 min-w-0">
            <MentionInput
              value={message}
              onChange={setMessage}
              onKeyDown={handleKeyDown}
              placeholder="Skriv en besked..."
              onTyping={handleTyping}
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={!message.trim() && !attachment}
            size="icon"
            className="h-10 w-10 flex-shrink-0 max-md:h-11 max-md:w-11"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
