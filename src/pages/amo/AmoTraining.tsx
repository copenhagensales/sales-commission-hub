import { useState, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Pencil, Trash2, AlertTriangle, GraduationCap, ExternalLink, Upload, Loader2 } from "lucide-react";
import { format, differenceInDays, addMonths } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const trainingTypeLabels: Record<string, string> = {
  mandatory_3day: "Obligatorisk 3-dags",
  supplementary: "Supplerende",
  internal: "Internt kursus",
  legal_update: "Lovmæssig opdatering",
};

const statusLabels: Record<string, string> = {
  pending: "Afventer",
  scheduled: "Planlagt",
  completed: "Gennemført",
  overdue: "Overskredet",
  exempted: "Fritaget",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-400",
  scheduled: "bg-blue-500/20 text-blue-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  overdue: "bg-red-500/20 text-red-400",
  exempted: "bg-muted text-muted-foreground",
};

type TrainingForm = {
  member_id: string;
  training_type: string;
  requirement_applies: boolean;
  membership_start: string;
  deadline_date: string;
  offered_date: string;
  completed_date: string;
  provider: string;
  certificate_url: string;
  status: string;
  notes: string;
};

const emptyForm: TrainingForm = {
  member_id: "", training_type: "mandatory_3day", requirement_applies: true,
  membership_start: "", deadline_date: "", offered_date: "", completed_date: "",
  provider: "", certificate_url: "", status: "pending", notes: "",
};

export default function AmoTraining() {
  const qc = useQueryClient();
  const today = new Date();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<TrainingForm>(emptyForm);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `certificates/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("amo-documents").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("amo-documents").getPublicUrl(path);
      setForm(f => ({ ...f, certificate_url: urlData.publicUrl }));
      toast.success("Certifikat uploadet");
    } catch (e: any) {
      toast.error("Upload fejlede: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  const { data: courses } = useQuery({
    queryKey: ["amo-training"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_training_courses").select("*, amo_members(full_name)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ["amo-members-active"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_members").select("id, full_name").eq("active", true).order("full_name");
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (f: TrainingForm) => {
      // Auto-calc deadline: 3 months after membership_start if mandatory
      let deadline = f.deadline_date || null;
      if (!deadline && f.membership_start && (f.training_type === "mandatory_3day" || f.training_type === "supplementary")) {
        deadline = addMonths(new Date(f.membership_start), 3).toISOString().split("T")[0];
      }

      const payload = {
        member_id: f.member_id || null,
        training_type: f.training_type as any,
        requirement_applies: f.requirement_applies,
        membership_start: f.membership_start || null,
        deadline_date: deadline,
        offered_date: f.offered_date || null,
        completed_date: f.completed_date || null,
        provider: f.provider || null,
        certificate_url: f.certificate_url || null,
        status: f.status,
        notes: f.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("amo_training_courses").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("amo_training_courses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-training"] });
      setDialog(false);
      toast.success(editing ? "Kursus opdateret" : "Kursus oprettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amo_training_courses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-training"] });
      toast.success("Kursus slettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => { setEditing(null); setForm(emptyForm); setDialog(true); };
  const openEdit = (c: any) => {
    setEditing(c);
    setForm({
      member_id: c.member_id || "", training_type: c.training_type, requirement_applies: c.requirement_applies,
      membership_start: c.membership_start?.split("T")[0] || "", deadline_date: c.deadline_date?.split("T")[0] || "",
      offered_date: c.offered_date?.split("T")[0] || "", completed_date: c.completed_date?.split("T")[0] || "",
      provider: c.provider || "", certificate_url: c.certificate_url || "", status: c.status, notes: c.notes || "",
    });
    setDialog(true);
  };

  // Auto-update membership_start → deadline
  const handleMembershipChange = (val: string) => {
    setForm(f => {
      const updated = { ...f, membership_start: val };
      if (val && !f.deadline_date && (f.training_type === "mandatory_3day" || f.training_type === "supplementary")) {
        updated.deadline_date = addMonths(new Date(val), 3).toISOString().split("T")[0];
      }
      return updated;
    });
  };

  const overdue = courses?.filter(c => c.requirement_applies && c.deadline_date && !c.completed_date && new Date(c.deadline_date) < today) || [];
  const missingCerts = courses?.filter(c => c.completed_date && !c.certificate_url) || [];
  const pending = courses?.filter(c => c.requirement_applies && !c.completed_date) || [];

  return (
    <MainLayout>
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Uddannelse og certifikater</h1>
            <p className="text-sm text-muted-foreground">Kursuskrav, deadlines og certifikatsporing</p>
          </div>
        </div>
        <Button onClick={openNew} size="sm"><Plus className="h-4 w-4 mr-1" /> Tilføj kursus</Button>
      </div>

      {overdue.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">{overdue.length} kursuskrav overskredet!</p>
            <p className="text-xs text-red-300">{overdue.map((c: any) => c.amo_members?.full_name || "Ukendt").join(", ")}</p>
          </div>
        </div>
      )}

      {missingCerts.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
          <p className="text-sm text-yellow-200">{missingCerts.length} gennemførte kurser mangler certifikat-upload</p>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-foreground">{courses?.length || 0}</div>
          <div className="text-xs text-muted-foreground">Kurser i alt</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{courses?.filter(c => c.completed_date).length || 0}</div>
          <div className="text-xs text-muted-foreground">Gennemførte</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400">{pending.length}</div>
          <div className="text-xs text-muted-foreground">Afventer</div>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{overdue.length}</div>
          <div className="text-xs text-muted-foreground">Overskredne</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medlem</TableHead>
                <TableHead>Kursustype</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Gennemført</TableHead>
                <TableHead>Certifikat</TableHead>
                <TableHead>Udbyder</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses?.map((c: any) => {
                const isOverdue = c.requirement_applies && c.deadline_date && !c.completed_date && new Date(c.deadline_date) < today;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.amo_members?.full_name || "–"}</TableCell>
                    <TableCell className="text-xs">{trainingTypeLabels[c.training_type] || c.training_type}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs", statusColors[c.status] || "")}>
                        {statusLabels[c.status] || c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.deadline_date ? (
                        <span className={cn(isOverdue ? "text-red-400 font-medium" : "text-muted-foreground")}>
                          {format(new Date(c.deadline_date), "d. MMM yyyy", { locale: da })}
                        </span>
                      ) : "–"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.completed_date ? format(new Date(c.completed_date), "d. MMM yyyy", { locale: da }) : "–"}
                    </TableCell>
                    <TableCell>
                      {c.certificate_url ? (
                        <a href={c.certificate_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline text-xs flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Vis
                        </a>
                      ) : c.completed_date ? (
                        <span className="text-xs text-yellow-400">Mangler</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.provider || "–"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => { if (confirm("Slet dette kursus?")) del.mutate(c.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!courses || courses.length === 0) && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Ingen kurser registreret</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Rediger kursus" : "Nyt kursuskrav"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Medlem</Label>
              <Select value={form.member_id} onValueChange={v => setForm(f => ({ ...f, member_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Vælg medlem" /></SelectTrigger>
                <SelectContent>
                  {members?.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Kursustype *</Label>
              <Select value={form.training_type} onValueChange={v => setForm(f => ({ ...f, training_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mandatory_3day">Obligatorisk 3-dags</SelectItem>
                  <SelectItem value="supplementary">Supplerende</SelectItem>
                  <SelectItem value="internal">Internt kursus</SelectItem>
                  <SelectItem value="legal_update">Lovmæssig opdatering</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.requirement_applies} onCheckedChange={v => setForm(f => ({ ...f, requirement_applies: v }))} />
              <Label>Krav gælder</Label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Medlemskab start</Label>
                <Input type="date" value={form.membership_start} onChange={e => handleMembershipChange(e.target.value)} />
              </div>
              <div>
                <Label>Deadline</Label>
                <Input type="date" value={form.deadline_date} onChange={e => setForm(f => ({ ...f, deadline_date: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Tilbudt dato</Label><Input type="date" value={form.offered_date} onChange={e => setForm(f => ({ ...f, offered_date: e.target.value }))} /></div>
              <div><Label>Gennemført dato</Label><Input type="date" value={form.completed_date} onChange={e => setForm(f => ({ ...f, completed_date: e.target.value }))} /></div>
            </div>
            <div><Label>Udbyder</Label><Input value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))} /></div>
            <div>
              <Label>Certifikat</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={form.certificate_url}
                    onChange={e => setForm(f => ({ ...f, certificate_url: e.target.value }))}
                    placeholder="URL eller upload fil"
                    className="flex-1"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  </Button>
                </div>
                {form.certificate_url && (
                  <a href={form.certificate_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Se vedhæftet certifikat
                  </a>
                )}
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Afventer</SelectItem>
                  <SelectItem value="scheduled">Planlagt</SelectItem>
                  <SelectItem value="completed">Gennemført</SelectItem>
                  <SelectItem value="overdue">Overskredet</SelectItem>
                  <SelectItem value="exempted">Fritaget</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Noter</Label><Textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Annuller</Button>
            <Button onClick={() => save.mutate(form)} disabled={save.isPending}>
              {save.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
}
