import { useState } from "react";
import { useEmployeeSmsConversations, EmployeeSmsConversation } from "@/hooks/useEmployeeSmsConversations";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, MessageSquare, Send, Phone } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function EmployeeSmsTab() {
  const { conversations, isLoading } = useEmployeeSmsConversations();
  const [selectedConversation, setSelectedConversation] = useState<EmployeeSmsConversation | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Conversation List - hidden on mobile when conversation selected */}
      <div className={cn(
        "w-full md:w-80 md:border-r border-border flex flex-col",
        selectedConversation ? "hidden md:flex" : "flex"
      )}>
        <div className="p-3 border-b bg-muted/30">
          <h3 className="font-medium text-sm">SMS-samtaler med medarbejdere</h3>
        </div>
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Ingen SMS-samtaler endnu</p>
              <p className="text-xs mt-1">Send en SMS fra medarbejderoversigten for at starte</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {conversations.map((conv) => (
                <button
                  key={conv.employee_id}
                  onClick={() => setSelectedConversation(conv)}
                  className={cn(
                    "w-full p-3 text-left hover:bg-muted/50 transition-colors",
                    selectedConversation?.employee_id === conv.employee_id && "bg-muted"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{conv.employee_name}</span>
                    {conv.unread_count > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 px-1.5 text-xs">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {conv.last_message || "Ingen beskeder"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(conv.last_message_time), "d. MMM HH:mm", { locale: da })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Conversation View */}
      <div className={cn(
        "flex-1 flex flex-col",
        !selectedConversation ? "hidden md:flex" : "flex"
      )}>
        {selectedConversation ? (
          <ConversationView 
            conversation={selectedConversation} 
            onBack={() => setSelectedConversation(null)} 
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Phone className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Vælg en samtale</h3>
            <p className="text-center text-sm max-w-sm">
              Vælg en SMS-samtale fra listen for at se beskedhistorik og svare
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConversationViewProps {
  conversation: EmployeeSmsConversation;
  onBack: () => void;
}

function ConversationView({ conversation, onBack }: ConversationViewProps) {
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  // Sort messages chronologically (oldest first for display)
  const sortedMessages = [...conversation.messages].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const sendMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ikke logget ind");

      const response = await supabase.functions.invoke("send-employee-sms", {
        body: {
          targetEmployeeId: conversation.employee_id,
          message: message.trim(),
        },
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-sms-conversations"] });
      toast.success("SMS sendt");
      setMessage("");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke sende SMS: ${error.message}`);
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  return (
    <>
      {/* Header */}
      <div className="p-3 border-b bg-muted/30 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h3 className="font-medium">{conversation.employee_name}</h3>
          <p className="text-xs text-muted-foreground">{conversation.employee_phone || "Intet nummer"}</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {sortedMessages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Ingen beskeder i denne samtale</p>
            </div>
          ) : (
            sortedMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.direction === "outbound" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                    msg.direction === "outbound"
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted text-foreground rounded-bl-md"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                  <p
                    className={cn(
                      "text-xs mt-1",
                      msg.direction === "outbound"
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    )}
                  >
                    {format(new Date(msg.created_at), "d. MMM HH:mm", { locale: da })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Compose */}
      <div className="border-t p-3 space-y-2 bg-background/50">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="min-h-[60px] max-h-[120px] resize-none flex-1"
            placeholder="Skriv besked..."
            disabled={!conversation.employee_phone}
          />
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !message.trim() || !conversation.employee_phone}
            size="icon"
            className="h-[60px] w-[60px] shrink-0"
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{charCount} tegn</span>
          <span>{smsCount} SMS{smsCount > 1 ? "er" : ""}</span>
        </div>
      </div>
    </>
  );
}
