import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCurrentEmployeeId } from "@/hooks/useCurrentEmployeeId";
import {
  useInvoiceflowAccess, useIfSuppliers, useIfSources, useIfCredentialMeta, useIfJobs, useIfInvoices,
  useIfSettings, useIfPortalRequests, useCreateSupplierWithSource, useUpdateSource, useUpdateIfSettings,
  useAddPortalRequest, useInvoiceflowAdmin,
} from "@/hooks/useInvoiceflow";

const fmtDate = (s?: string | null) => (s ? new Date(s).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" }) : "–");
const CADENCE: Record<string, string> = { monthly: "Månedlig", quarterly: "Kvartal", irregular: "Uregelmæssig" };
const JOB_STATUS: Record<string, string> = { ventende: "Ventende", koerer: "Kører", ok: "OK", fejlet: "Fejlet", pauset: "Pauset", afventer_kode: "Afventer kode" };
const INV_STATUS: Record<string, string> = { afventer_godkendelse: "Afventer godkendelse", klar: "Klar", sendt: "Sendt", ikke_leveret: "Ikke leveret" };

export default function InvoiceFlow() {
  const { hasAccess, isLoading } = useInvoiceflowAccess();
  return (
    <MainLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div>
          <h1 className="text-2xl font-bold">InvoiceFlow</h1>
          <p className="text-muted-foreground">Henter leverandørfakturaer og sender dem til bogholderiet.</p>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !hasAccess ? (
          <Card><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">Adgang begrænset</p>
            <p className="text-sm text-muted-foreground">InvoiceFlow er kun for brugere med InvoiceFlow-adgang.</p>
          </CardContent></Card>
        ) : (
          <Tabs defaultValue="suppliers">
            <TabsList className="flex w-full overflow-x-auto">
              <TabsTrigger value="suppliers" className="min-h-11">Leverandører</TabsTrigger>
              <TabsTrigger value="runs" className="min-h-11">Kørsler</TabsTrigger>
              <TabsTrigger value="invoices" className="min-h-11">Fakturaer</TabsTrigger>
              <TabsTrigger value="settings" className="min-h-11">Indstillinger</TabsTrigger>
            </TabsList>
            <TabsContent value="suppliers"><SuppliersTab /></TabsContent>
            <TabsContent value="runs"><RunsTab /></TabsContent>
            <TabsContent value="invoices"><InvoicesTab /></TabsContent>
            <TabsContent value="settings"><SettingsTab /></TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  );
}

function SuppliersTab() {
  const { data: suppliers = [] } = useIfSuppliers();
  const { data: sources = [] } = useIfSources();
  const { data: creds = [] } = useIfCredentialMeta();
  const updateSource = useUpdateSource();
  const admin = useInvoiceflowAdmin();
  const { toast } = useToast();

  return (
    <div className="space-y-4">
      <NewSupplierForm />
      {suppliers.map((s) => {
        const srcs = sources.filter((x) => x.supplier_id === s.id);
        return (
          <Card key={s.id} className={s.missing_period ? "border-destructive" : undefined}>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                {s.name}
                <Badge variant="secondary">{CADENCE[s.cadence] ?? s.cadence}</Badge>
                {!s.is_active && <Badge variant="outline">Inaktiv</Badge>}
                {s.missing_period && <Badge variant="destructive">Mangler faktura for {s.missing_period}</Badge>}
              </CardTitle>
              {s.cvr && <p className="text-sm text-muted-foreground">CVR {s.cvr}</p>}
            </CardHeader>
            <CardContent className="space-y-3">
              {srcs.map((src) => {
                const cred = creds.find((c) => c.source_id === src.id);
                const cfg = src.config as Record<string, string>;
                return (
                  <div key={src.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge>{src.type === "email" ? "Mail-regel" : src.type}</Badge>
                      {src.is_paused && <Badge variant="destructive">Pauset{src.pause_reason ? `: ${src.pause_reason}` : ""}</Badge>}
                      {src.type !== "email" && <span className="text-muted-foreground">{cred ? `Login gemt – opdateret ${fmtDate(cred.updated_at)}` : "Intet login gemt"}</span>}
                    </div>
                    {src.type === "email" && (
                      <p className="text-sm text-muted-foreground break-words">
                        Indbakke {cfg.mailbox} · afsender {cfg.from_domain || "alle"} · emne {cfg.subject_contains || "alle"} · vedhæftning {cfg.attachment_contains || "alle PDF"}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={src.requires_approval} onCheckedChange={(v) => updateSource.mutate({ id: src.id, patch: { requires_approval: v } })} />
                        Kræver godkendelse
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Switch checked={!src.is_paused} onCheckedChange={(v) => updateSource.mutate({ id: src.id, patch: { is_paused: !v, pause_reason: v ? null : "Pauset manuelt" } })} />
                        Aktiv
                      </label>
                      <Button size="sm" variant="outline" className="min-h-11" disabled={admin.isPending}
                        onClick={() => admin.mutate({ action: "test", source_id: src.id }, {
                          onSuccess: (r) => toast({ title: r.ok ? "Test ok" : "Test fejlede", description: r.message, variant: r.ok ? "default" : "destructive" }),
                          onError: () => toast({ title: "Test fejlede", variant: "destructive" }),
                        })}>Test nu</Button>
                      <Button size="sm" className="min-h-11" disabled={admin.isPending}
                        onClick={() => admin.mutate({ action: "run_now", source_id: src.id }, {
                          onSuccess: (r) => toast({ title: r.ok ? "Kørsel færdig" : "Kørsel fejlede", description: r.error }),
                          onError: () => toast({ title: "Kørsel fejlede", variant: "destructive" }),
                        })}>Kør nu</Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
      {!suppliers.length && <p className="text-sm text-muted-foreground">Ingen leverandører endnu.</p>}
    </div>
  );
}

function NewSupplierForm() {
  const create = useCreateSupplierWithSource();
  const { data: employeeId } = useCurrentEmployeeId();
  const { toast } = useToast();
  const [f, setF] = useState({ name: "", cvr: "", cadence: "monthly", expected_day: "", mailbox: "", from_domain: "", subject_contains: "", attachment_contains: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Opret leverandør (mail-regel)</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => {
          e.preventDefault();
          if (!f.name.trim() || !f.mailbox.trim()) return;
          create.mutate({
            supplier: { name: f.name.trim(), cvr: f.cvr.trim() || null, cadence: f.cadence, expected_day: f.expected_day ? Number(f.expected_day) : null },
            source: { type: "email", owner_employee_id: employeeId ?? null, config: {
              mailbox: f.mailbox.trim(), from_domain: f.from_domain.trim() || undefined,
              subject_contains: f.subject_contains.trim() || undefined, attachment_contains: f.attachment_contains.trim() || undefined,
            } },
          }, {
            onSuccess: () => { toast({ title: "Leverandør oprettet", description: "Godkendelse er slået til." }); setF({ ...f, name: "", cvr: "", from_domain: "", subject_contains: "", attachment_contains: "" }); },
            onError: () => toast({ title: "Kunne ikke oprette", variant: "destructive" }),
          });
        }}>
          <Field label="Navn"><Input value={f.name} onChange={set("name")} required /></Field>
          <Field label="CVR"><Input value={f.cvr} onChange={set("cvr")} inputMode="numeric" /></Field>
          <Field label="Kadence">
            <Select value={f.cadence} onValueChange={(v) => setF({ ...f, cadence: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CADENCE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Forventet dag i måneden"><Input value={f.expected_day} onChange={set("expected_day")} inputMode="numeric" /></Field>
          <Field label="Indbakke der læses (M365)"><Input type="email" value={f.mailbox} onChange={set("mailbox")} required /></Field>
          <Field label="Afsender-domæne"><Input value={f.from_domain} onChange={set("from_domain")} placeholder="leverandoer.dk" /></Field>
          <Field label="Emneord"><Input value={f.subject_contains} onChange={set("subject_contains")} placeholder="Faktura" /></Field>
          <Field label="Navn på vedhæftning indeholder"><Input value={f.attachment_contains} onChange={set("attachment_contains")} /></Field>
          <div className="md:col-span-2"><Button type="submit" className="min-h-11" disabled={create.isPending}>Opret</Button></div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-sm">{label}</Label>{children}</div>;
}

function RunsTab() {
  const { data: jobs = [] } = useIfJobs();
  const { data: sources = [] } = useIfSources();
  const { data: suppliers = [] } = useIfSuppliers();
  const admin = useInvoiceflowAdmin();
  const { toast } = useToast();
  const nameFor = (sourceId: string) => suppliers.find((s) => s.id === sources.find((x) => x.id === sourceId)?.supplier_id)?.name ?? "–";

  return (
    <div className="space-y-2">
      {jobs.map((j) => {
        const last = [...(j.runs ?? [])].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
        return (
          <Card key={j.id}><CardContent className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {nameFor(j.source_id)} <Badge variant={j.status === "fejlet" || j.status === "pauset" ? "destructive" : "secondary"}>{JOB_STATUS[j.status]}</Badge>
                <span className="text-muted-foreground">{j.kind} · {j.period ?? "–"} · forsøg {j.attempt}</span>
              </div>
              {last && <p className="text-muted-foreground break-words">Seneste: {fmtDate(last.started_at)} · {last.result ?? "–"} · {last.invoices_found} fakturaer{last.error_message ? ` · ${last.error_code}: ${last.error_message}` : ""}</p>}
              {j.next_attempt_at && <p className="text-muted-foreground">Næste forsøg {fmtDate(j.next_attempt_at)}</p>}
            </div>
            <Button size="sm" variant="outline" className="min-h-11" disabled={admin.isPending || j.status === "koerer"}
              onClick={() => admin.mutate({ action: "rerun", job_id: j.id }, { onError: () => toast({ title: "Kunne ikke genkøre", variant: "destructive" }) })}>Genkør</Button>
          </CardContent></Card>
        );
      })}
      {!jobs.length && <p className="text-sm text-muted-foreground">Ingen kørsler endnu.</p>}
    </div>
  );
}

function InvoicesTab() {
  const { data: invoices = [] } = useIfInvoices();
  const { data: suppliers = [] } = useIfSuppliers();
  const admin = useInvoiceflowAdmin();
  const { toast } = useToast();
  const money = (n: number | null, c: string) => (n == null ? "–" : `${Number(n).toLocaleString("da-DK", { minimumFractionDigits: 2 })} ${c}`);

  return (
    <div className="space-y-2">
      {invoices.map((i) => (
        <Card key={i.id}><CardContent className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1 text-sm">
            <div className="flex flex-wrap items-center gap-2 font-medium">
              {suppliers.find((s) => s.id === i.supplier_id)?.name ?? "–"} · {i.invoice_number ?? "uden nr."}
              <Badge variant={i.status === "ikke_leveret" ? "destructive" : "secondary"}>{INV_STATUS[i.status]}</Badge>
            </div>
            <p className="text-muted-foreground">Dato {i.invoice_date ?? "–"} · periode {i.period ?? "–"} · inkl. moms {money(i.amount_incl_vat, i.currency)} · ekskl. moms {money(i.amount_excl_vat, i.currency)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="min-h-11" onClick={() => admin.mutate({ action: "signed_url", invoice_id: i.id }, {
              onSuccess: (r) => r.url && window.open(r.url, "_blank", "noopener"),
            })}>Vis PDF</Button>
            {(i.status === "afventer_godkendelse" || i.status === "ikke_leveret" || i.status === "klar") && (
              <Button size="sm" className="min-h-11" disabled={admin.isPending} onClick={() => admin.mutate({ action: "approve_send", invoice_id: i.id }, {
                onSuccess: (r) => toast({ title: r.ok ? "Sendt til bogholderiet" : "Ikke sendt", description: r.reason }),
                onError: () => toast({ title: "Ikke sendt", description: "Tjek at bogholderi-mail er sat under Indstillinger.", variant: "destructive" }),
              })}>Godkend og send</Button>
            )}
          </div>
        </CardContent></Card>
      ))}
      {!invoices.length && <p className="text-sm text-muted-foreground">Ingen hentede fakturaer endnu.</p>}
    </div>
  );
}

function SettingsTab() {
  const { data: s } = useIfSettings();
  const { data: requests = [] } = useIfPortalRequests();
  const update = useUpdateIfSettings();
  const addReq = useAddPortalRequest();
  const { toast } = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [days, setDays] = useState<{ run_day?: string; catchup_day?: string; expectation_day?: string }>({});
  const [req, setReq] = useState({ supplier_name: "", portal_url: "", note: "" });
  if (!s) return null;

  return (
    <div className="space-y-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Levering og kørselsdage</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="Bogholderi-mail"><Input type="email" value={email ?? s.bookkeeping_email ?? ""} onChange={(e) => setEmail(e.target.value)} placeholder="Ikke sat – intet sendes" /></Field>
          <Field label="Slettefrist for PDF (år fra fakturadato)"><Input value={String(s.retention_years)} disabled /></Field>
          <Field label="Hentedag"><Input inputMode="numeric" value={days.run_day ?? String(s.run_day)} onChange={(e) => setDays({ ...days, run_day: e.target.value })} /></Field>
          <Field label="Opsamlingsdag"><Input inputMode="numeric" value={days.catchup_day ?? String(s.catchup_day)} onChange={(e) => setDays({ ...days, catchup_day: e.target.value })} /></Field>
          <Field label="Forventningskontrol-dag"><Input inputMode="numeric" value={days.expectation_day ?? String(s.expectation_day)} onChange={(e) => setDays({ ...days, expectation_day: e.target.value })} /></Field>
          <div className="md:col-span-2"><Button className="min-h-11" disabled={update.isPending} onClick={() => update.mutate({
            bookkeeping_email: (email ?? s.bookkeeping_email ?? "").trim() || null,
            run_day: Number(days.run_day ?? s.run_day), catchup_day: Number(days.catchup_day ?? s.catchup_day), expectation_day: Number(days.expectation_day ?? s.expectation_day),
          }, { onSuccess: () => toast({ title: "Gemt" }), onError: () => toast({ title: "Kunne ikke gemme", description: "Dage skal være 1–28.", variant: "destructive" }) })}>Gem</Button></div>
        </CardContent></Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Anmod om ny portal</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Leverandør"><Input value={req.supplier_name} onChange={(e) => setReq({ ...req, supplier_name: e.target.value })} /></Field>
            <Field label="Portal-adresse"><Input type="url" inputMode="url" value={req.portal_url} onChange={(e) => setReq({ ...req, portal_url: e.target.value })} /></Field>
            <Field label="Note"><Input value={req.note} onChange={(e) => setReq({ ...req, note: e.target.value })} /></Field>
          </div>
          <Button className="min-h-11" disabled={!req.supplier_name.trim() || addReq.isPending} onClick={() => addReq.mutate(
            { supplier_name: req.supplier_name.trim(), portal_url: req.portal_url.trim() || null, note: req.note.trim() || null },
            { onSuccess: () => setReq({ supplier_name: "", portal_url: "", note: "" }) })}>Send anmodning</Button>
          {requests.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm"><Badge variant="secondary">{r.status}</Badge>{r.supplier_name}<span className="text-muted-foreground">{fmtDate(r.created_at)}</span></div>
          ))}
        </CardContent></Card>
    </div>
  );
}
