import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOnboardingDays, useOnboardingDrills, useCoachingTasks, useCreateCoachingTask, useUpdateCoachingTask } from "@/hooks/useOnboarding";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Users, ClipboardList, BookOpen, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function LeaderOnboardingView() {
  const { data: days = [] } = useOnboardingDays();
  const { data: drills = [] } = useOnboardingDrills();
  const { data: tasks = [], isLoading: tasksLoading } = useCoachingTasks({ status: "open" });
  const createTask = useCreateCoachingTask();
  const updateTask = useUpdateCoachingTask();
  
  const [selectedEmployee, setSelectedEmployee] = useState<string>("");
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [showNewTask, setShowNewTask] = useState(false);

  // Fetch active employees
  const { data: employees = [] } = useQuery({
    queryKey: ["active-employees-for-onboarding"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, job_title")
        .eq("is_active", true)
        .order("first_name");
      return data || [];
    },
  });

  const [taskForm, setTaskForm] = useState({
    call_id: "",
    score: "",
    strength: "",
    improvement: "",
    suggested_phrase: "",
    assigned_drill_id: "",
  });

  const handleCreateTask = async () => {
    if (!selectedEmployee || !selectedDay) return;
    
    await createTask.mutateAsync({
      employee_id: selectedEmployee,
      leader_id: null,
      onboarding_day_id: selectedDay,
      call_id: taskForm.call_id || null,
      call_timestamp: null,
      score: taskForm.score ? parseInt(taskForm.score) : null,
      strength: taskForm.strength || null,
      improvement: taskForm.improvement || null,
      suggested_phrase: taskForm.suggested_phrase || null,
      assigned_drill_id: taskForm.assigned_drill_id || null,
      status: "open",
      due_date: null,
      completed_at: null,
    });
    
    setShowNewTask(false);
    setTaskForm({ call_id: "", score: "", strength: "", improvement: "", suggested_phrase: "", assigned_drill_id: "" });
  };

  const handleCompleteTask = async (taskId: string) => {
    await updateTask.mutateAsync({
      id: taskId,
      updates: { status: "done", completed_at: new Date().toISOString() },
    });
  };

  // Get current day for selected employee
  const selectedDayData = days.find(d => d.id === selectedDay);

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              Åbne Opgaver
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasks.filter(t => t.status === "open").length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Aktive Medarbejdere
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Onboarding Dage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{days.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Leader Course for Today */}
      {selectedDayData?.leader_course_title && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Dagens Lederkursus
            </CardTitle>
            <CardDescription>
              Dag {selectedDayData.day} - {selectedDayData.focus_title}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium">{selectedDayData.leader_course_title}</h4>
                <p className="text-sm text-muted-foreground">
                  {selectedDayData.leader_course_duration_min} minutter
                  {selectedDayData.leader_course_ppt_id && ` · PPT: ${selectedDayData.leader_course_ppt_id}`}
                </p>
              </div>
              <div className="bg-muted p-4 rounded-lg">
                <h5 className="font-medium mb-2">Slide-struktur</h5>
                <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>Dagens fokus</li>
                  <li>Hvorfor det er vigtigt</li>
                  <li>Sådan gør du det rigtigt (2-3 slides)</li>
                  <li>Typiske rookie-fejl</li>
                  <li>Øvelse</li>
                  <li>Dagens call-mission</li>
                  <li>Coaching: hvad lytter jeg efter i dag?</li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coaching Tasks */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Coaching Opgaver</CardTitle>
              <CardDescription>Opret og håndter coaching-feedback til medarbejdere</CardDescription>
            </div>
            <Dialog open={showNewTask} onOpenChange={setShowNewTask}>
              <DialogTrigger asChild>
                <Button>Ny Opgave</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Opret Coaching Opgave</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Medarbejder</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg medarbejder" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map(emp => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Onboarding Dag</Label>
                    <Select value={selectedDay} onValueChange={setSelectedDay}>
                      <SelectTrigger>
                        <SelectValue placeholder="Vælg dag" />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map(day => (
                          <SelectItem key={day.id} value={day.id}>
                            Dag {day.day} - {day.focus_title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Call ID / Tidspunkt</Label>
                    <Input
                      value={taskForm.call_id}
                      onChange={e => setTaskForm(f => ({ ...f, call_id: e.target.value }))}
                      placeholder="F.eks. opkald kl. 10:15"
                    />
                  </div>
                  <div>
                    <Label>Score (0-2)</Label>
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
                    <Label>1 Styrke</Label>
                    <Textarea
                      value={taskForm.strength}
                      onChange={e => setTaskForm(f => ({ ...f, strength: e.target.value }))}
                      placeholder="Hvad gjorde medarbejderen godt?"
                    />
                  </div>
                  <div>
                    <Label>1 Forbedring</Label>
                    <Textarea
                      value={taskForm.improvement}
                      onChange={e => setTaskForm(f => ({ ...f, improvement: e.target.value }))}
                      placeholder="Hvad kan forbedres?"
                    />
                  </div>
                  <div>
                    <Label>Foreslået Sætning</Label>
                    <Input
                      value={taskForm.suggested_phrase}
                      onChange={e => setTaskForm(f => ({ ...f, suggested_phrase: e.target.value }))}
                      placeholder="Sig denne sætning næste gang..."
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
                  <Button onClick={handleCreateTask} className="w-full" disabled={!selectedEmployee || !selectedDay}>
                    Opret Opgave
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {tasksLoading ? (
            <p className="text-muted-foreground">Indlæser opgaver...</p>
          ) : tasks.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">Ingen åbne coaching-opgaver</p>
          ) : (
            <div className="space-y-3">
              {tasks.map(task => {
                const employee = employees.find(e => e.id === task.employee_id);
                const day = days.find(d => d.id === task.onboarding_day_id);
                
                return (
                  <div key={task.id} className="flex items-start justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {employee ? `${employee.first_name} ${employee.last_name}` : "Ukendt"}
                        </span>
                        <Badge variant={task.status === "overdue" ? "destructive" : "outline"}>
                          {task.status === "open" ? "Åben" : task.status === "overdue" ? "Forsinket" : "Færdig"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Dag {day?.day} - {day?.focus_title}
                      </p>
                      {task.strength && (
                        <p className="text-sm"><strong>Styrke:</strong> {task.strength}</p>
                      )}
                      {task.improvement && (
                        <p className="text-sm"><strong>Forbedring:</strong> {task.improvement}</p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCompleteTask(task.id)}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Færdig
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
