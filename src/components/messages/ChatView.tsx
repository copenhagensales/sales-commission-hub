import { useState, useRef, useEffect } from "react";
import { useMessages, useSendMessage, useRealtimeMessages, useMarkAsRead, useTypingIndicator, Message } from "@/hooks/useChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Paperclip, X, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { MessageBubble } from "./MessageBubble";
import { MessageSearch } from "./MessageSearch";
import { AttachmentPreview } from "./AttachmentPreview";
import { TypingIndicator } from "./TypingIndicator";
import { useUploadAttachment } from "@/hooks/useChat";
import { toast } from "sonner";

interface ChatViewProps {
  conversationId: string;
}

async function fetchCurrentEmployee(): Promise<{ id: string; full_name: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  
  const client = supabase as any;
  const { data } = await client
    .from("employee_master_data")
    .select("id, first_name, last_name")
    .eq("user_id", user.id)
    .maybeSingle();
  
  // Fallback: try with auth_user_id
  if (!data) {
    const { data: dataAlt } = await client
      .from("employee_master_data")
      .select("id, first_name, last_name")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    return dataAlt ? { id: dataAlt.id, full_name: `${dataAlt.first_name || ''} ${dataAlt.last_name || ''}`.trim() } : null;
  }
  
  return data ? { id: data.id, full_name: `${data.first_name || ''} ${data.last_name || ''}`.trim() } : null;
}

export function ChatView({ conversationId }: ChatViewProps) {
  const [message, setMessage] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { data: messages, isLoading } = useMessages(conversationId);
  const sendMessage = useSendMessage();
  const markAsRead = useMarkAsRead();
  const uploadAttachment = useUploadAttachment();
  const { typingUsers, setTyping } = useTypingIndicator(conversationId);
  
  useRealtimeMessages(conversationId);

  const { data: currentEmployee } = useQuery({
    queryKey: ["current-employee"],
    queryFn: fetchCurrentEmployee,
  });

  // Mark as read when opening conversation
  useEffect(() => {
    if (conversationId) {
      markAsRead.mutate(conversationId);
    }
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

  const handleSend = async () => {
    if (!message.trim() && !attachment) return;
    
    // Stop typing indicator
    if (currentEmployee) {
      setTyping(false, currentEmployee.id, currentEmployee.full_name);
    }
    
    await sendMessage.mutateAsync({
      conversationId,
      content: message.trim(),
      replyToId: replyTo?.id,
      attachmentUrl: attachment?.url,
      attachmentType: attachment?.type,
      attachmentName: attachment?.name,
    });
    setMessage("");
    setReplyTo(null);
    setAttachment(null);
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
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Search toggle */}
      <div className="border-b p-2 flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSearch(!showSearch)}
        >
          <Search className="h-4 w-4 mr-1" />
          Søg
        </Button>
      </div>

      {showSearch && (
        <MessageSearch 
          onClose={() => setShowSearch(false)}
          onSelectMessage={(msg) => {
            // Could scroll to message
            setShowSearch(false);
          }}
        />
      )}

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
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
          {messages?.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              Ingen beskeder endnu. Start samtalen!
            </div>
          )}
        </div>
        
        <TypingIndicator users={otherTypingUsers} />
      </ScrollArea>

      {/* Reply preview */}
      {replyTo && (
        <div className="px-4 py-2 bg-muted/50 border-t flex items-center justify-between">
          <div className="text-sm">
            <span className="text-muted-foreground">Svarer på: </span>
            <span className="font-medium">{replyTo.sender?.full_name}</span>
            <p className="text-muted-foreground truncate max-w-xs">{replyTo.content}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setReplyTo(null)}>
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

      <div className="p-4 border-t">
        <div className="flex gap-2">
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
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
          <Textarea
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Skriv en besked..."
            className="min-h-[60px] resize-none flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={(!message.trim() && !attachment) || sendMessage.isPending}
            className="self-end"
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
