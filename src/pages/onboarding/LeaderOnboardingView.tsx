import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOnboardingDays, useCoachingTasks, useUpdateCoachingTask, useCoachingCoverageStats } from "@/hooks/useOnboarding";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ClipboardList, CheckCircle2, AlertTriangle, BarChart3, Calendar, MessageSquarePlus, FileText, ExternalLink } from "lucide-react";
import { useState, useMemo } from "react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { da } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { CoachingFeedbackModal } from "@/components/coaching/CoachingFeedbackModal";
import { useCurrentEmployeeId } from "@/hooks/useOnboarding";
import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function LeaderOnboardingView() {
  const { data: days = [] } = useOnboardingDays();
  const { data: tasks = [], isLoading: tasksLoading } = useCoachingTasks({});
  const { data: coverageStats = [] } = useCoachingCoverageStats();
  const updateTask = useUpdateCoachingTask();
  
  const { data: currentEmployeeId } = useCurrentEmployeeId();
  
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCoachingModal, setShowCoachingModal] = useState(false);
  const [selectedEmployeeForCoaching, setSelectedEmployeeForCoaching] = useState<string | null>(null);

  // Fetch new employees (employment_start_date >= today)
  const { data: newEmployees = [] } = useQuery({
    queryKey: ["new-employees-for-onboarding"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title, employment_start_date, manager_id")
        .eq("is_active", true)
        .gte("employment_start_date", today)
        .order("employment_start_date");
      return data || [];
    },
  });

  // Fetch all employees for display purposes
  const { data: allEmployees = [] } = useQuery({
    queryKey: ["all-employees-for-tasks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      return (data || []) as { id: string; first_name: string; last_name: string }[];
    },
  });

  // Fetch team memberships separately
  const { data: teamMemberships = [] } = useQuery({
    queryKey: ["team-memberships-for-coaching"],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("employee_id, team_id");
      return (data || []) as { employee_id: string; team_id: string }[];
    },
  });

  // Fetch all teams - explicit any to avoid TS2589 recursive type issue
  const teamsQuery = useQuery<{ id: string; name: string }[]>({
    queryKey: ["teams-for-quick-coaching"],
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const client = supabase as any;
      const { data } = await client
        .from("teams")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
  });
  const teams = teamsQuery.data || [];

  // State for quick coaching dropdowns
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Filter employees by selected team
  const employeesInSelectedTeam = useMemo(() => {
    if (!selectedTeamId) return [];
    const employeeIdsInTeam = teamMemberships
      .filter(tm => tm.team_id === selectedTeamId)
      .map(tm => tm.employee_id);
    return allEmployees.filter(emp => employeeIdsInTeam.includes(emp.id));
  }, [allEmployees, teamMemberships, selectedTeamId]);

  // Handle opening modal for task completion
  const handleOpenTaskModal = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setSelectedTaskId(taskId);
      setSelectedEmployeeForCoaching(task.employee_id);
      setShowCoachingModal(true);
    }
  };

  // Handle coaching modal success - mark task as done
  const handleCoachingSuccess = async () => {
    if (selectedTaskId) {
      await updateTask.mutateAsync({
        id: selectedTaskId,
        updates: { 
          status: "done", 
          completed_at: new Date().toISOString(),
        },
      });
      setSelectedTaskId(null);
    }
    setSelectedEmployeeForCoaching(null);
  };

  const getEmployeeName = (employeeId: string) => {
    const emp = allEmployees.find(e => e.id === employeeId);
    return emp ? `${emp.first_name} ${emp.last_name}` : "Ukendt";
  };

  // Stats
  const openTasks = tasks.filter(t => t.status === "open").length;
  const overdueTasks = tasks.filter(t => t.status === "overdue").length;
  const todaysTasks = tasks.filter(t => {
    if (!t.due_date) return false;
    const today = new Date().toISOString().split('T')[0];
    return t.due_date.startsWith(today) && t.status !== "done";
  }).length;

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Åbne Opgaver
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{openTasks}</div>
          </CardContent>
        </Card>
        <Card className={overdueTasks > 0 ? "border-destructive" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Forsinkede
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overdueTasks > 0 ? "text-destructive" : ""}`}>
              {overdueTasks}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              I dag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todaysTasks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Nye Medarbejdere
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newEmployees.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Coverage Stats */}
      {coverageStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Coaching Coverage
            </CardTitle>
            <CardDescription>Oversigt over coaching-fremskridt pr. medarbejder</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {coverageStats.map(stat => (
                <div key={stat.employee_id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stat.employee_name}</span>
                      {stat.overdue_tasks > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {stat.overdue_tasks} forsinkede
                        </Badge>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {stat.completed_tasks}/{stat.total_tasks} ({stat.completion_rate}%)
                    </span>
                  </div>
                  <Progress value={stat.completion_rate} className="h-2" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Hurtig Coaching</CardTitle>
              <CardDescription>Giv feedback via skabeloner</CardDescription>
            </div>
            <div className="flex gap-2">
              <Link to="/coaching-templates">
                <Button variant="outline" size="sm">
                  <FileText className="h-4 w-4 mr-2" />
                  Skabeloner
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Team</label>
              <Select 
                value={selectedTeamId || ""} 
                onValueChange={(val) => {
                  setSelectedTeamId(val || null);
                  setSelectedEmployeeForCoaching(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vælg team..." />
                </SelectTrigger>
                <SelectContent>
                  {teams.map(team => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Medarbejder</label>
              <Select
                value={selectedEmployeeForCoaching || ""}
                onValueChange={(val) => setSelectedEmployeeForCoaching(val || null)}
                disabled={!selectedTeamId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={selectedTeamId ? "Vælg medarbejder..." : "Vælg team først"} />
                </SelectTrigger>
                <SelectContent>
                  {employeesInSelectedTeam.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => {
                if (selectedEmployeeForCoaching) {
                  setShowCoachingModal(true);
                }
              }}
              disabled={!selectedEmployeeForCoaching}
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Start Coaching
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Coaching Tasks */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Coaching Opgaver</CardTitle>
            <CardDescription>
              Opgaver oprettes automatisk for nye medarbejdere baseret på deres ansættelsesdato
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <p className="text-muted-foreground">Indlæser opgaver...</p>
          ) : tasks.filter(t => t.status !== "done").length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Ingen ventende coaching-opgaver</p>
              <p className="text-sm text-muted-foreground mt-2">
                Opgaver oprettes automatisk når nye medarbejdere starter
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tasks
                .filter(t => t.status !== "done")
                .sort((a, b) => {
                  // Overdue first, then by due date
                  if (a.status === "overdue" && b.status !== "overdue") return -1;
                  if (a.status !== "overdue" && b.status === "overdue") return 1;
                  if (!a.due_date) return 1;
                  if (!b.due_date) return -1;
                  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
                })
                .map(task => {
                  const day = days.find(d => d.id === task.onboarding_day_id);
                  const isOverdue = task.status === "overdue" || (task.due_date && isPast(new Date(task.due_date)));
                  
                  return (
                    <div 
                      key={task.id} 
                      className={`flex items-start justify-between p-4 border rounded-lg ${
                        isOverdue ? "border-destructive bg-destructive/5" : ""
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{getEmployeeName(task.employee_id)}</span>
                          <Badge variant={isOverdue ? "destructive" : "outline"}>
                            {isOverdue ? "Forsinket" : "Åben"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Dag {day?.day} - {day?.focus_title}
                        </p>
                        {task.due_date && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Deadline: {format(new Date(task.due_date), "d. MMM yyyy 'kl.' HH:mm", { locale: da })}
                            {" "}({formatDistanceToNow(new Date(task.due_date), { locale: da, addSuffix: true })})
                          </p>
                        )}
                      </div>
                      <Button
                        variant={isOverdue ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => handleOpenTaskModal(task.id)}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Udfyld
                      </Button>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coaching Feedback Modal - used for both quick coaching and task completion */}
      {currentEmployeeId && selectedEmployeeForCoaching && (
        <CoachingFeedbackModal
          open={showCoachingModal}
          onOpenChange={(open) => {
            setShowCoachingModal(open);
            if (!open) {
              setSelectedEmployeeForCoaching(null);
              setSelectedTaskId(null);
            }
          }}
          employeeId={selectedEmployeeForCoaching}
          coachId={currentEmployeeId}
          onSuccess={handleCoachingSuccess}
        />
      )}
    </div>
  );
}