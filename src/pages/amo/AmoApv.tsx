import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Pencil, Trash2, AlertTriangle, FileText, Copy } from "lucide-react";
import { format, differenceInDays, addYears } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const reasonLabels: Record<string, string> = {
  triennial: "3-års cyklus",
  change: "Ændring i arbejdsforhold",
  incident: "Hændelse/ulykke",
  request: "Anmodning fra AMR",
};

type ApvForm = {
  title: string;
  workplace_id: string;
  start_date: string;
  completed_date: string;
  reason: string;
  physical_env: string;
  psychological_env: string;
  sickness_review: string;
  findings: string;
  risk_level: string;
  action_plan: string;
  responsible_owner: string;
  deadline: string;
  follow_up_status: string;
};

const emptyForm: ApvForm = {
  title: "",
  workplace_id: "",
  start_date: "",
  completed_date: "",
  reason: "triennial",
  physical_env: "",
  psychological_env: "",
  sickness_review: "",
  findings: "",
  risk_level: "",
  action_plan: "",
  responsible_owner: "",
  deadline: "",
  follow_up_status: "",
};

export default function AmoApv() {
  const qc = useQueryClient();
  const today = new Date();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<ApvForm>(emptyForm);
  const [detailApv, setDetailApv] = useState<any>(null);

  const { data: apvRecords } = useQuery({
    queryKey: ["amo-apv"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_apv").select("*, amo_workplaces(name)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: workplaces } = useQuery({
    queryKey: ["amo-workplaces"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_workplaces").select("*").order("name");
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (f: ApvForm) => {
      const nextDue = f.completed_date
        ? addYears(new Date(f.completed_date), 3).toISOString().split("T")[0]
        : f.start_date
        ? addYears(new Date(f.start_date), 3).toISOString().split("T")[0]
        : null;

      const payload = {
        title: f.title,
        workplace_id: f.workplace_id || null,
        start_date: f.start_date || null,
        completed_date: f.completed_date || null,
        next_due_date: nextDue,
        reason: f.reason as any,
        physical_env: f.physical_env || null,
        psychological_env: f.psychological_env || null,
        sickness_review: f.sickness_review || null,
        findings: f.findings || null,
        risk_level: f.risk_level || null,
        action_plan: f.action_plan || null,
        responsible_owner: f.responsible_owner || null,
        deadline: f.deadline || null,
        follow_up_status: f.follow_up_status || null,
      };

      if (editing) {
        const { error } = await supabase.from("amo_apv").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("amo_apv").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-apv"] });
      setDialog(false);
      toast.success(editing ? "APV opdateret" : "APV oprettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amo_apv").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-apv"] });
      toast.success("APV slettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialog(true);
  };

  const openCopy = (a: any) => {
    setEditing(null);
    setForm({
      title: `${a.title} (kopi)`,
      workplace_id: a.workplace_id || "",
      start_date: "",
      completed_date: "",
      reason: a.reason || "triennial",
      physical_env: a.physical_env || "",
      psychological_env: a.psychological_env || "",
      sickness_review: a.sickness_review || "",
      findings: a.findings || "",
      risk_level: a.risk_level || "",
      action_plan: a.action_plan || "",
      responsible_owner: a.responsible_owner || "",
      deadline: "",
      follow_up_status: "",
    });
    setDialog(true);
  };

  const openEdit = (a: any) => {
    setEditing(a);
    setForm({
      title: a.title,
      workplace_id: a.workplace_id || "",
      start_date: a.start_date?.split("T")[0] || "",
      completed_date: a.completed_date?.split("T")[0] || "",
      reason: a.reason,
      physical_env: a.physical_env || "",
      psychological_env: a.psychological_env || "",
      sickness_review: a.sickness_review || "",
      findings: a.findings || "",
      risk_level: a.risk_level || "",
      action_plan: a.action_plan || "",
      responsible_owner: a.responsible_owner || "",
      deadline: a.deadline?.split("T")[0] || "",
      follow_up_status: a.follow_up_status || "",
    });
    setDialog(true);
  };

  const overdue = apvRecords?.filter(a => a.next_due_date && new Date(a.next_due_date) < today) || [];
  const upcoming = apvRecords?.filter(a => {
    if (!a.next_due_date) return false;
    const d = differenceInDays(new Date(a.next_due_date), today);
    return d >= 0 && d <= 90;
  }) || [];

  return (
    <MainLayout>
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Arbejdspladsvurdering (APV)</h1>
            <p className="text-sm text-muted-foreground">Lovpligtig vurdering med 3-års cyklus</p>
          </div>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Ny APV
        </Button>
      </div>

      {/* Overdue warning */}
      {overdue.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">{overdue.length} APV overskredet!</p>
            <p className="text-xs text-red-300">
              {overdue.map(a => a.title).join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{apvRecords?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Total APV'er</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {apvRecords?.filter(a => a.completed_date).length || 0}
            </div>
            <div className="text-xs text-muted-foreground">Gennemførte</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{upcoming.length}</div>
            <div className="text-xs text-muted-foreground">Snart forfaldne</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{overdue.length}</div>
            <div className="text-xs text-muted-foreground">Overskredne</div>
          </CardContent>
        </Card>
      </div>

      {/* APV list */}
      <div className="space-y-4">
        {apvRecords?.map((a: any) => {
          const due = a.next_due_date ? new Date(a.next_due_date) : null;
          const daysLeft = due ? differenceInDays(due, today) : null;
          const status = daysLeft !== null && daysLeft < 0 ? "red" : daysLeft !== null && daysLeft <= 90 ? "yellow" : "green";

          return (
            <Card key={a.id} className="cursor-pointer hover:border-muted-foreground/30 transition-colors" onClick={() => setDetailApv(a)}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{a.title}</CardTitle>
                    <Badge variant="outline" className="text-xs">{reasonLabels[a.reason] || a.reason}</Badge>
                  </div>
                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <span className={cn(
                      "h-3 w-3 rounded-full",
                      status === "green" ? "bg-emerald-500" : status === "yellow" ? "bg-yellow-500" : "bg-red-500"
                    )} />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openCopy(a)} title="Kopiér som ny APV">
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      if (confirm("Slet denne APV?")) del.mutate(a.id);
                    }}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex gap-4 text-xs text-muted-foreground">
                  {a.amo_workplaces?.name && <span>Arbejdsplads: {a.amo_workplaces.name}</span>}
                  {a.start_date && <span>Start: {format(new Date(a.start_date), "d. MMM yyyy", { locale: da })}</span>}
                  {a.completed_date && <span>Afsluttet: {format(new Date(a.completed_date), "d. MMM yyyy", { locale: da })}</span>}
                  {due && <span>Næste frist: {format(due, "d. MMM yyyy", { locale: da })}</span>}
                </div>
                {a.risk_level && <span className="text-xs">Risikoniveau: {a.risk_level}</span>}
              </CardContent>
            </Card>
          );
        })}
        {(!apvRecords || apvRecords.length === 0) && (
          <p className="text-center text-muted-foreground py-8">Ingen APV'er registreret</p>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailApv} onOpenChange={() => setDetailApv(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailApv?.title}</DialogTitle>
          </DialogHeader>
          {detailApv && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><strong>Årsag:</strong> {reasonLabels[detailApv.reason]}</div>
                <div><strong>Risiko:</strong> {detailApv.risk_level || "–"}</div>
                <div><strong>Ansvarlig:</strong> {detailApv.responsible_owner || "–"}</div>
                <div><strong>Opfølgning:</strong> {detailApv.follow_up_status || "–"}</div>
              </div>
              {detailApv.physical_env && <div><strong>Fysisk arbejdsmiljø:</strong><p className="text-muted-foreground">{detailApv.physical_env}</p></div>}
              {detailApv.psychological_env && <div><strong>Psykisk arbejdsmiljø:</strong><p className="text-muted-foreground">{detailApv.psychological_env}</p></div>}
              {detailApv.sickness_review && <div><strong>Sygefravær:</strong><p className="text-muted-foreground">{detailApv.sickness_review}</p></div>}
              {detailApv.findings && <div><strong>Fund:</strong><p className="text-muted-foreground">{detailApv.findings}</p></div>}
              {detailApv.action_plan && <div><strong>Handlingsplan:</strong><p className="text-muted-foreground">{detailApv.action_plan}</p></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Rediger APV" : "Ny APV"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Titel *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Arbejdsplads</Label>
                <Select value={form.workplace_id} onValueChange={v => setForm(f => ({ ...f, workplace_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Vælg" /></SelectTrigger>
                  <SelectContent>
                    {workplaces?.map(wp => (
                      <SelectItem key={wp.id} value={wp.id}>{wp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Årsag</Label>
                <Select value={form.reason} onValueChange={v => setForm(f => ({ ...f, reason: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="triennial">3-års cyklus</SelectItem>
                    <SelectItem value="change">Ændring i arbejdsforhold</SelectItem>
                    <SelectItem value="incident">Hændelse/ulykke</SelectItem>
                    <SelectItem value="request">Anmodning fra AMR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Startdato</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>Afsluttet dato</Label>
                <Input type="date" value={form.completed_date} onChange={e => setForm(f => ({ ...f, completed_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Fysisk arbejdsmiljø</Label>
              <Textarea rows={2} value={form.physical_env} onChange={e => setForm(f => ({ ...f, physical_env: e.target.value }))} />
            </div>
            <div>
              <Label>Psykisk arbejdsmiljø</Label>
              <Textarea rows={2} value={form.psychological_env} onChange={e => setForm(f => ({ ...f, psychological_env: e.target.value }))} />
            </div>
            <div>
              <Label>Sygefravær gennemgang</Label>
              <Textarea rows={2} value={form.sickness_review} onChange={e => setForm(f => ({ ...f, sickness_review: e.target.value }))} />
            </div>
            <div>
              <Label>Fund / observationer</Label>
              <Textarea rows={2} value={form.findings} onChange={e => setForm(f => ({ ...f, findings: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Risikoniveau</Label>
                <Select value={form.risk_level} onValueChange={v => setForm(f => ({ ...f, risk_level: v }))}>
                  <SelectTrigger><SelectValue placeholder="Vælg" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lav">Lav</SelectItem>
                    <SelectItem value="middel">Middel</SelectItem>
                    <SelectItem value="høj">Høj</SelectItem>
                    <SelectItem value="kritisk">Kritisk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ansvarlig</Label>
                <Input value={form.responsible_owner} onChange={e => setForm(f => ({ ...f, responsible_owner: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Handlingsplan</Label>
              <Textarea rows={3} value={form.action_plan} onChange={e => setForm(f => ({ ...f, action_plan: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Deadline</Label>
                <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
              </div>
              <div>
                <Label>Opfølgningsstatus</Label>
                <Input value={form.follow_up_status} onChange={e => setForm(f => ({ ...f, follow_up_status: e.target.value }))} placeholder="F.eks. Afventer, I gang, Afsluttet" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Annuller</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.title || save.isPending}>
              {save.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
}
