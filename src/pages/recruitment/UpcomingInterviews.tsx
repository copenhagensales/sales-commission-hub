import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Phone, Mail, Trash2, ChevronDown, History } from "lucide-react";
import { format } from "date-fns";
import { da } from "date-fns/locale";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UpcomingInterview {
  id: string;
  interview_date: string;
  role: string;
  candidate_id: string;
  candidate: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string | null;
  };
}

interface GroupedInterview {
  date: string;
  count: number;
  interviews: UpcomingInterview[];
}

const roleLabels: Record<string, string> = {
  fieldmarketing: "Fieldmarketing",
  salgskonsulent: "Salgskonsulent",
};

export default function UpcomingInterviews() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: upcomingInterviews = [], isLoading } = useQuery({
    queryKey: ["upcoming-interviews"],
    queryFn: async () => {
      const now = new Date().toISOString();

      const { data: candidates, error } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, phone, email, interview_date, applied_position")
        .eq("status", "interview_scheduled")
        .gte("interview_date", now)
        .not("interview_date", "is", null)
        .order("interview_date", { ascending: true });

      if (error) throw error;

      // Group by date
      const grouped = new Map<string, GroupedInterview>();

      candidates?.forEach((candidate) => {
        if (!candidate.interview_date) return;

        const dateKey = candidate.interview_date.split("T")[0];

        if (!grouped.has(dateKey)) {
          grouped.set(dateKey, {
            date: dateKey,
            count: 0,
            interviews: [],
          });
        }

        const group = grouped.get(dateKey)!;
        group.count++;
        group.interviews.push({
          id: candidate.id,
          interview_date: candidate.interview_date,
          role: candidate.applied_position || "Ukendt",
          candidate_id: candidate.id,
          candidate: {
            id: candidate.id,
            first_name: candidate.first_name,
            last_name: candidate.last_name,
            phone: candidate.phone,
            email: candidate.email,
          },
        });
      });

      return Array.from(grouped.values()).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    },
  });

  const { data: pastInterviews = [] } = useQuery({
    queryKey: ["past-interviews"],
    queryFn: async () => {
      const now = new Date().toISOString();

      const { data: candidates, error } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, phone, email, interview_date, applied_position")
        .lt("interview_date", now)
        .not("interview_date", "is", null)
        .order("interview_date", { ascending: false })
        .limit(20);

      if (error) throw error;

      return candidates || [];
    },
  });

  const deleteInterviewMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase
        .from("candidates")
        .update({ interview_date: null, status: "contacted" })
        .eq("id", candidateId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Samtale slettet");
      queryClient.invalidateQueries({ queryKey: ["upcoming-interviews"] });
    },
    onError: () => {
      toast.error("Kunne ikke slette samtale");
    },
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Indlæser kommende samtaler...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">Kommende samtaler</h1>
            <p className="text-muted-foreground">
              Oversigt over planlagte jobsamtaler
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <History className="h-4 w-4" />
                Tidligere samtaler
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
              {pastInterviews.length === 0 ? (
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  Ingen tidligere samtaler
                </div>
              ) : (
                pastInterviews.map((interview) => (
                  <DropdownMenuItem
                    key={interview.id}
                    className="flex flex-col items-start gap-1 py-3 cursor-pointer"
                    onClick={() => navigate(`/recruitment/candidates/${interview.id}`)}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-medium">
                        {interview.first_name} {interview.last_name}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {roleLabels[interview.applied_position || ""] || interview.applied_position || "Ukendt"}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {interview.interview_date && format(new Date(interview.interview_date), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {upcomingInterviews.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Ingen kommende samtaler planlagt
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {upcomingInterviews.map((group, index) => (
              <Card key={`${group.date}_${index}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">
                        {format(new Date(group.date), "EEEE d. MMMM yyyy", {
                          locale: da,
                        })}
                      </CardTitle>
                    </div>
                    <Badge variant="outline" className="text-sm">
                      {group.count} {group.count === 1 ? "samtale" : "samtaler"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.interviews.map((interview) => (
                      <div
                        key={interview.id}
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                        onClick={() => navigate(`/recruitment/candidates/${interview.candidate.id}`)}
                      >
                        <div className="flex-1">
                          <p className="font-medium group-hover:text-primary transition-colors">
                            {interview.candidate.first_name} {interview.candidate.last_name}
                          </p>
                          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                            {interview.candidate.phone && (
                              <span 
                                className="flex items-center gap-1 hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `tel:${interview.candidate.phone}`;
                                }}
                              >
                                <Phone className="h-3 w-3" />
                                {interview.candidate.phone}
                              </span>
                            )}
                            {interview.candidate.email && (
                              <span 
                                className="flex items-center gap-1 hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.location.href = `mailto:${interview.candidate.email}`;
                                }}
                              >
                                <Mail className="h-3 w-3" />
                                {interview.candidate.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="secondary">
                            {roleLabels[interview.role] || interview.role}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(interview.interview_date), "HH:mm")}
                          </span>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Slet samtale</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Er du sikker på at du vil slette denne samtale for {interview.candidate.first_name} {interview.candidate.last_name}?
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuller</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteInterviewMutation.mutate(interview.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Slet
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
