import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, MessageSquare, Flame, Settings } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import {
  useFmChecklistTemplates,
  useFmChecklistCompletions,
  useToggleChecklistCompletion,
  useUpdateCompletionNote,
  useAddChecklistTemplate,
  useDeactivateChecklistTemplate,
  type FmChecklistCompletion,
} from "@/hooks/useFmChecklist";
import { motion, AnimatePresence } from "framer-motion";

const DAY_NAMES = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function useEmployeeId() {
  const { user } = useAuth();
  const { data } = useFmChecklistTemplates(); 
  const [employeeId, setEmployeeId] = useState<string | null>(null);

  useMemo(() => {
    if (!user?.id) return;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase
        .from("employee_master_data")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setEmployeeId(data.id);
        });
    });
  }, [user?.id]);

  return employeeId;
}

export default function FmChecklistContent() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newWeekdays, setNewWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [notePopover, setNotePopover] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const employeeId = useEmployeeId();

  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekStart = addDays(currentWeekStart, weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: templates = [], isLoading: templatesLoading } = useFmChecklistTemplates();
  const { data: completions = [], isLoading: completionsLoading } = useFmChecklistCompletions(weekStartStr, weekEndStr);
  const toggleCompletion = useToggleChecklistCompletion();
  const updateNote = useUpdateCompletionNote();
  const addTemplate = useAddChecklistTemplate();
  const deactivateTemplate = useDeactivateChecklistTemplate();

  const getTasksForDay = (dayIndex: number) =>
    templates.filter((t) => t.weekdays.includes(dayIndex));

  const getCompletion = (templateId: string, date: string): FmChecklistCompletion | undefined =>
    completions.find((c) => c.template_id === templateId && c.completed_date === date);

  const getDayProgress = (dayIndex: number, date: string) => {
    const tasks = getTasksForDay(dayIndex);
    if (tasks.length === 0) return { done: 0, total: 0, pct: 0 };
    const done = tasks.filter((t) => getCompletion(t.id, date)).length;
    return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) };
  };

  const streak = useMemo(() => {
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const d = addDays(today, -i);
      const dayIndex = (d.getDay() + 6) % 7; 
      const dateStr = format(d, "yyyy-MM-dd");
      const tasks = templates.filter((t) => t.weekdays.includes(dayIndex));
      if (tasks.length === 0) continue;
      const allDone = tasks.every((t) => completions.some((c) => c.template_id === t.id && c.completed_date === dateStr));
      if (allDone) count++;
      else break;
    }
    return count;
  }, [templates, completions, today]);

  const handleToggle = (templateId: string, date: string) => {
    if (!employeeId) return;
    const existing = getCompletion(templateId, date);
    toggleCompletion.mutate({
      templateId,
      date,
      completedBy: employeeId,
      isCompleted: !!existing,
      completionId: existing?.id,
    });
  };

  const handleAddTask = () => {
    if (!newTitle.trim() || newWeekdays.length === 0) return;
    addTemplate.mutate(
      { title: newTitle.trim(), description: newDescription.trim() || undefined, weekdays: newWeekdays },
      {
        onSuccess: () => {
          setNewTitle("");
          setNewDescription("");
          setNewWeekdays([0, 1, 2, 3, 4, 5, 6]);
        },
      }
    );
  };

  const handleSaveNote = (completionId: string) => {
    updateNote.mutate({ completionId, note: noteText });
    setNotePopover(null);
    setNoteText("");
  };

  const weekLabel = `Uge ${format(weekStart, "w", { locale: da })} — ${format(weekStart, "d. MMM", { locale: da })} – ${format(addDays(weekStart, 6), "d. MMM yyyy", { locale: da })}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">{weekLabel}</h2>
          <Button variant="outline" size="icon" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" onClick={() => setWeekOffset(0)}>
              I dag
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <Badge variant="secondary" className="gap-1 text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400">
              <Flame className="h-3.5 w-3.5" />
              {streak} dage i træk
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowAdmin(!showAdmin)}>
            <Settings className="h-4 w-4 mr-1" />
            Administrer
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, dayIdx) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const tasks = getTasksForDay(dayIdx);
          const progress = getDayProgress(dayIdx, dateStr);
          const isToday = isSameDay(date, today);

          return (
            <Card
              key={dayIdx}
              className={cn(
                "transition-all",
                isToday && "ring-2 ring-primary/50",
                progress.pct === 100 && progress.total > 0 && "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              )}
            >
              <CardHeader className="pb-2 pt-3 px-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    {DAY_NAMES[dayIdx]}
                  </CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {format(date, "d/M")}
                  </span>
                </div>
                {tasks.length > 0 && (
                  <div className="space-y-1">
                    <Progress value={progress.pct} className="h-1.5" />
                    <p className="text-[10px] text-muted-foreground text-right">
                      {progress.done}/{progress.total}
                    </p>
                  </div>
                )}
              </CardHeader>
              <CardContent className="px-3 pb-3 space-y-1.5">
                {tasks.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Ingen opgaver</p>
                )}
                <AnimatePresence>
                  {tasks.map((task) => {
                    const completion = getCompletion(task.id, dateStr);
                    const isChecked = !!completion;
                    const taskKey = `${task.id}-${dateStr}`;

                    return (
                      <motion.div
                        key={task.id}
                        initial={false}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "flex items-start gap-1.5 p-1.5 rounded-md transition-colors text-xs",
                          isChecked
                            ? "bg-green-100/60 dark:bg-green-900/20"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggle(task.id, dateStr)}
                          className="mt-0.5 shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-xs leading-tight",
                              isChecked && "line-through text-muted-foreground"
                            )}
                          >
                            {task.title}
                          </p>
                          {completion?.note && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 italic truncate">
                              📝 {completion.note}
                            </p>
                          )}
                        </div>
                        {isChecked && completion && (
                          <Popover
                            open={notePopover === taskKey}
                            onOpenChange={(open) => {
                              if (open) {
                                setNotePopover(taskKey);
                                setNoteText(completion.note || "");
                              } else {
                                setNotePopover(null);
                              }
                            }}
                          >
                            <PopoverTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0">
                                <MessageSquare className="h-3 w-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-3" align="end">
                              <div className="space-y-2">
                                <p className="text-xs font-medium">Tilføj note</p>
                                <Textarea
                                  value={noteText}
                                  onChange={(e) => setNoteText(e.target.value)}
                                  placeholder="Skriv en note..."
                                  className="text-xs min-h-[60px]"
                                />
                                <Button
                                  size="sm"
                                  className="w-full"
                                  onClick={() => handleSaveNote(completion.id)}
                                >
                                  Gem
                                </Button>
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {progress.pct === 100 && progress.total > 0 && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center pt-1"
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  </motion.div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {showAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Administrer opgaver</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4 space-y-3">
              <h4 className="text-sm font-medium">Tilføj ny opgave</h4>
              <Input
                placeholder="Opgavetitel"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <Textarea
                placeholder="Beskrivelse (valgfri)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="min-h-[60px]"
              />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Vælg dage:</p>
                <div className="flex gap-1">
                  {DAY_NAMES.map((name, idx) => (
                    <Button
                      key={idx}
                      size="sm"
                      variant={newWeekdays.includes(idx) ? "default" : "outline"}
                      className="h-8 w-10 text-xs"
                      onClick={() =>
                        setNewWeekdays((prev) =>
                          prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
                        )
                      }
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              </div>
              <Button onClick={handleAddTask} disabled={!newTitle.trim() || newWeekdays.length === 0}>
                <Plus className="h-4 w-4 mr-1" />
                Tilføj
              </Button>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Eksisterende opgaver</h4>
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{t.title}</p>
                    <div className="flex gap-1 mt-1">
                      {DAY_NAMES.map((name, idx) => (
                        <Badge
                          key={idx}
                          variant={t.weekdays.includes(idx) ? "default" : "outline"}
                          className="text-[10px] px-1 py-0"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deactivateTemplate.mutate(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
