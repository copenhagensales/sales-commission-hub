import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { MessageSquare, Mail, ArrowUpRight, ArrowDownLeft, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface CandidateChatHistoryProps {
  candidatePhone: string | null;
  candidateId: string;
  maxHeight?: string;
}

export function CandidateChatHistory({ candidatePhone, candidateId, maxHeight = "400px" }: CandidateChatHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Normalize phone number for matching
  const normalizePhone = (phone: string | null) => {
    if (!phone) return null;
    return phone.replace(/\D/g, '').replace(/^45/, '').replace(/^\+45/, '');
  };

  const normalizedPhone = normalizePhone(candidatePhone);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["candidate-messages", candidateId, normalizedPhone],
    queryFn: async (): Promise<any[]> => {
      if (!normalizedPhone && !candidateId) return [];
      
      // Build queries separately to avoid type chain issues
      // @ts-ignore - Supabase type chain too deep
      const result = await supabase
        .from("communication_logs")
        .select("*")
        .eq("candidate_id", candidateId)
        .in("type", ["sms", "email"])
        .order("created_at", { ascending: true });

      let data = result.data || [];
      
      // Also fetch by phone if available
      if (normalizedPhone) {
        // @ts-ignore - Supabase type chain too deep
        const phoneResult = await supabase
          .from("communication_logs")
          .select("*")
          .ilike("phone_number", `%${normalizedPhone}%`)
          .in("type", ["sms", "email"])
          .order("created_at", { ascending: true });
        
        const phoneData = phoneResult.data || [];
        
        // Merge and dedupe
        const allData = [...data, ...phoneData];
        data = allData.filter((item: any, index: number, self: any[]) => 
          index === self.findIndex((t: any) => t.id === item.id)
        ).sort((a: any, b: any) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      }

      return data;
    },
    enabled: !!normalizedPhone || !!candidateId,
  });

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.from("communication_logs").delete().eq('id', messageId);
      
      if (error) throw error;
      
      toast.success("Besked slettet");
      queryClient.invalidateQueries({ queryKey: ["candidate-messages"] });
      queryClient.invalidateQueries({ queryKey: ["recruitment-sms-logs"] });
    } catch (error) {
      console.error("Error deleting message:", error);
      toast.error("Kunne ikke slette besked");
    }
  };

  // Set up realtime subscription
  useEffect(() => {
    if (!candidateId && !normalizedPhone) return;

    const channel = supabase
      .channel(`candidate-chat-${candidateId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'communication_logs',
        },
        () => {
          // Refetch on new messages
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [candidateId, normalizedPhone]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse text-muted-foreground">Indlæser beskeder...</div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <MessageSquare className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Ingen beskeder endnu</p>
        <p className="text-sm text-muted-foreground mt-1">Send en SMS eller email for at starte</p>
      </div>
    );
  }

  return (
    <ScrollArea className="pr-4" style={{ maxHeight }} ref={scrollRef}>
      <div className="space-y-3">
        {messages.map((msg: any) => {
          const direction = String(msg.direction || "").toLowerCase();
          const isOutgoing = ["outgoing", "outbound", "sent", "send"].includes(direction);
          const isSms = String(msg.type || "").toLowerCase() === "sms";
          
          return (
            <div
              key={msg.id}
              className={`flex ${isOutgoing ? "justify-end" : "justify-start"} group`}
            >
              <div className="flex items-start gap-1">
                {isOutgoing && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Slet besked?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Er du sikker på, at du vil slette denne besked? Denne handling kan ikke fortrydes.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Slet
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    isOutgoing
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {isSms ? (
                      <MessageSquare className="h-3 w-3" />
                    ) : (
                      <Mail className="h-3 w-3" />
                    )}
                    <span className="text-xs opacity-70">
                      {isSms ? "SMS" : "Email"}
                    </span>
                    {isOutgoing ? (
                      <ArrowUpRight className="h-3 w-3 opacity-70" />
                    ) : (
                      <ArrowDownLeft className="h-3 w-3 opacity-70" />
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">
                    {msg.content || msg.subject || "(Ingen indhold)"}
                  </p>
                  <p className={`text-xs mt-1 ${isOutgoing ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "d. MMM HH:mm", { locale: da })}
                  </p>
                </div>
                {!isOutgoing && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Slet besked?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Er du sikker på, at du vil slette denne besked? Denne handling kan ikke fortrydes.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuller</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteMessage(msg.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Slet
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
