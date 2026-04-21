import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Plus, Pencil, Trash2, Calendar, FileText } from "lucide-react";
import { format, differenceInDays } from "date-fns";
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
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

type MeetingTypeValue = "amo_meeting" | "extraordinary" | "annual_discussion";
type LegacyMeetingTypeValue = "ordinary" | "annual";
type MeetingTypeInput = MeetingTypeValue | LegacyMeetingTypeValue;

const MEETING_TYPES: { value: MeetingTypeValue; label: string }[] = [
  { value: "amo_meeting", label: "Ordinært" },
  { value: "extraordinary", label: "Ekstraordinært" },
  { value: "annual_discussion", label: "Årligt møde" },
];

const meetingTypeLabels: Record<string, string> = Object.fromEntries(
  MEETING_TYPES.map(t => [t.value, t.label])
);

const LEGACY_MEETING_TYPE_MAP: Record<string, MeetingTypeValue> = {
  ordinary: "amo_meeting",
  annual: "annual_discussion",
};

const normalizeMeetingType = (type: string | null | undefined): MeetingTypeValue | null => {
  if (!type) return "amo_meeting";
  if (LEGACY_MEETING_TYPE_MAP[type]) return LEGACY_MEETING_TYPE_MAP[type];
  if (MEETING_TYPES.some(t => t.value === type)) return type as MeetingTypeValue;
  return null;
};

const statusLabels: Record<string, string> = {
  planned: "Planlagt",
  completed: "Gennemført",
  overdue: "Overskredet",
  cancelled: "Aflyst",
};

const statusColors: Record<string, string> = {
  planned: "bg-blue-500/20 text-blue-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  overdue: "bg-red-500/20 text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

type MeetingForm = {
  meeting_type: MeetingTypeInput;
  planned_date: string;
  actual_date: string;
  agenda: string;
  decisions: string;
  minutes_url: string;
  next_meeting_date: string;
  status: string;
  attendees: string;
};

const emptyForm: MeetingForm = {
  meeting_type: "amo_meeting",
  planned_date: "",
  actual_date: "",
  agenda: "",
  decisions: "",
  minutes_url: "",
  next_meeting_date: "",
  status: "planned",
  attendees: "",
};

export default function AmoMeetings() {
  const qc = useQueryClient();
  const today = new Date();
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<MeetingForm>(emptyForm);
  const [detailMeeting, setDetailMeeting] = useState<any>(null);

  const { data: meetings } = useQuery({
    queryKey: ["amo-meetings"],
    queryFn: async () => {
      const { data } = await supabase.from("amo_meetings").select("*").order("planned_date", { ascending: false });
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (f: MeetingForm) => {
      const normalizedType = normalizeMeetingType(f.meeting_type);
      if (!normalizedType) {
        throw new Error("Ukendt mødetype. Vælg venligst en gyldig mødetype og prøv igen.");
      }

      const payload = {
        meeting_type: normalizedType as any,
        planned_date: f.planned_date,
        actual_date: f.actual_date || null,
        agenda: f.agenda || null,
        decisions: f.decisions || null,
        minutes_url: f.minutes_url || null,
        next_meeting_date: f.next_meeting_date || null,
        status: f.status as any,
        attendees: f.attendees ? f.attendees.split(",").map(s => s.trim()) : null,
      };
      if (editing) {
        const { error } = await supabase.from("amo_meetings").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("amo_meetings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-meetings"] });
      setDialog(false);
      toast.success(editing ? "Møde opdateret" : "Møde oprettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("amo_meetings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["amo-meetings"] });
      toast.success("Møde slettet");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...emptyForm, meeting_type: normalizeMeetingType(emptyForm.meeting_type) ?? "amo_meeting" });
    setDialog(true);
  };

  const openEdit = (m: any) => {
    setEditing(m);
    setForm({
      meeting_type: normalizeMeetingType(m.meeting_type),
      planned_date: m.planned_date?.split("T")[0] || "",
      actual_date: m.actual_date?.split("T")[0] || "",
      agenda: m.agenda || "",
      decisions: m.decisions || "",
      minutes_url: m.minutes_url || "",
      next_meeting_date: m.next_meeting_date?.split("T")[0] || "",
      status: m.status,
      attendees: (m.attendees || []).join(", "),
    });
    setDialog(true);
  };

  // Default agenda template
  const generateAgenda = () => {
    setForm(f => ({
      ...f,
      agenda: `1. Godkendelse af dagsorden\n2. Opfølgning fra sidste møde\n3. Gennemgang af APV-handlingsplan\n4. Arbejdsmiljørunde\n5. Nyt fra AMR\n6. Kommende aktiviteter\n7. Eventuelt`,
    }));
  };

  const planned = meetings?.filter(m => m.status === "planned") || [];
  const completed = meetings?.filter(m => m.status === "completed") || [];

  return (
    <MainLayout>
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/20">
            <Shield className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Møder og referater</h1>
            <p className="text-sm text-muted-foreground">AMO-møder, agendaer og beslutninger</p>
          </div>
        </div>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nyt møde
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{meetings?.length || 0}</div>
            <div className="text-xs text-muted-foreground">Total møder</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{planned.length}</div>
            <div className="text-xs text-muted-foreground">Planlagte</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{completed.length}</div>
            <div className="text-xs text-muted-foreground">Gennemførte</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">
              {completed.filter(m => !m.minutes_url).length}
            </div>
            <div className="text-xs text-muted-foreground">Mangler referat</div>
          </CardContent>
        </Card>
      </div>

      {/* Meeting list */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dato</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deltagere</TableHead>
                <TableHead>Referat</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {meetings?.map(m => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setDetailMeeting(m)}>
                  <TableCell>{format(new Date(m.planned_date), "d. MMM yyyy", { locale: da })}</TableCell>
                  <TableCell>{meetingTypeLabels[m.meeting_type] || m.meeting_type}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn("text-xs", statusColors[m.status])}>
                      {statusLabels[m.status] || m.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.attendees?.length || 0} deltagere
                  </TableCell>
                  <TableCell>
                    {m.minutes_url ? (
                      <FileText className="h-4 w-4 text-emerald-400" />
                    ) : m.status === "completed" ? (
                      <span className="text-xs text-yellow-400">Mangler</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">–</span>
                    )}
                  </TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => {
                        if (confirm("Slet dette møde?")) del.mutate(m.id);
                      }}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!meetings || meetings.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Ingen møder registreret endnu
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detailMeeting} onOpenChange={() => setDetailMeeting(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {detailMeeting && `${meetingTypeLabels[detailMeeting.meeting_type] || "Møde"} – ${format(new Date(detailMeeting.planned_date), "d. MMM yyyy", { locale: da })}`}
            </DialogTitle>
          </DialogHeader>
          {detailMeeting && (
            <div className="space-y-3 text-sm">
              <div><strong>Status:</strong> {statusLabels[detailMeeting.status]}</div>
              {detailMeeting.agenda && <div><strong>Agenda:</strong><pre className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">{detailMeeting.agenda}</pre></div>}
              {detailMeeting.decisions && <div><strong>Beslutninger:</strong><pre className="mt-1 text-xs whitespace-pre-wrap text-muted-foreground">{detailMeeting.decisions}</pre></div>}
              {detailMeeting.attendees?.length > 0 && <div><strong>Deltagere:</strong> {detailMeeting.attendees.join(", ")}</div>}
              {detailMeeting.next_meeting_date && <div><strong>Næste møde:</strong> {format(new Date(detailMeeting.next_meeting_date), "d. MMM yyyy", { locale: da })}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Rediger møde" : "Nyt AMO-møde"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type *</Label>
                <Select value={normalizeMeetingType(form.meeting_type) ?? "amo_meeting"} onValueChange={v => setForm(f => ({ ...f, meeting_type: normalizeMeetingType(v) ?? "amo_meeting" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planlagt</SelectItem>
                    <SelectItem value="completed">Gennemført</SelectItem>
                    <SelectItem value="overdue">Overskredet</SelectItem>
                    <SelectItem value="cancelled">Aflyst</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Planlagt dato *</Label>
                <Input type="date" value={form.planned_date} onChange={e => setForm(f => ({ ...f, planned_date: e.target.value }))} />
              </div>
              <div>
                <Label>Afholdt dato</Label>
                <Input type="date" value={form.actual_date} onChange={e => setForm(f => ({ ...f, actual_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label>Agenda</Label>
                <Button type="button" variant="link" size="sm" className="text-xs h-auto p-0" onClick={generateAgenda}>
                  Generer skabelon
                </Button>
              </div>
              <Textarea rows={5} value={form.agenda} onChange={e => setForm(f => ({ ...f, agenda: e.target.value }))} />
            </div>
            <div>
              <Label>Beslutninger</Label>
              <Textarea rows={3} value={form.decisions} onChange={e => setForm(f => ({ ...f, decisions: e.target.value }))} />
            </div>
            <div>
              <Label>Deltagere (kommasepareret)</Label>
              <Input value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} placeholder="Martin Grønbeck, William Seiding" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Referat URL</Label>
                <Input value={form.minutes_url} onChange={e => setForm(f => ({ ...f, minutes_url: e.target.value }))} />
              </div>
              <div>
                <Label>Næste møde dato</Label>
                <Input type="date" value={form.next_meeting_date} onChange={e => setForm(f => ({ ...f, next_meeting_date: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Annuller</Button>
            <Button onClick={() => save.mutate({ ...form, meeting_type: normalizeMeetingType(form.meeting_type) ?? form.meeting_type })} disabled={!form.planned_date || save.isPending}>
              {save.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
}
