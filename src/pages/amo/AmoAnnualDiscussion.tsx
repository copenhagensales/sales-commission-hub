import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Pencil, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { format, differenceInDays, addYears } from "date-fns";
import { da } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type DiscussionForm = {
  discussion_date: string;
  previous_year_eval: string;
  goals: string;
  collab_model: string;
  meeting_cadence: string;
  minutes_url: string;
  participants: string;
  status: string;
};

const emptyForm: DiscussionForm = {
  discussion_date: "",
  previous_year_eval: "",
  goals: "",
  collab_model: "",
  meeting_cadence: "",
  minutes_url: "",
  participants: "",
  status: "draft",
};

export default function AmoAnnualDiscussion() {
  const qc = useQueryClient();
  const today = new Date();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<DiscussionForm>(emptyForm);

  const { data: discussions } = useQuery({
    queryKey: ["amo-annual-discussions"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_annual_discussions").select("*").order("discussion_date", { ascending: false });
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (f: DiscussionForm) => {
      const nextDue = addYears(new Date(f.discussion_date), 1).toISOString().split("T")[0];
      const payload = {
        discussion_date: f.discussion_date,
        previous_year_eval: f.previous_year_eval || null,
        goals: f.goals || null,
        collab_model: f.collab_model || null,
        meeting_cadence: f.meeting_cadence || null,
        minutes_url: f.minutes_url || null,
        participants: f.participants ? f.participants.split(",").map(s => s.trim()) : null,
        next_due_date: nextDue,
        status: f.status,
      };
      if (editing) {
        const { error } = await supabase.from("amo_annual_discussions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("amo_annual_discussions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-annual-discussions"] });
      setDialog(false);
      toast.success(editing ? "Drøftelse opdateret" : "Drøftelse oprettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amo_annual_discussions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-annual-discussions"] });
      toast.success("Drøftelse slettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialog(true);
  };

  const openEdit = (d: any) => {
    setEditing(d);
    setForm({
      discussion_date: d.discussion_date?.split("T")[0] || "",
      previous_year_eval: d.previous_year_eval || "",
      goals: d.goals || "",
      collab_model: d.collab_model || "",
      meeting_cadence: d.meeting_cadence || "",
      minutes_url: d.minutes_url || "",
      participants: (d.participants || []).join(", "),
      status: d.status,
    });
    setDialog(true);
  };

  const latest = discussions?.[0];
  const nextDue = latest?.next_due_date ? new Date(latest.next_due_date) : null;
  const daysUntilDue = nextDue ? differenceInDays(nextDue, today) : null;

  const reminderBands = [
    { days: 60, label: "60 dage til frist", color: "border-blue-500/30 bg-blue-500/10 text-blue-200" },
    { days: 30, label: "30 dage til frist", color: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200" },
    { days: 7, label: "7 dage til frist!", color: "border-red-500/30 bg-red-500/10 text-red-200" },
  ];

  const activeReminder = daysUntilDue !== null && daysUntilDue > 0
    ? reminderBands.filter(b => daysUntilDue <= b.days).pop()
    : null;

  return (
    <MainLayout>
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Årlig arbejdsmiljødrøftelse</h1>
            <p className="text-sm text-muted-foreground">Lovpligtig årlig drøftelse af samarbejdsmodel og mål</p>
          </div>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Ny drøftelse
        </Button>
      </div>

      {/* Due date warning */}
      {nextDue && daysUntilDue !== null && daysUntilDue < 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/50 bg-red-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Fristen er overskredet med {Math.abs(daysUntilDue)} dage!</p>
            <p className="text-xs text-red-300">Frist var {format(nextDue, "d. MMMM yyyy", { locale: da })}. Gennemfør drøftelsen hurtigst muligt.</p>
          </div>
        </div>
      )}

      {activeReminder && (
        <div className={cn("flex items-start gap-3 rounded-lg border p-4", activeReminder.color)}>
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <p className="text-sm">{activeReminder.label} – frist {format(nextDue!, "d. MMMM yyyy", { locale: da })}</p>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Seneste drøftelse</div>
            <div className="text-lg font-bold text-foreground">
              {latest ? format(new Date(latest.discussion_date), "d. MMM yyyy", { locale: da }) : "Ingen"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Næste frist</div>
            <div className={cn("text-lg font-bold", daysUntilDue !== null && daysUntilDue < 0 ? "text-red-400" : "text-foreground")}>
              {nextDue ? format(nextDue, "d. MMM yyyy", { locale: da }) : "–"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Referat</div>
            <div className="text-lg font-bold">
              {latest?.minutes_url ? (
                <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="h-5 w-5" /> Uploadet</span>
              ) : (
                <span className="text-yellow-400">Mangler</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Discussion list */}
      <div className="space-y-4">
        {discussions?.map(d => (
          <Card key={d.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Drøftelse – {format(new Date(d.discussion_date), "d. MMMM yyyy", { locale: da })}
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(d)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    if (confirm("Slet denne drøftelse?")) del.mutate(d.id);
                  }}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {d.previous_year_eval && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Evaluering foregående år</span>
                    <p className="text-foreground">{d.previous_year_eval}</p>
                  </div>
                )}
                {d.goals && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Mål for kommende år</span>
                    <p className="text-foreground">{d.goals}</p>
                  </div>
                )}
                {d.collab_model && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Samarbejdsmodel</span>
                    <p className="text-foreground">{d.collab_model}</p>
                  </div>
                )}
                {d.meeting_cadence && (
                  <div>
                    <span className="text-xs font-medium text-muted-foreground">Mødefrekvens</span>
                    <p className="text-foreground">{d.meeting_cadence}</p>
                  </div>
                )}
              </div>
              {d.participants && d.participants.length > 0 && (
                <div className="text-xs text-muted-foreground">Deltagere: {d.participants.join(", ")}</div>
              )}
            </CardContent>
          </Card>
        ))}
        {(!discussions || discussions.length === 0) && (
          <p className="text-center text-muted-foreground py-8">Ingen årlige drøftelser registreret</p>
        )}
      </div>

      {/* Form Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Rediger drøftelse" : "Ny årlig drøftelse"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Dato for drøftelse *</Label>
              <Input type="date" value={form.discussion_date} onChange={e => setForm(f => ({ ...f, discussion_date: e.target.value }))} />
            </div>
            <div>
              <Label>Evaluering af foregående år</Label>
              <Textarea rows={3} value={form.previous_year_eval} onChange={e => setForm(f => ({ ...f, previous_year_eval: e.target.value }))} />
            </div>
            <div>
              <Label>Mål for kommende år</Label>
              <Textarea rows={3} value={form.goals} onChange={e => setForm(f => ({ ...f, goals: e.target.value }))} />
            </div>
            <div>
              <Label>Samarbejdsmodel</Label>
              <Textarea rows={2} value={form.collab_model} onChange={e => setForm(f => ({ ...f, collab_model: e.target.value }))} />
            </div>
            <div>
              <Label>Mødefrekvens</Label>
              <Input value={form.meeting_cadence} onChange={e => setForm(f => ({ ...f, meeting_cadence: e.target.value }))} placeholder="F.eks. Kvartalsmøder" />
            </div>
            <div>
              <Label>Deltagere (kommasepareret)</Label>
              <Input value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} />
            </div>
            <div>
              <Label>Referat URL</Label>
              <Input value={form.minutes_url} onChange={e => setForm(f => ({ ...f, minutes_url: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Annuller</Button>
            <Button onClick={() => save.mutate(form)} disabled={!form.discussion_date || save.isPending}>
              {save.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
}
