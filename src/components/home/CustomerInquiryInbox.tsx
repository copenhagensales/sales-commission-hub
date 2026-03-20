import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Inbox, Mail, MailOpen, Building2, Phone, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Inquiry {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  is_read: boolean;
  created_at: string;
}

export const CustomerInquiryInbox = () => {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: inquiries = [] } = useQuery({
    queryKey: ["customer-inquiries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_inquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as Inquiry[];
    },
    refetchInterval: 30000,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_inquiries")
        .update({ is_read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customer-inquiries"] }),
  });

  const deleteInquiry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("customer_inquiries")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-inquiries"] });
      toast.success("Henvendelse slettet");
    },
    onError: () => {
      toast.error("Kunne ikke slette henvendelsen");
    },
  });

  const unreadCount = inquiries.filter((i) => !i.is_read).length;
  const hasUnread = unreadCount > 0;

  const handleClick = (inquiry: Inquiry) => {
    setExpandedId(expandedId === inquiry.id ? null : inquiry.id);
    if (!inquiry.is_read) {
      markAsRead.mutate(inquiry.id);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all duration-300",
        hasUnread &&
          "border-destructive shadow-[0_0_15px_hsl(var(--destructive)/0.4)] animate-pulse"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Inbox className="h-5 w-5" />
            Kundehenvendelser
          </CardTitle>
          {hasUnread && (
            <Badge variant="destructive" className="text-sm px-3">
              {unreadCount} ulæst{unreadCount !== 1 ? "e" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {inquiries.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Ingen henvendelser endnu
          </p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {inquiries.map((inquiry) => (
              <div
                key={inquiry.id}
                onClick={() => handleClick(inquiry)}
                className={cn(
                  "p-3 rounded-lg cursor-pointer transition-colors border",
                  !inquiry.is_read
                    ? "bg-destructive/10 border-destructive/30 hover:bg-destructive/15"
                    : "bg-muted/50 border-transparent hover:bg-muted"
                )}
              >
                <div className="flex items-start gap-2">
                  {inquiry.is_read ? (
                    <MailOpen className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  ) : (
                    <Mail className="h-4 w-4 mt-0.5 text-destructive shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("font-medium text-sm truncate", !inquiry.is_read && "text-destructive")}>
                        {inquiry.name}
                      </span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(inquiry.created_at), "d. MMM HH:mm", { locale: da })}
                      </span>
                    </div>
                    {inquiry.company && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Building2 className="h-3 w-3" />
                        {inquiry.company}
                      </div>
                    )}
                    {expandedId === inquiry.id && (
                      <div className="mt-2 space-y-1.5 text-sm">
                        {inquiry.email && (
                          <div className="text-muted-foreground">
                            📧 <a href={`mailto:${inquiry.email}`} className="underline">{inquiry.email}</a>
                          </div>
                        )}
                        {inquiry.phone && (
                          <div className="text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <a href={`tel:${inquiry.phone}`} className="underline">{inquiry.phone}</a>
                          </div>
                        )}
                        {inquiry.message && (
                          <div className="bg-background rounded p-2 text-foreground whitespace-pre-wrap">
                            {inquiry.message}
                          </div>
                        )}
                        <div className="flex justify-end pt-2">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Slet
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Slet henvendelse?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Henvendelsen fra {inquiry.name} slettes permanent. Denne handling kan ikke fortrydes.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  onClick={() => deleteInquiry.mutate(inquiry.id)}
                                >
                                  Slet
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
