import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isPast, isToday, addDays } from "date-fns";
import { da } from "date-fns/locale";
import {
  ListTodo, Plus, Search, Filter, AlertTriangle, CheckCircle2,
  Clock, Flag, Trash2, Edit, Download
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["amo_tasks"]["Row"];
type TaskInsert = Database["public"]["Tables"]["amo_tasks"]["Insert"];
type TaskPriority = Database["public"]["Enums"]["amo_task_priority"];
type TaskStatus = Database["public"]["Enums"]["amo_task_status"];
type Member = Database["public"]["Tables"]["amo_members"]["Row"];

const priorityConfig: Record<TaskPriority, { label: string; color: string; icon: typeof Flag }> = {
  low: { label: "Lav", color: "bg-muted text-muted-foreground", icon: Flag },
  medium: { label: "Medium", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Flag },
  high: { label: "Høj", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: AlertTriangle },
  critical: { label: "Kritisk", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
};

const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
  open: { label: "Åben", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  in_progress: { label: "I gang", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  done: { label: "Udført", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  overdue: { label: "Overskredet", color: "bg-destructive/10 text-destructive" },
};

const moduleLabels: Record<string, string> = {
  organisation: "Organisation",
  meetings: "Møder",
  annual_discussion: "Årlig drøftelse",
  apv: "APV",
  kemi_apv: "Kemi-APV",
  training: "Uddannelse",
  documents: "Dokumenter",
  general: "Generelt",
};

const emptyForm: Partial<TaskInsert> = {
  title: "",
  description: "",
  priority: "medium",
  status: "open",
  related_module: "general",
  due_date: "",
  evidence_required: false,
};

export default function AmoTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterModule, setFilterModule] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState<Partial<TaskInsert>>(emptyForm);

  const fetchData = async () => {
    setLoading(true);
    const [tasksRes, membersRes] = await Promise.all([
      supabase.from("amo_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("amo_members").select("*").eq("active", true),
    ]);
    if (tasksRes.data) setTasks(tasksRes.data);
    if (membersRes.data) setMembers(membersRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Auto-mark overdue
  useEffect(() => {
    tasks.forEach(async (t) => {
      if (t.status === "open" && t.due_date && isPast(new Date(t.due_date)) && !isToday(new Date(t.due_date))) {
        await supabase.from("amo_tasks").update({ status: "overdue" as TaskStatus }).eq("id", t.id);
      }
    });
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterModule !== "all" && t.related_module !== filterModule) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterStatus, filterPriority, filterModule, search]);

  const stats = useMemo(() => ({
    total: tasks.length,
    open: tasks.filter((t) => t.status === "open").length,
    overdue: tasks.filter((t) => t.status === "overdue").length,
    done: tasks.filter((t) => t.status === "done").length,
    critical: tasks.filter((t) => t.priority === "critical" && t.status !== "done").length,
  }), [tasks]);

  const openCreate = () => {
    setEditingTask(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditingTask(task);
    setForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      status: task.status,
      related_module: task.related_module || "general",
      due_date: task.due_date || "",
      owner_id: task.owner_id || undefined,
      evidence_required: task.evidence_required,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title?.trim()) { toast.error("Titel er påkrævet"); return; }
    if (editingTask) {
      const { error } = await supabase.from("amo_tasks").update({
        title: form.title!,
        description: form.description || null,
        priority: form.priority as TaskPriority,
        status: form.status as TaskStatus,
        related_module: form.related_module || null,
        due_date: form.due_date || null,
        owner_id: form.owner_id || null,
        evidence_required: form.evidence_required || false,
      }).eq("id", editingTask.id);
      if (error) { toast.error("Fejl ved opdatering"); return; }
      toast.success("Opgave opdateret");
    } else {
      const { error } = await supabase.from("amo_tasks").insert({
        title: form.title!,
        description: form.description || null,
        priority: (form.priority || "medium") as TaskPriority,
        status: (form.status || "open") as TaskStatus,
        related_module: form.related_module || null,
        due_date: form.due_date || null,
        owner_id: form.owner_id || null,
        evidence_required: form.evidence_required || false,
      });
      if (error) { toast.error("Fejl ved oprettelse"); return; }
      toast.success("Opgave oprettet");
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("amo_tasks").delete().eq("id", id);
    if (error) { toast.error("Fejl ved sletning"); return; }
    toast.success("Opgave slettet");
    fetchData();
  };

  const handleQuickStatus = async (id: string, status: TaskStatus) => {
    await supabase.from("amo_tasks").update({ status }).eq("id", id);
    fetchData();
  };

  const exportCsv = () => {
    const header = "Titel;Status;Prioritet;Modul;Frist;Ansvarlig;Beskrivelse\n";
    const rows = filtered.map((t) => {
      const owner = members.find((m) => m.id === t.owner_id);
      return [
        t.title,
        statusConfig[t.status]?.label || t.status,
        priorityConfig[t.priority]?.label || t.priority,
        moduleLabels[t.related_module || ""] || t.related_module || "",
        t.due_date ? format(new Date(t.due_date), "dd/MM/yyyy") : "",
        owner?.full_name || "",
        (t.description || "").replace(/;/g, ","),
      ].join(";");
    }).join("\n");
    const blob = new Blob(["\uFEFF" + header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amo-opgaver-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV eksporteret");
  };

  return (
    <MainLayout>
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" />
            AMO Opgavemotor
          </h1>
          <p className="text-muted-foreground text-sm">Administrer compliance-opgaver på tværs af AMO-moduler</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-1" /> Eksportér CSV
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Ny opgave
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: ListTodo, color: "text-primary" },
          { label: "Åbne", value: stats.open, icon: Clock, color: "text-blue-600" },
          { label: "Overskredne", value: stats.overdue, icon: AlertTriangle, color: "text-destructive" },
          { label: "Udførte", value: stats.done, icon: CheckCircle2, color: "text-green-600" },
          { label: "Kritiske", value: stats.critical, icon: Flag, color: "text-orange-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs">Søg</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Søg opgaver..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {Object.entries(statusConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioritet</Label>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {Object.entries(priorityConfig).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Modul</Label>
              <Select value={filterModule} onValueChange={setFilterModule}>
                <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle</SelectItem>
                  {Object.entries(moduleLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Task Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioritet</TableHead>
                <TableHead>Modul</TableHead>
                <TableHead>Frist</TableHead>
                <TableHead>Ansvarlig</TableHead>
                <TableHead className="text-right">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Indlæser...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Ingen opgaver fundet</TableCell></TableRow>
              ) : (
                filtered.map((task) => {
                  const owner = members.find((m) => m.id === task.owner_id);
                  const isOverdue = task.due_date && isPast(new Date(task.due_date)) && task.status !== "done";
                  return (
                    <TableRow key={task.id} className={isOverdue ? "bg-destructive/5" : ""}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{task.title}</p>
                          {task.description && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{task.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${statusConfig[task.status]?.color || ""}`}>
                          {statusConfig[task.status]?.label || task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${priorityConfig[task.priority]?.color || ""}`}>
                          {priorityConfig[task.priority]?.label || task.priority}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{moduleLabels[task.related_module || ""] || task.related_module}</TableCell>
                      <TableCell className="text-xs">
                        {task.due_date ? (
                          <span className={isOverdue ? "text-destructive font-medium" : ""}>
                            {format(new Date(task.due_date), "dd/MM/yyyy")}
                          </span>
                        ) : "–"}
                      </TableCell>
                      <TableCell className="text-xs">{owner?.full_name || "–"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {task.status !== "done" && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleQuickStatus(task.id, "done")}>
                              <CheckCircle2 className="h-3 w-3" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(task)}>
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleDelete(task.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Rediger opgave" : "Ny opgave"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titel *</Label>
              <Input value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Beskrivelse</Label>
              <Textarea value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioritet</Label>
                <Select value={form.priority || "medium"} onValueChange={(v) => setForm({ ...form, priority: v as TaskPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status || "open"} onValueChange={(v) => setForm({ ...form, status: v as TaskStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Modul</Label>
                <Select value={form.related_module || "general"} onValueChange={(v) => setForm({ ...form, related_module: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(moduleLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frist</Label>
                <Input type="date" value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Ansvarlig</Label>
              <Select value={form.owner_id || "none"} onValueChange={(v) => setForm({ ...form, owner_id: v === "none" ? undefined : v })}>
                <SelectTrigger><SelectValue placeholder="Vælg ansvarlig" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSave}>
              {editingTask ? "Gem ændringer" : "Opret opgave"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
}
