import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Eye, FileDown, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { SuperadminGate } from "@/components/auth/SuperadminGate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsComplianceApprover } from "@/hooks/useComplianceDocuments";
import {
  ASSESSMENT_QUESTIONS,
  SUBJECT_TYPES,
  useApproveAssessment,
  useImpactAssessments,
  useSaveAssessment,
  type AssessmentInsert,
  type AssessmentRow,
} from "@/hooks/useComplianceRegisters";
import { exportBlocksPdf, type PdfBlock } from "@/utils/compliancePdf";

type QField = (typeof ASSESSMENT_QUESTIONS)[number]["field"];
type Form = {
  title: string; assessment_date: string; subject_type: string; subject_description: string;
  conclusion: string; requires_client_notice: boolean;
} & Record<QField, string>;

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): Form => ({
  title: "", assessment_date: today(), subject_type: "system", subject_description: "",
  conclusion: "", requires_client_notice: false,
  q1_purpose: "", q2_data: "", q3_instruction: "", q4_minimization: "",
  q5_access: "", q6_hosting: "", q7_risk: "", q8_retention: "",
});
const toForm = (r: AssessmentRow): Form => ({
  title: r.title, assessment_date: r.assessment_date, subject_type: r.subject_type,
  subject_description: r.subject_description ?? "", conclusion: r.conclusion ?? "",
  requires_client_notice: r.requires_client_notice,
  ...Object.fromEntries(ASSESSMENT_QUESTIONS.map((q) => [q.field, r[q.field] ?? ""])) as Record<QField, string>,
});
const fmtDate = (d: string | null) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("da-DK") : "—");

function Body() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useImpactAssessments();
  const { data: isApprover } = useIsComplianceApprover();
  const save = useSaveAssessment();
  const approve = useApproveAssessment();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const [viewing, setViewing] = useState<AssessmentRow | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.form.title.trim()) return toast.error("Titel mangler");
    const values: AssessmentInsert = { ...editing.form, title: editing.form.title.trim() };
    try {
      await save.mutateAsync({ id: editing.id, values });
      toast.success("Vurderingen er gemt og afventer Kaspers godkendelse");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approve.mutateAsync(id);
      toast.success("Vurderingen er godkendt");
      setViewing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Godkendelse fejlede");
    }
  };

  const exportPdf = async (r: AssessmentRow) => {
    const blocks: PdfBlock[] = [
      { kind: "h1", text: `Konsekvensvurdering: ${r.title}` },
      { kind: "meta", text: `Dato ${fmtDate(r.assessment_date)} · ${r.status === "approved" ? `Godkendt af ${r.approved_by_email} den ${fmtDate(r.approved_at)}` : "Afventer Kaspers godkendelse"} · Copenhagen Sales ApS` },
      { kind: "h2", text: "Hvad vurderes" },
      { kind: "p", text: `${SUBJECT_TYPES[r.subject_type] ?? r.subject_type}: ${r.subject_description ?? ""}` },
      { kind: "h2", text: "Vurdering (procedure pkt. 3.1)" },
      ...ASSESSMENT_QUESTIONS.flatMap((q): PdfBlock[] => [
        { kind: "h3", text: q.label },
        { kind: "p", text: r[q.field] || "—" },
      ]),
      { kind: "h2", text: "Konklusion" },
      { kind: "p", text: r.conclusion || "—" },
      { kind: "p", text: `Kræver kundeorientering: ${r.requires_client_notice ? "Ja" : "Nej"}` },
    ];
    try {
      await exportBlocksPdf(blocks, `Konsekvensvurdering_${r.assessment_date}.pdf`, "Copenhagen Sales ApS · Konsekvensvurdering");
    } catch {
      toast.error("PDF kunne ikke laves");
    }
  };

  const f = editing?.form;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/compliance")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Tilbage til Compliance
        </Button>
        <Button size="sm" onClick={() => setEditing({ form: emptyForm() })}>
          <Plus className="h-4 w-4 mr-2" /> Ny vurdering
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Konsekvensvurderinger</h1>
        <p className="text-sm text-muted-foreground">
          Vurderinger efter proceduren for konsekvensvurdering. Godkendes af Kasper Mikkelsen og kan ikke ændres bagefter.
        </p>
      </div>

      {isLoading ? null : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Ingen vurderinger endnu.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{r.title}</span>
                    <Badge variant="outline" className={r.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
                      : "bg-amber-500/10 text-amber-700 border-amber-500/30"}>
                      {r.status === "approved" ? `Godkendt ${fmtDate(r.approved_at)}` : "Afventer Kaspers godkendelse"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(r.assessment_date)} · {SUBJECT_TYPES[r.subject_type] ?? r.subject_type}
                    {r.requires_client_notice ? " · Kræver kundeorientering" : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setViewing(r)}><Eye className="h-4 w-4 mr-1" /> Vis</Button>
                  {r.status !== "approved" && (
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, form: toForm(r) })}>
                      <Pencil className="h-4 w-4 mr-1" /> Redigér
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => exportPdf(r)}><FileDown className="h-4 w-4 mr-1" /> PDF</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{viewing?.title}</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                {SUBJECT_TYPES[viewing.subject_type]}: {viewing.subject_description || "—"}
              </p>
              {ASSESSMENT_QUESTIONS.map((q) => (
                <div key={q.field}>
                  <p className="font-medium">{q.label}</p>
                  <p className="whitespace-pre-wrap">{viewing[q.field] || "—"}</p>
                </div>
              ))}
              <div><p className="font-medium">Konklusion</p><p className="whitespace-pre-wrap">{viewing.conclusion || "—"}</p></div>
              <p>Kræver kundeorientering: {viewing.requires_client_notice ? "Ja" : "Nej"}</p>
            </div>
          )}
          {viewing && isApprover && viewing.status !== "approved" && (
            <DialogFooter>
              <Button onClick={() => handleApprove(viewing.id)} disabled={approve.isPending}>
                <CheckCircle2 className="h-4 w-4 mr-2" /> Godkend vurderingen
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing?.id ? "Redigér vurdering" : "Ny vurdering"}</DialogTitle></DialogHeader>
          {f && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1"><Label>Titel</Label>
                  <Input value={f.title} onChange={(e) => set("title", e.target.value)} /></div>
                <div className="space-y-1"><Label>Dato</Label>
                  <Input type="date" value={f.assessment_date} onChange={(e) => set("assessment_date", e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label>Hvad vurderes</Label>
                  <Select value={f.subject_type} onValueChange={(v) => set("subject_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(SUBJECT_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select></div>
                <div className="col-span-2 space-y-1"><Label>Beskrivelse</Label>
                  <Input value={f.subject_description} onChange={(e) => set("subject_description", e.target.value)} /></div>
              </div>
              {ASSESSMENT_QUESTIONS.map((q) => (
                <div key={q.field} className="space-y-1">
                  <Label className="leading-snug">{q.label}</Label>
                  <Textarea value={f[q.field]} onChange={(e) => set(q.field, e.target.value)} />
                </div>
              ))}
              <div className="space-y-1"><Label>Konklusion</Label>
                <Textarea value={f.conclusion} onChange={(e) => set("conclusion", e.target.value)} /></div>
              <div className="space-y-1">
                <Label>Kræver kundeorientering?</Label>
                <div className="flex gap-2">
                  {[true, false].map((v) => (
                    <Button key={String(v)} type="button" size="sm" variant={f.requires_client_notice === v ? "default" : "outline"}
                      onClick={() => set("requires_client_notice", v)}>{v ? "Ja" : "Nej"}</Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Annullér</Button>
            <Button onClick={handleSave} disabled={save.isPending}>Gem</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ImpactAssessments() {
  return (
    <MainLayout>
      <SuperadminGate message="Konsekvensvurderingerne kan kun ses af superadmins.">
        <Body />
      </SuperadminGate>
    </MainLayout>
  );
}
