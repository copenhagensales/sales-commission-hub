import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, FileDown, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { MainLayout } from "@/components/layout/MainLayout";
import { SuperadminGate } from "@/components/auth/SuperadminGate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useBreachLog,
  useComplianceClients,
  useSaveBreach,
  type BreachInsert,
  type BreachRow,
} from "@/hooks/useComplianceRegisters";
import { exportBlocksPdf, type PdfBlock } from "@/utils/compliancePdf";

const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("da-DK", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Copenhagen" }) : "—";
const fmtDate = (d: string | null) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("da-DK") : "—");

/** ISO → værdi til datetime-local (lokal tid). */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

type Form = {
  occurred_at: string; discovered_at: string; description: string; client_ids: string[];
  data_types: string; estimated_subjects: string; measures: string; risk_assessment: string;
  client_notified_at: string; closed_on: string; root_cause: string; permanent_measures: string;
  was_breach: "" | "yes" | "no"; was_breach_reason: string;
};

const empty: Form = {
  occurred_at: "", discovered_at: "", description: "", client_ids: [], data_types: "",
  estimated_subjects: "", measures: "", risk_assessment: "", client_notified_at: "",
  closed_on: "", root_cause: "", permanent_measures: "", was_breach: "", was_breach_reason: "",
};

const toForm = (r: BreachRow): Form => ({
  occurred_at: toLocalInput(r.occurred_at), discovered_at: toLocalInput(r.discovered_at),
  description: r.description ?? "", client_ids: r.client_ids ?? [], data_types: r.data_types ?? "",
  estimated_subjects: r.estimated_subjects?.toString() ?? "", measures: r.measures ?? "",
  risk_assessment: r.risk_assessment ?? "", client_notified_at: toLocalInput(r.client_notified_at),
  closed_on: r.closed_on ?? "", root_cause: r.root_cause ?? "", permanent_measures: r.permanent_measures ?? "",
  was_breach: r.was_breach === null ? "" : r.was_breach ? "yes" : "no", was_breach_reason: r.was_breach_reason ?? "",
});

const toValues = (f: Form): BreachInsert => ({
  occurred_at: fromLocalInput(f.occurred_at), discovered_at: fromLocalInput(f.discovered_at),
  description: f.description || null, client_ids: f.client_ids, data_types: f.data_types || null,
  estimated_subjects: f.estimated_subjects ? Number(f.estimated_subjects) : null,
  measures: f.measures || null, risk_assessment: f.risk_assessment || null,
  client_notified_at: fromLocalInput(f.client_notified_at), closed_on: f.closed_on || null,
  root_cause: f.root_cause || null, permanent_measures: f.permanent_measures || null,
  was_breach: f.was_breach === "" ? null : f.was_breach === "yes", was_breach_reason: f.was_breach_reason || null,
});

function BreachLogBody() {
  const navigate = useNavigate();
  const { data: rows = [], isLoading } = useBreachLog();
  const { data: clients = [] } = useComplianceClients();
  const save = useSaveBreach();
  const [editing, setEditing] = useState<{ id?: string; form: Form } | null>(null);
  const clientName = (id: string) => clients.find((c) => c.id === id)?.name ?? "Ukendt kunde";

  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setEditing((e) => (e ? { ...e, form: { ...e.form, [k]: v } } : e));

  const handleSave = async () => {
    if (!editing) return;
    try {
      await save.mutateAsync({ id: editing.id, values: toValues(editing.form) });
      toast.success("Hændelsen er gemt");
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Kunne ikke gemme");
    }
  };

  const exportPdf = async (r: BreachRow) => {
    const field = (label: string, value: string): PdfBlock[] => [
      { kind: "h3", text: label },
      { kind: "p", text: value || "—" },
    ];
    const blocks: PdfBlock[] = [
      { kind: "h1", text: "Databrudslog – hændelse" },
      { kind: "meta", text: `Registreret ${fmtDateTime(r.created_at)} · Opbevares til ${fmtDate(r.retain_until)} · Copenhagen Sales ApS` },
      { kind: "h2", text: "Hændelse" },
      ...field("Tidspunkt for hændelse", fmtDateTime(r.occurred_at)),
      ...field("Tidspunkt for opdagelse", fmtDateTime(r.discovered_at)),
      ...field("Beskrivelse", r.description ?? ""),
      ...field("Berørte kunder", (r.client_ids ?? []).map(clientName).join(", ")),
      ...field("Typer af oplysninger", r.data_types ?? ""),
      ...field("Skønnet antal registrerede", r.estimated_subjects?.toString() ?? ""),
      { kind: "h2", text: "Håndtering" },
      ...field("Foranstaltninger", r.measures ?? ""),
      ...field("Risikovurdering", r.risk_assessment ?? ""),
      ...field("Kunde underrettet", fmtDateTime(r.client_notified_at)),
      { kind: "h2", text: "Afslutning" },
      ...field("Afsluttet", fmtDate(r.closed_on)),
      ...field("Årsag", r.root_cause ?? ""),
      ...field("Varige foranstaltninger", r.permanent_measures ?? ""),
      ...field("Var det et brud?", r.was_breach === null ? "Ikke afgjort" : r.was_breach ? "Ja" : "Nej"),
      ...field("Begrundelse", r.was_breach_reason ?? ""),
    ];
    const stamp = r.discovered_at ? r.discovered_at.slice(0, 10) : r.created_at.slice(0, 10);
    try {
      await exportBlocksPdf(blocks, `Databrud_${stamp}.pdf`, "Copenhagen Sales ApS · Databrudslog");
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
        <Button size="sm" onClick={() => setEditing({ form: empty })}>
          <Plus className="h-4 w-4 mr-2" /> Ny hændelse
        </Button>
      </div>
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-foreground">Databrudslog</h1>
        <p className="text-sm text-muted-foreground">
          Alle hændelser efter proceduren ved brud på persondatasikkerheden – også dem, der ikke var brud. Opbevares i 5 år. Kun superadmin.
        </p>
      </div>

      {isLoading ? null : rows.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Ingen hændelser registreret.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">Opdaget {fmtDateTime(r.discovered_at)}</span>
                    <Badge variant="outline">{r.closed_on ? `Afsluttet ${fmtDate(r.closed_on)}` : "Åben"}</Badge>
                    {r.was_breach !== null && (
                      <Badge variant="outline">{r.was_breach ? "Brud" : "Ikke brud"}</Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: r.id, form: toForm(r) })}>
                      <Pencil className="h-4 w-4 mr-1" /> Redigér
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportPdf(r)}>
                      <FileDown className="h-4 w-4 mr-1" /> PDF
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-foreground line-clamp-2">{r.description || "Ingen beskrivelse"}</p>
                <p className="text-xs text-muted-foreground">
                  Kunder: {(r.client_ids ?? []).map(clientName).join(", ") || "—"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Redigér hændelse" : "Ny hændelse"}</DialogTitle>
          </DialogHeader>
          {f && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Tidspunkt for hændelse</Label>
                  <Input type="datetime-local" value={f.occurred_at} onChange={(e) => set("occurred_at", e.target.value)} /></div>
                <div className="space-y-1"><Label>Tidspunkt for opdagelse</Label>
                  <Input type="datetime-local" value={f.discovered_at} onChange={(e) => set("discovered_at", e.target.value)} /></div>
              </div>
              <div className="space-y-1"><Label>Beskrivelse</Label>
                <Textarea value={f.description} onChange={(e) => set("description", e.target.value)} /></div>
              <div className="space-y-1">
                <Label>Berørte kunder</Label>
                <div className="grid grid-cols-2 gap-1 rounded-md border p-2 max-h-40 overflow-y-auto">
                  {clients.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={f.client_ids.includes(c.id)}
                        onCheckedChange={(v) =>
                          set("client_ids", v ? [...f.client_ids, c.id] : f.client_ids.filter((x) => x !== c.id))
                        }
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Typer af oplysninger</Label>
                  <Input value={f.data_types} onChange={(e) => set("data_types", e.target.value)} /></div>
                <div className="space-y-1"><Label>Skønnet antal registrerede</Label>
                  <Input type="number" min={0} value={f.estimated_subjects} onChange={(e) => set("estimated_subjects", e.target.value)} /></div>
              </div>
              <div className="space-y-1"><Label>Foranstaltninger</Label>
                <Textarea value={f.measures} onChange={(e) => set("measures", e.target.value)} /></div>
              <div className="space-y-1"><Label>Risikovurdering</Label>
                <Textarea value={f.risk_assessment} onChange={(e) => set("risk_assessment", e.target.value)} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><Label>Kunde underrettet (dato/tid)</Label>
                  <Input type="datetime-local" value={f.client_notified_at} onChange={(e) => set("client_notified_at", e.target.value)} /></div>
                <div className="space-y-1"><Label>Afsluttet (dato)</Label>
                  <Input type="date" value={f.closed_on} onChange={(e) => set("closed_on", e.target.value)} /></div>
              </div>
              <div className="space-y-1"><Label>Årsag</Label>
                <Textarea value={f.root_cause} onChange={(e) => set("root_cause", e.target.value)} /></div>
              <div className="space-y-1"><Label>Varige foranstaltninger</Label>
                <Textarea value={f.permanent_measures} onChange={(e) => set("permanent_measures", e.target.value)} /></div>
              <div className="space-y-1">
                <Label>Var det et brud?</Label>
                <div className="flex gap-2">
                  {(["yes", "no"] as const).map((v) => (
                    <Button key={v} type="button" size="sm" variant={f.was_breach === v ? "default" : "outline"}
                      onClick={() => set("was_breach", f.was_breach === v ? "" : v)}>
                      {v === "yes" ? "Ja" : "Nej"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1"><Label>Begrundelse</Label>
                <Textarea value={f.was_breach_reason} onChange={(e) => set("was_breach_reason", e.target.value)} /></div>
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

export default function BreachLog() {
  return (
    <MainLayout>
      <SuperadminGate message="Databrudsloggen kan kun ses af superadmins.">
        <BreachLogBody />
      </SuperadminGate>
    </MainLayout>
  );
}
