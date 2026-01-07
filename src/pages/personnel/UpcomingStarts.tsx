import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Plus, Clock, MapPin, Building2, UserPlus, Mail, Loader2, Trash2 } from "lucide-react";
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
import { format, isToday, isTomorrow, isThisWeek, isPast, addDays } from "date-fns";
import { da } from "date-fns/locale";
import { useState } from "react";
import { CreateCohortDialog } from "@/components/personnel/CreateCohortDialog";
import { AddMemberDialog } from "@/components/personnel/AddMemberDialog";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useToast } from "@/hooks/use-toast";

interface CohortMember {
  id: string;
  status: string;
  notes: string | null;
  candidate_id: string | null;
  employee_id: string | null;
  candidate?: {
    id: string;
    first_name: string;
    last_name: string;
    applied_position: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

interface Cohort {
  id: string;
  name: string;
  start_date: string;
  start_time: string | null;
  client_campaign: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  max_capacity: number | null;
  team_id: string | null;
  team?: {
    id: string;
    name: string;
  } | null;
  members: CohortMember[];
}

const statusLabels: Record<string, string> = {
  planned: "Planlagt",
  in_progress: "I gang",
  completed: "Afsluttet",
  cancelled: "Annulleret",
};

const statusColors: Record<string, string> = {
  planned: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const memberStatusLabels: Record<string, string> = {
  assigned: "Tilmeldt",
  confirmed: "Bekræftet",
  started: "Startet",
  completed: "Færdig",
  cancelled: "Annulleret",
};

export default function UpcomingStarts() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [selectedCohortId, setSelectedCohortId] = useState<string | null>(null);
  const p = usePermissions();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Rekruttering (via canViewReferrals as proxy) or anyone with view permission can view
  // Edit access for rekruttering
  const canEdit = p.hasPermission("menu_upcoming_starts", "edit") || p.canViewReferrals;

  const { data: cohorts = [], isLoading } = useQuery({
    queryKey: ["onboarding-cohorts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("onboarding_cohorts")
        .select(`
          *,
          team:teams(id, name)
        `)
        .order("start_date", { ascending: true });

      if (error) throw error;

      // Fetch members for each cohort
      const cohortsWithMembers: Cohort[] = await Promise.all(
        (data || []).map(async (cohort) => {
          const { data: members } = await supabase
            .from("cohort_members")
            .select(`
              *,
              candidate:candidates(id, first_name, last_name, applied_position, email, phone),
              employee:employee_master_data(id, first_name, last_name)
            `)
            .eq("cohort_id", cohort.id);

          return {
            ...cohort,
            members: members || [],
          };
        })
      );

      return cohortsWithMembers;
    },
  });

  // Fetch hired candidates without cohort assignment
  const { data: unassignedCandidates = [] } = useQuery({
    queryKey: ["unassigned-hired-candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidates")
        .select("id, first_name, last_name, applied_position, available_from, cohort_assignment_status, updated_at")
        .eq("status", "hired")
        .not("cohort_assignment_status", "eq", "assigned")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ cohortId, status }: { cohortId: string; status: string }) => {
      const { error } = await supabase
        .from("onboarding_cohorts")
        .update({ status })
        .eq("id", cohortId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-cohorts"] });
      toast({ title: "Status opdateret" });
    },
  });

  const deleteCandidateMutation = useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase
        .from("candidates")
        .delete()
        .eq("id", candidateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unassigned-hired-candidates"] });
      toast({ title: "Kandidat slettet" });
    },
    onError: () => {
      toast({ title: "Kunne ikke slette kandidat", variant: "destructive" });
    },
  });

  // Start cohort and send invitations mutation
  const startCohortAndInviteMutation = useMutation({
    mutationFn: async (cohort: Cohort) => {
      const results = { sent: 0, skipped: 0, errors: [] as string[] };
      
      // Get members that have a candidate but no employee yet
      const membersToProcess = cohort.members.filter(
        m => m.candidate && !m.employee_id && m.status !== "cancelled"
      );

      for (const member of membersToProcess) {
        const candidate = member.candidate!;
        
        // Skip if no email
        if (!candidate.email) {
          results.skipped++;
          results.errors.push(`${candidate.first_name} ${candidate.last_name} mangler email`);
          continue;
        }

        try {
          // 1. Create employee record
          const { data: employee, error: empError } = await supabase
            .from("employee_master_data")
            .insert({
              first_name: candidate.first_name,
              last_name: candidate.last_name,
              private_email: candidate.email,
              private_phone: candidate.phone,
              job_title: candidate.applied_position,
              employment_start_date: cohort.start_date,
              team_id: cohort.team_id,
              is_active: true,
              invitation_status: "pending",
            })
            .select()
            .single();

          if (empError) throw empError;

          // 2. Update cohort member with employee_id
          const { error: memberError } = await supabase
            .from("cohort_members")
            .update({ 
              employee_id: employee.id,
              status: "confirmed" 
            })
            .eq("id", member.id);

          if (memberError) throw memberError;

          // 3. Send invitation email
          const { error: inviteError } = await supabase.functions.invoke(
            "send-employee-invitation",
            {
              body: {
                employeeId: employee.id,
                email: candidate.email,
                name: `${candidate.first_name} ${candidate.last_name}`,
              },
            }
          );

          if (inviteError) throw inviteError;

          // 4. Update candidate status
          const { error: candError } = await supabase
            .from("candidates")
            .update({ 
              status: "onboarding",
              cohort_assignment_status: "started" 
            })
            .eq("id", candidate.id);

          if (candError) throw candError;

          results.sent++;
        } catch (err: any) {
          results.errors.push(`Fejl ved ${candidate.first_name}: ${err.message}`);
        }
      }

      // 5. Update cohort status to in_progress
      const { error: cohortError } = await supabase
        .from("onboarding_cohorts")
        .update({ status: "in_progress" })
        .eq("id", cohort.id);

      if (cohortError) throw cohortError;

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-cohorts"] });
      queryClient.invalidateQueries({ queryKey: ["unassigned-hired-candidates"] });
      
      if (results.errors.length > 0) {
        toast({
          title: `${results.sent} invitationer sendt`,
          description: `${results.skipped} sprunget over. ${results.errors.join(", ")}`,
          variant: results.sent === 0 ? "destructive" : "default",
        });
      } else {
        toast({ 
          title: "Hold startet!", 
          description: `${results.sent} invitationer sendt` 
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddMember = (cohortId: string) => {
    setSelectedCohortId(cohortId);
    setAddMemberDialogOpen(true);
  };

  // Group cohorts by timing
  const groupCohorts = () => {
    const today: Cohort[] = [];
    const tomorrow: Cohort[] = [];
    const thisWeek: Cohort[] = [];
    const upcoming: Cohort[] = [];
    const past: Cohort[] = [];

    cohorts.forEach((cohort) => {
      const date = new Date(cohort.start_date);
      if (isPast(date) && !isToday(date)) {
        past.push(cohort);
      } else if (isToday(date)) {
        today.push(cohort);
      } else if (isTomorrow(date)) {
        tomorrow.push(cohort);
      } else if (isThisWeek(date)) {
        thisWeek.push(cohort);
      } else {
        upcoming.push(cohort);
      }
    });

    return { today, tomorrow, thisWeek, upcoming, past };
  };

  const { today, tomorrow, thisWeek, upcoming, past } = groupCohorts();

  const renderCohortCard = (cohort: Cohort) => {
    const memberCount = cohort.members.filter(m => m.status !== "cancelled").length;
    const capacityText = cohort.max_capacity 
      ? `${memberCount}/${cohort.max_capacity}` 
      : memberCount.toString();
    const isAtCapacity = cohort.max_capacity && memberCount >= cohort.max_capacity;

    return (
      <Card key={cohort.id} className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{cohort.name}</CardTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(cohort.start_date), "EEEE d. MMMM yyyy", { locale: da })}
                </div>
                {cohort.start_time && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {cohort.start_time.slice(0, 5)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                {cohort.team && (
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {cohort.team.name}
                  </div>
                )}
                {cohort.client_campaign && (
                  <Badge variant="outline" className="text-xs">
                    {cohort.client_campaign}
                  </Badge>
                )}
                {cohort.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {cohort.location}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge className={statusColors[cohort.status]}>
                {statusLabels[cohort.status]}
              </Badge>
              <Badge variant="secondary" className={isAtCapacity ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" : ""}>
                <Users className="h-3 w-3 mr-1" />
                {capacityText}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {cohort.notes && (
            <p className="text-sm text-muted-foreground mb-3">{cohort.notes}</p>
          )}
          
          {/* Members list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Deltagere</h4>
              {canEdit && !isAtCapacity && cohort.status !== "completed" && cohort.status !== "cancelled" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddMember(cohort.id)}
                >
                  <UserPlus className="h-4 w-4 mr-1" />
                  Tilføj
                </Button>
              )}
            </div>
            
            {cohort.members.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Ingen deltagere endnu</p>
            ) : (
              <div className="space-y-1">
                {cohort.members.map((member) => {
                  const name = member.candidate 
                    ? `${member.candidate.first_name} ${member.candidate.last_name}`
                    : member.employee 
                      ? `${member.employee.first_name} ${member.employee.last_name}`
                      : "Ukendt";
                  const position = member.candidate?.applied_position;
                  
                  return (
                    <div 
                      key={member.id} 
                      className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{name}</p>
                        {position && (
                          <p className="text-sm text-muted-foreground truncate">{position}</p>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-2 text-xs shrink-0">
                        {memberStatusLabels[member.status]}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          {canEdit && cohort.status === "planned" && (
            <div className="flex gap-2 mt-4 pt-3 border-t">
              <Button
                variant="default"
                size="sm"
                onClick={() => startCohortAndInviteMutation.mutate(cohort)}
                disabled={startCohortAndInviteMutation.isPending}
              >
                {startCohortAndInviteMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4 mr-2" />
                )}
                Start hold og send invitationer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderSection = (title: string, cohortList: Cohort[], highlight?: boolean) => {
    if (cohortList.length === 0) return null;
    
    return (
      <div className="space-y-3">
        <h2 className={`text-lg font-semibold ${highlight ? "text-primary" : ""}`}>
          {title}
          <Badge variant="secondary" className="ml-2">
            {cohortList.length}
          </Badge>
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cohortList.map(renderCohortCard)}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">Indlæser kommende opstarter...</p>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Kommende Opstarter
            </h1>
            <p className="text-muted-foreground">
              Oversigt over planlagte opstartshold og nye medarbejdere
            </p>
          </div>
          {canEdit && (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Opret hold
            </Button>
          )}
        </div>

        {/* Unassigned hired candidates section */}
        {unassignedCandidates.length > 0 && (
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-amber-600" />
                Nyansatte uden hold
                <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  {unassignedCandidates.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {unassignedCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {candidate.first_name} {candidate.last_name}
                      </p>
                      {candidate.applied_position && (
                        <p className="text-sm text-muted-foreground truncate">
                          {candidate.applied_position}
                        </p>
                      )}
                      {candidate.available_from && (
                        <p className="text-xs text-muted-foreground">
                          Kan starte: {format(new Date(candidate.available_from), "d. MMM", { locale: da })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs shrink-0 bg-amber-50 text-amber-700 border-amber-300">
                        Afventer
                      </Badge>
                      {canEdit && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Slet kandidat</AlertDialogTitle>
                              <AlertDialogDescription>
                                Er du sikker på, at du vil slette {candidate.first_name} {candidate.last_name}? Denne handling kan ikke fortrydes.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuller</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteCandidateMutation.mutate(candidate.id)}
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
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {cohorts.length === 0 && unassignedCandidates.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                Ingen opstartshold planlagt endnu
              </p>
              {canEdit && (
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Opret første hold
                </Button>
              )}
            </CardContent>
          </Card>
        ) : cohorts.length > 0 && (
          <div className="space-y-8">
            {renderSection("I dag", today, true)}
            {renderSection("I morgen", tomorrow)}
            {renderSection("Denne uge", thisWeek)}
            {renderSection("Kommende", upcoming)}
            {renderSection("Tidligere", past)}
          </div>
        )}
      </div>

      <CreateCohortDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
      
      <AddMemberDialog
        open={addMemberDialogOpen}
        onOpenChange={setAddMemberDialogOpen}
        cohortId={selectedCohortId}
      />
    </MainLayout>
  );
}
