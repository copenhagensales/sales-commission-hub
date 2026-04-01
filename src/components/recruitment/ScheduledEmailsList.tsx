import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Clock, X } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { toast } from "sonner";

interface ScheduledEmailsListProps {
  candidateId?: string;
  maxHeight?: string;
}

export function ScheduledEmailsList({ candidateId, maxHeight = "300px" }: ScheduledEmailsListProps) {
  const queryClient = useQueryClient();

  const { data: emails = [], isLoading } = useQuery({
    queryKey: ["scheduled_emails", candidateId || "all"],
    queryFn: async () => {
      let query = supabase
        .from("scheduled_emails")
        .select("*")
        .eq("status", "pending")
        .order("scheduled_at", { ascending: true });

      if (candidateId) {
        query = query.eq("candidate_id", candidateId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { error } = await supabase
        .from("scheduled_emails")
        .update({ status: "cancelled" })
        .eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled_emails"] });
      toast.success("Planlagt email annulleret");
    },
    onError: () => {
      toast.error("Kunne ikke annullere email");
    },
  });

  if (isLoading) {
    return <p className="text-sm text-muted-foreground text-center py-4">Indlæser...</p>;
  }

  if (emails.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        Ingen planlagte emails
      </p>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }}>
      <div className="space-y-2">
        {emails.map((email) => (
          <div
            key={email.id}
            className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border"
          >
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Mail className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{email.subject}</p>
              <p className="text-xs text-muted-foreground truncate">
                Til: {email.recipient_name || email.recipient_email}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(email.scheduled_at), "d. MMM yyyy HH:mm", { locale: da })}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => cancelMutation.mutate(email.id)}
              disabled={cancelMutation.isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
