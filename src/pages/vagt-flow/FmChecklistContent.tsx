import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

import { Switch } from "@/components/ui/switch";
import { TimeSelect } from "@/components/ui/time-select";
import { ChevronLeft, ChevronRight, Plus, Trash2, CheckCircle2, MessageSquare, Flame, Settings, Mail, Send, X, Loader2 } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  useFmChecklistTemplates,
  useFmChecklistCompletions,
  useToggleChecklistCompletion,
  useUpdateCompletionNote,
  useAddChecklistTemplate,
  useDeactivateChecklistTemplate,
  useFmChecklistEmailConfig,
  useUpdateEmailConfig,
  useFmChecklistEmailRecipients,
  useAddEmailRecipient,
  useRemoveEmailRecipient,
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

function EmailSummaryConfig() {
  const { data: config, isLoading: configLoading } = useFmChecklistEmailConfig();
  const { data: recipients = [] } = useFmChecklistEmailRecipients();
  const updateConfig = useUpdateEmailConfig();
  const addRecipient = useAddEmailRecipient();
  const removeRecipient = useRemoveEmailRecipient();
  const [newEmail, setNewEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleAddRecipient = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;
    if (recipients.some((r) => r.email === trimmed)) {
      toast.error("Email er allerede tilføjet");
      return;
    }
    addRecipient.mutate(trimmed);
    setNewEmail("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddRecipient();
    }
  };

  const handleSendNow = async () => {
    setIsSending(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const url = `https://${projectId}.supabase.co/functions/v1/send-checklist-daily-summary?force=true`;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });
      const result = await response.json();
      if (response.ok) {
        toast.success(`Email sendt til ${result.recipients} modtager(e)`);
      } else {
        toast.error(result.error || "Kunne ikke sende email");
      }
    } catch (err: any) {
      toast.error("Fejl: " + err.message);
    } finally {
      setIsSending(false);
    }
  };

  if (configLoading) return null;

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-xs font-medium">Daglig email-opsummering</h4>
      </div>

      {/* Active toggle */}
      <div className="flex items-center justify-between">
        <label className="text-xs text-muted-foreground">Aktiv</label>
        <Switch
          checked={config?.is_active ?? false}
          onCheckedChange={(checked) => updateConfig.mutate({ is_active: checked })}
        />
      </div>

      {/* Send time */}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Afsendelsestidspunkt</label>
        <TimeSelect
          value={config?.send_time ?? "20:00"}
          onChange={(time) => updateConfig.mutate({ send_time: time })}
        />
      </div>

      {/* Recipients */}
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">Modtagere</label>
        <div className="flex flex-wrap gap-1">
          {recipients.map((r) => (
            <Badge key={r.id} variant="secondary" className="gap-1 text-xs">
              {r.email}
              <button
                onClick={() => removeRecipient.mutate(r.id)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Input
            type="email"
            placeholder="Indtast email-adresse..."
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 text-xs flex-1"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={handleAddRecipient}
            disabled={!newEmail.trim() || !newEmail.includes("@")}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Send now button */}
      <Button
        size="sm"
        variant="outline"
        className="w-full h-8 text-xs"
        onClick={handleSendNow}
        disabled={isSending || recipients.length === 0}
      >
        {isSending ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5 mr-1" />
        )}
        Send opsummering nu
      </Button>
    </div>
  );
}

export default function FmChecklistContent() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newWeekdays, setNewWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [notePopover, setNotePopover] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [quickAddDay, setQuickAddDay] = useState<number | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState("");

  const employeeId = useEmployeeId();

  const today = new Date();
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  const weekStart = addDays(currentWeekStart, weekOffset * 7);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");

  const { data: templates = [], isLoading: templatesLoading } = useFmChecklistTemplates(weekStartStr, weekEndStr);
  const { data: completions = [], isLoading: completionsLoading } = useFmChecklistCompletions(weekStartStr, weekEndStr);
  const toggleCompletion = useToggleChecklistCompletion();
  const updateNote = useUpdateCompletionNote();
  const addTemplate = useAddChecklistTemplate();
  const deactivateTemplate = useDeactivateChecklistTemplate();

  const getTasksForDay = (dayIndex: number, dateStr: string) =>
    templates.filter((t) => {
      if (t.one_time_date) return t.one_time_date === dateStr;
      return t.weekdays.includes(dayIndex);
    });

  const getCompletion = (templateId: string, date: string): FmChecklistCompletion | undefined =>
    completions.find((c) => c.template_id === templateId && c.completed_date === date);

  const getDayProgress = (dayIndex: number, date: string) => {
    const tasks = getTasksForDay(dayIndex, date);
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
      const tasks = templates.filter((t) => {
        if (t.one_time_date) return t.one_time_date === dateStr;
        return t.weekdays.includes(dayIndex);
      });
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
    <div className="flex flex-col h-[calc(100vh-12rem)]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((o) => o - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <h2 className="text-sm font-semibold">{weekLabel}</h2>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setWeekOffset((o) => o + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          {weekOffset !== 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWeekOffset(0)}>
              I dag
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {streak > 0 && (
            <Badge variant="secondary" className="gap-1 text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400">
              <Flame className="h-3 w-3" />
              {streak} dage i træk
            </Badge>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowAdmin(!showAdmin)}>
            <Settings className="h-3.5 w-3.5 mr-1" />
            Administrer
          </Button>
        </div>
      </div>

      {/* Week grid - fills remaining space */}
      <div className="grid grid-cols-7 gap-1.5 flex-1 min-h-0">
        {weekDates.map((date, dayIdx) => {
          const dateStr = format(date, "yyyy-MM-dd");
          const tasks = getTasksForDay(dayIdx);
          const progress = getDayProgress(dayIdx, dateStr);
          const isToday = isSameDay(date, today);

          return (
            <div
              key={dayIdx}
              className={cn(
                "rounded-lg border flex flex-col overflow-hidden",
                isToday && "ring-2 ring-primary/50",
                progress.pct === 100 && progress.total > 0 && "bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              )}
            >
              {/* Day header */}
              <div className="px-2 py-1.5 border-b bg-muted/30 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{DAY_NAMES[dayIdx]}</span>
                  <span className="text-[10px] text-muted-foreground">{format(date, "d/M")}</span>
                </div>
                {tasks.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <Progress value={progress.pct} className="h-1 flex-1" />
                    <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                      {progress.done}/{progress.total}
                    </span>
                  </div>
                )}
              </div>

              {/* Tasks */}
              <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5">
                {tasks.length === 0 && (
                  <p className="text-[10px] text-muted-foreground italic p-1">Ingen opgaver</p>
                )}
                {tasks.map((task) => {
                  const completion = getCompletion(task.id, dateStr);
                  const isChecked = !!completion;
                  const taskKey = `${task.id}-${dateStr}`;

                  return (
                    <div
                      key={task.id}
                      className={cn(
                        "flex items-start gap-1 p-1 rounded transition-colors",
                        isChecked
                          ? "bg-green-100/60 dark:bg-green-900/20"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() => handleToggle(task.id, dateStr)}
                        className="mt-0.5 shrink-0 h-3.5 w-3.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-[10px] leading-tight",
                            isChecked && "line-through text-muted-foreground"
                          )}
                        >
                          {task.title}
                        </p>
                        {completion?.note && (
                          <p className="text-[9px] text-muted-foreground mt-0.5 italic truncate">
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
                            <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0">
                              <MessageSquare className="h-2.5 w-2.5" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="end">
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium">Tilføj note</p>
                              <Textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Skriv en note..."
                                className="text-xs min-h-[50px]"
                              />
                              <Button
                                size="sm"
                                className="w-full h-7 text-xs"
                                onClick={() => handleSaveNote(completion.id)}
                              >
                                Gem
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  );
                })}
                {progress.pct === 100 && progress.total > 0 && (
                  <div className="flex items-center justify-center py-0.5">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Admin section */}
      {showAdmin && (
        <Card className="mt-2 shrink-0">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm">Administrer opgaver</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-4 pb-3">
            <div className="border rounded-lg p-3 space-y-2">
              <h4 className="text-xs font-medium">Tilføj ny opgave</h4>
              <Input
                placeholder="Opgavetitel"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="h-8 text-sm"
              />
              <Textarea
                placeholder="Beskrivelse (valgfri)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="min-h-[50px] text-sm"
              />
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Vælg dage:</p>
                <div className="flex gap-1">
                  {DAY_NAMES.map((name, idx) => (
                    <Button
                      key={idx}
                      size="sm"
                      variant={newWeekdays.includes(idx) ? "default" : "outline"}
                      className="h-6 w-9 text-[10px]"
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
              <Button size="sm" className="h-7 text-xs" onClick={handleAddTask} disabled={!newTitle.trim() || newWeekdays.length === 0}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tilføj
              </Button>
            </div>

            <div className="space-y-1.5">
              <h4 className="text-xs font-medium">Eksisterende opgaver</h4>
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between p-2 border rounded-lg">
                  <div>
                    <p className="text-xs font-medium">{t.title}</p>
                    <div className="flex gap-0.5 mt-0.5">
                      {DAY_NAMES.map((name, idx) => (
                        <Badge
                          key={idx}
                          variant={t.weekdays.includes(idx) ? "default" : "outline"}
                          className="text-[9px] px-1 py-0 h-4"
                        >
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => deactivateTemplate.mutate(t.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Email summary config */}
            <EmailSummaryConfig />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
