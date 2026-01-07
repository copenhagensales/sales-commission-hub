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
import { toast } from "sonner";
import { Loader2, MessageSquare, Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  private_phone: string | null;
}

interface SendEmployeeSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee;
}

interface SmsMessage {
  id: string;
  content: string | null;
  direction: string;
  created_at: string;
  phone_number: string | null;
  read: boolean;
}

export function SendEmployeeSmsDialog({ open, onOpenChange, employee }: SendEmployeeSmsDialogProps) {
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Normalize phone for matching
  const normalizedPhone = employee.private_phone?.replace(/\D/g, '').slice(-8) || '';

  // Fetch SMS conversation history for this employee (employee context only)
  const { data: smsHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ["employee_sms_history", employee.id, normalizedPhone],
    queryFn: async () => {
      if (!normalizedPhone) return [];
      
      // Get messages where:
      // - context_type is 'employee'
      // - AND (target_employee_id = this employee OR sender is current user)
      const { data, error } = await supabase
        .from("communication_logs")
        .select("id, content, direction, created_at, phone_number, read, target_employee_id, sender_employee_id")
        .eq("type", "sms")
        .eq("context_type", "employee")
        .eq("target_employee_id", employee.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data as SmsMessage[];
    },
    enabled: open && !!employee.id,
    refetchInterval: 5000,
  });

  // Subscribe to realtime updates
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel('employee-sms-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communication_logs',
          filter: `type=eq.sms`
        },
        (payload) => {
          const newMessage = payload.new as any;
          // Check if this message belongs to our conversation
          if (newMessage.context_type === 'employee' && newMessage.target_employee_id === employee.id) {
            queryClient.invalidateQueries({ queryKey: ["employee_sms_history", employee.id, normalizedPhone] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, employee.id, normalizedPhone, queryClient]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [smsHistory]);

  const sendSmsMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Ikke logget ind");

      const response = await supabase.functions.invoke('send-employee-sms', {
        body: {
          targetEmployeeId: employee.id,
          message: message.trim(),
        }
      });

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);
      
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee_sms_history", employee.id, normalizedPhone] });
      toast.success("SMS sendt");
      setMessage("");
    },
    onError: (error: Error) => {
      toast.error(`Kunne ikke sende SMS: ${error.message}`);
    },
  });

  const handleSend = () => {
    if (!message.trim()) {
      toast.error("Indtast en besked");
      return;
    }
    if (!employee.private_phone) {
      toast.error("Medarbejderen har intet telefonnummer");
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
            SMS med {employee.first_name} {employee.last_name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{employee.private_phone || 'Intet nummer'}</p>
        </DialogHeader>

        {/* Message History */}
        <ScrollArea className="flex-1 p-4">
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
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-background border-border min-h-[60px] max-h-[120px] resize-none flex-1"
              placeholder="Skriv besked..."
              disabled={!employee.private_phone}
            />
            <Button 
              onClick={handleSend} 
              disabled={sendSmsMutation.isPending || !message.trim() || !employee.private_phone}
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
