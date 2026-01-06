import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, MessageSquare, Send, ArrowDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  applied_position?: string | null;
}

interface SendSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: Candidate;
}

interface SmsMessage {
  id: string;
  content: string | null;
  direction: string;
  created_at: string;
  phone_number: string | null;
  read: boolean;
}

export function SendSmsDialog({ open, onOpenChange, candidate }: SendSmsDialogProps) {
  const [message, setMessage] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Normalize phone for matching
  const normalizedPhone = candidate.phone?.replace(/\D/g, '').slice(-8) || '';

  // Fetch SMS conversation history for this candidate
  const { data: smsHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["sms_history", candidate.id, normalizedPhone],
    queryFn: async () => {
      if (!normalizedPhone) return [];
      
      const { data, error } = await supabase
        .from("communication_logs")
        .select("id, content, direction, created_at, phone_number, read")
        .eq("type", "sms")
        .or(`phone_number.ilike.%${normalizedPhone}`)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as SmsMessage[];
    },
    enabled: open && !!normalizedPhone,
    refetchInterval: 5000, // Fallback polling every 5s while dialog is open
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!open || !normalizedPhone) return;

    const channel = supabase
      .channel('sms-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communication_logs',
          filter: `type=eq.sms`
        },
        (payload) => {
          const newMessage = payload.new as SmsMessage;
          // Check if this message belongs to our conversation
          if (newMessage.phone_number?.includes(normalizedPhone)) {
            queryClient.invalidateQueries({ queryKey: ["sms_history", candidate.id, normalizedPhone] });
            queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, normalizedPhone, candidate.id, queryClient]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [smsHistory]);

  const { data: templates = [] } = useQuery({
    queryKey: ["sms_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sms_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const sendSmsMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-recruitment-sms', {
        body: {
          candidateId: candidate.id,
          phoneNumber: candidate.phone,
          message: message.trim(),
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["communication_logs"] });
      queryClient.invalidateQueries({ queryKey: ["sms_history", candidate.id, normalizedPhone] });
      toast.success("SMS sendt");
      setMessage("");
      setSelectedTemplate("");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke sende SMS: ${error.message}`);
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      let personalizedMessage = template.content
        .replace(/\{\{fornavn\}\}/g, candidate.first_name)
        .replace(/\{\{rolle\}\}/g, candidate.applied_position || "stillingen");
      setMessage(personalizedMessage);
    }
  };

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Indtast en besked");
      return;
    }
    if (!candidate.phone) {
      toast.error("Kandidaten har intet telefonnummer");
      return;
    }
    sendSmsMutation.mutate();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = message.length;
  const smsCount = Math.ceil(charCount / 160) || 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-md sm:max-w-lg h-[80vh] max-h-[700px] flex flex-col p-0">
        <DialogHeader className="p-4 pb-2 border-b border-border shrink-0">
          <DialogTitle className="text-foreground flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            SMS med {candidate.first_name} {candidate.last_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{candidate.phone || 'Intet nummer'}</p>
        </DialogHeader>

        {/* Message History */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-3">
            {historyLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : smsHistory.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Ingen beskeder endnu</p>
                <p className="text-sm">Start en samtale nedenfor</p>
              </div>
            ) : (
              smsHistory.map((sms) => (
                <div
                  key={sms.id}
                  className={cn(
                    "flex",
                    sms.direction === "outbound" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                      sms.direction === "outbound"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{sms.content}</p>
                    <p className={cn(
                      "text-xs mt-1",
                      sms.direction === "outbound" 
                        ? "text-primary-foreground/70" 
                        : "text-muted-foreground"
                    )}>
                      {format(new Date(sms.created_at), "d. MMM HH:mm", { locale: da })}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Compose Area */}
        <div className="border-t border-border p-4 space-y-3 shrink-0 bg-background/50">
          {templates.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Skabelon</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger className="bg-background border-border h-9">
                  <SelectValue placeholder="Vælg skabelon..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-background border-border min-h-[60px] max-h-[120px] resize-none flex-1"
              placeholder="Skriv besked..."
              disabled={!candidate.phone}
            />
            <Button 
              onClick={handleSend} 
              disabled={sendSmsMutation.isPending || !message.trim() || !candidate.phone}
              size="icon"
              className="h-[60px] w-[60px] shrink-0"
            >
              {sendSmsMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{charCount} tegn</span>
            <span>{smsCount} SMS{smsCount > 1 ? 'er' : ''}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
