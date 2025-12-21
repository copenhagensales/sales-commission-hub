import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOnboardingDays, useOnboardingDrills, useCoachingTasks, useUpdateCoachingTask, useCoachingCoverageStats } from "@/hooks/useOnboarding";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ClipboardList, BookOpen, CheckCircle2, AlertTriangle, BarChart3, Calendar } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { da } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export default function LeaderOnboardingView() {
  const { data: days = [] } = useOnboardingDays();
  const { data: drills = [] } = useOnboardingDrills();
  const { data: tasks = [], isLoading: tasksLoading } = useCoachingTasks({});
  const { data: coverageStats = [] } = useCoachingCoverageStats();
  const updateTask = useUpdateCoachingTask();
  
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

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
        .eq("is_active", true);
      return data || [];
    },
  });

  const [taskForm, setTaskForm] = useState({
    score: "",
    strength: "",
    improvement: "",
    suggested_phrase: "",
    assigned_drill_id: "",
  });

  const handleOpenCompleteDialog = (taskId: string) => {
    setSelectedTask(taskId);
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      setTaskForm({
        score: task.score?.toString() || "",
        strength: task.strength || "",
        improvement: task.improvement || "",
        suggested_phrase: task.suggested_phrase || "",
        assigned_drill_id: task.assigned_drill_id || "",
      });
    }
    setShowCompleteDialog(true);
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    
    // Validate required fields
    if (!taskForm.score || !taskForm.strength || !taskForm.improvement) {
      toast.error("Udfyld venligst score, styrke og forbedring");
      return;
    }
    
    await updateTask.mutateAsync({
      id: selectedTask,
      updates: { 
        status: "done", 
        completed_at: new Date().toISOString(),
        score: parseInt(taskForm.score),
        strength: taskForm.strength,
        improvement: taskForm.improvement,
        suggested_phrase: taskForm.suggested_phrase || null,
        assigned_drill_id: taskForm.assigned_drill_id || null,
      },
    });
    
    setShowCompleteDialog(false);
    setSelectedTask(null);
    setTaskForm({ score: "", strength: "", improvement: "", suggested_phrase: "", assigned_drill_id: "" });
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
                        onClick={() => handleOpenCompleteDialog(task.id)}
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

      {/* Complete Task Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Udfyld Coaching Feedback</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Score (0-2) *</Label>
              <Select value={taskForm.score} onValueChange={v => setTaskForm(f => ({ ...f, score: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0 - Skal forbedres</SelectItem>
                  <SelectItem value="1">1 - Acceptabelt</SelectItem>
                  <SelectItem value="2">2 - Godt</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>1 Styrke *</Label>
              <Textarea
                value={taskForm.strength}
                onChange={e => setTaskForm(f => ({ ...f, strength: e.target.value }))}
                placeholder="Hvad gjorde medarbejderen godt?"
              />
            </div>
            <div>
              <Label>1 Forbedring *</Label>
              <Textarea
                value={taskForm.improvement}
                onChange={e => setTaskForm(f => ({ ...f, improvement: e.target.value }))}
                placeholder="Hvad kan forbedres?"
              />
            </div>
            <div>
              <Label>"Sig denne sætning næste gang"</Label>
              <Input
                value={taskForm.suggested_phrase}
                onChange={e => setTaskForm(f => ({ ...f, suggested_phrase: e.target.value }))}
                placeholder="Forslag til konkret sætning..."
              />
            </div>
            <div>
              <Label>Tildel Drill</Label>
              <Select value={taskForm.assigned_drill_id} onValueChange={v => setTaskForm(f => ({ ...f, assigned_drill_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Vælg drill (valgfrit)" />
                </SelectTrigger>
                <SelectContent>
                  {drills.map(drill => (
                    <SelectItem key={drill.id} value={drill.id}>
                      {drill.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Annuller
            </Button>
            <Button onClick={handleCompleteTask} disabled={!taskForm.score || !taskForm.strength || !taskForm.improvement}>
              Gem & Marker Færdig
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}