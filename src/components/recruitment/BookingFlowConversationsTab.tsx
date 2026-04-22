import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, User, Phone, Mail, ExternalLink, XCircle, Send, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDistanceToNow, parseISO } from "date-fns";
import { da } from "date-fns/locale";

const candidateStatusLabel: Record<string, { label: string; className: string }> = {
  new: { label: "Ny", className: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
  contacted: { label: "Kontaktet", className: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  booking_pending: { label: "Booking afventer", className: "bg-purple-500/10 text-purple-600 border-purple-500/30" },
  booking_completed: { label: "Booking gennemført", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
};

const EXCLUDED_STATUSES = ["interview_scheduled", "interview_completed", "hired", "rejected", "ghostet", "takket_nej"];

export function BookingFlowConversationsTab() {
  const queryClient = useQueryClient();

  const { data: enrollments, isLoading } = useQuery({
    queryKey: ["booking-flow-active-conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_flow_enrollments")
        .select(`
          id, current_day, tier, enrolled_at, status,
          candidates!inner(id, first_name, last_name, email, phone, status),
          booking_flow_touchpoints(id, day, channel, template_key, status, scheduled_at, sent_at)
        `)
        .eq("status", "active")
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return (data || []).filter(
        (e: any) => !EXCLUDED_STATUSES.includes(e.candidates?.status)
      );
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase
        .from("booking_flow_enrollments")
        .update({
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancelled_reason: "Manuelt annulleret",
        })
        .eq("id", enrollmentId);
      if (error) throw error;
      await supabase
        .from("booking_flow_touchpoints")
        .update({ status: "cancelled" })
        .eq("enrollment_id", enrollmentId)
        .eq("status", "pending");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-flow-active-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["booking-flow-enrollments"] });
      toast.success("Flow annulleret");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!enrollments || enrollments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Ingen aktive booking-samtaler
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          Kandidater i booking-flow
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {enrollments.length} aktiv{enrollments.length !== 1 ? "e" : ""} samtale{enrollments.length !== 1 ? "r" : ""} — kandidater under outreach (før de har booket tid)
        </p>
      </CardHeader>
      <CardContent>
        <div className="divide-y">
          {enrollments.map((enr: any) => {
            const candidate = enr.candidates;
            const touchpoints = enr.booking_flow_touchpoints || [];
            const lastSent = touchpoints
              .filter((t: any) => t.status === "sent" && t.sent_at)
              .sort((a: any, b: any) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime())[0];
            const nextScheduled = touchpoints
              .filter((t: any) => t.status === "pending")
              .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0];
            const totalSteps = touchpoints.length;
            const statusInfo = candidateStatusLabel[candidate?.status] || { label: candidate?.status || "—", className: "bg-muted text-muted-foreground" };

            return (
              <div key={enr.id} className="py-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm truncate">
                        {candidate?.first_name} {candidate?.last_name}
                      </p>
                      <Badge variant="outline" className={statusInfo.className}>
                        {statusInfo.label}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        Tier {enr.tier}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {candidate?.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {candidate.phone}
                        </span>
                      )}
                      {candidate?.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {candidate.email}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>Dag {enr.current_day}{totalSteps > 0 ? ` / ${totalSteps}` : ""}</span>
                      {lastSent && (
                        <span className="flex items-center gap-1">
                          <Send className="h-3 w-3" />
                          Sidst sendt {formatDistanceToNow(parseISO(lastSent.sent_at), { addSuffix: true, locale: da })}
                        </span>
                      )}
                      {nextScheduled && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Næste {formatDistanceToNow(parseISO(nextScheduled.scheduled_at), { addSuffix: true, locale: da })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <Link to={`/recruitment/candidates/${candidate?.id}`}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Åbn kandidat
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                    disabled={cancelMutation.isPending}
                    onClick={() => {
                      if (confirm(`Annullér booking-flow for ${candidate?.first_name} ${candidate?.last_name}?`)) {
                        cancelMutation.mutate(enr.id);
                      }
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Annullér flow
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
