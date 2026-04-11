import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Phone, Loader2, User } from "lucide-react";
import { format, isSameDay, parseISO } from "date-fns";
import { da } from "date-fns/locale";

export function BookingCalendarTab() {
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const { data: candidates, isLoading } = useQuery({
    queryKey: ["booking-calendar-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, email, phone, status, interview_date")
        .eq("status", "interview_scheduled")
        .not("interview_date", "is", null)
        .order("interview_date", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Dates that have interviews
  const interviewDates = useMemo(() => {
    if (!candidates) return new Set<string>();
    return new Set(
      candidates.map((c) => format(parseISO(c.interview_date!), "yyyy-MM-dd"))
    );
  }, [candidates]);

  // Candidates for selected date
  const candidatesForDate = useMemo(() => {
    if (!candidates || !selectedDate) return [];
    return candidates.filter((c) =>
      isSameDay(parseISO(c.interview_date!), selectedDate)
    );
  }, [candidates, selectedDate]);

  // "Talt med" mutation
  const contactedMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase
        .from("candidates")
        .update({ status: "interview_completed" })
        .eq("id", candidateId);
      if (error) throw error;

      // Cancel active enrollments
      const { data: enrollments } = await supabase
        .from("booking_flow_enrollments")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("status", "active");

      if (enrollments?.length) {
        const ids = enrollments.map((e) => e.id);
        await supabase
          .from("booking_flow_enrollments")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .in("id", ids);
        await supabase
          .from("booking_flow_touchpoints")
          .update({ status: "cancelled" })
          .in("enrollment_id", ids)
          .eq("status", "pending");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-calendar-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["booking-flow-enrollments"] });
      toast.success("Kandidat markeret som kontaktet");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  // "Ikke fået fat" mutation
  const unreachableMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase
        .from("candidates")
        .update({ status: "contacted", interview_date: null })
        .eq("id", candidateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-calendar-candidates"] });
      toast.success("Kandidat sat tilbage i flowet");
    },
    onError: (err: any) => toast.error("Fejl: " + err.message),
  });

  const isProcessing = contactedMutation.isPending || unreachableMutation.isPending;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
      {/* Calendar */}
      <Card>
        <CardContent className="pt-6">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={da}
            modifiers={{
              hasInterview: (date) =>
                interviewDates.has(format(date, "yyyy-MM-dd")),
            }}
            modifiersClassNames={{
              hasInterview: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1.5 after:h-1.5 after:rounded-full after:bg-primary",
            }}
          />
          {isLoading && (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Day list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {selectedDate
              ? format(selectedDate, "EEEE d. MMMM yyyy", { locale: da })
              : "Vælg en dato"}
          </CardTitle>
          {candidatesForDate.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {candidatesForDate.length} samtale{candidatesForDate.length !== 1 ? "r" : ""}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {candidatesForDate.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Ingen samtaler denne dag
            </p>
          ) : (
            <div className="divide-y">
              {candidatesForDate.map((candidate) => (
                <div
                  key={candidate.id}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {candidate.first_name} {candidate.last_name}
                      </p>
                      {candidate.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {candidate.phone}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Kl. {format(parseISO(candidate.interview_date!), "HH:mm")}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={isProcessing}
                      onClick={() => unreachableMutation.mutate(candidate.id)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Ikke fået fat
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5"
                      disabled={isProcessing}
                      onClick={() => contactedMutation.mutate(candidate.id)}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Talt med
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
