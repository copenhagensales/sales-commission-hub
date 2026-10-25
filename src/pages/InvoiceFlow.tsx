import { useEffect, useState } from "react";
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
  useAddPortalRequest, useInvoiceflowAdmin, useIfPortalCatalog, useSaveCredential, useIfLiveView,
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
                      <Badge>{src.type === "email" ? "Mail-regel" : src.type === "portal" ? `Portal (${cfg.catalog_slug ?? "?"})` : src.type}</Badge>
                      {src.is_paused && <Badge variant="destructive">Pauset{src.pause_reason ? `: ${src.pause_reason}` : ""}</Badge>}
                      {src.type !== "email" && <span className="text-muted-foreground">{cred ? `Login gemt – opdateret ${fmtDate(cred.updated_at)}` : "Intet login gemt"}</span>}
                    </div>
                    {src.type === "email" && (
                      <p className="text-sm text-muted-foreground break-words">
                        Indbakke {cfg.mailbox} · afsender {cfg.from_domain || "alle"} · emne {cfg.subject_contains || "alle"} · vedhæftning {cfg.attachment_contains || "alle PDF"}
                      </p>
                    )}
                    {src.type === "portal" && <PortalLoginForm sourceId={src.id} slug={cfg.catalog_slug} hasLogin={!!cred} />}
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

const FIELD_LABEL: Record<string, string> = { email: "E-mail", password: "Adgangskode", username: "Brugernavn" };

/** Write-only login: værdierne sendes kun til serveren og vises aldrig igen. */
function PortalLoginForm({ sourceId, slug, hasLogin }: { sourceId: string; slug?: string; hasLogin: boolean }) {
  const { data: catalog = [] } = useIfPortalCatalog();
  const save = useSaveCredential();
  const { toast } = useToast();
  const entry = catalog.find((c) => c.slug === slug);
  const fields = Array.isArray(entry?.login_fields) ? (entry!.login_fields as string[]) : [];
  const [vals, setVals] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(!hasLogin);
  if (!fields.length) return null;
  if (!open) return <Button size="sm" variant="ghost" className="min-h-11" onClick={() => setOpen(true)}>Opdatér login</Button>;
  return (
    <form className="grid gap-2 md:grid-cols-3" autoComplete="off" onSubmit={(e) => {
      e.preventDefault();
      if (fields.some((f) => !vals[f])) return;
      save.mutate({ action: "save", source_id: sourceId, fields: vals }, {
        onSuccess: () => { setVals({}); setOpen(false); toast({ title: "Login gemt" }); },
        onError: () => toast({ title: "Login kunne ikke gemmes", variant: "destructive" }),
      });
    }}>
      {fields.map((f) => (
        <Field key={f} label={FIELD_LABEL[f] ?? f}>
          <Input type={f === "password" ? "password" : f === "email" ? "email" : "text"} inputMode={f === "email" ? "email" : undefined}
            autoComplete="new-password" value={vals[f] ?? ""} onChange={(e) => setVals({ ...vals, [f]: e.target.value })} required />
        </Field>
      ))}
      <div className="flex items-end"><Button type="submit" size="sm" className="min-h-11" disabled={save.isPending}>Gem login</Button></div>
    </form>
  );
}

/** Engangskode: koden tastes KUN i Browserbases Live View-ramme. Stork har intet kodefelt. */
function CodeWaitBox({ jobId, supplier, expiresAt }: { jobId: string; supplier: string; expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const left = Math.max(0, new Date(expiresAt).getTime() - now);
  const live = useIfLiveView(jobId, left > 0);
  const admin = useInvoiceflowAdmin();
  const { toast } = useToast();
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000);
  return (
    <div className="space-y-3 border-b p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">{supplier}: portalen beder om en kode</p>
        <Badge variant={left < 120000 ? "destructive" : "secondary"}>{left ? `${mm}:${String(ss).padStart(2, "0")} tilbage` : "Udløbet"}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">Tast koden direkte i portalens side herunder. Kørslen fortsætter selv, når login er gennemført.</p>
      {live.isLoading && <div className="h-[60vh] w-full animate-pulse rounded-lg bg-muted" />}
      {live.isError && <p className="text-sm text-destructive">Live View kunne ikke hentes. Kun den, der har gemt loginnet, kan åbne den.</p>}
      {live.data?.url && left > 0 && (
        <iframe title="Portal (Live View)" src={live.data.url} className="h-[60vh] min-h-[420px] w-full rounded-lg border bg-background"
          sandbox="allow-same-origin allow-scripts allow-forms" allow="clipboard-read; clipboard-write" referrerPolicy="no-referrer" />
      )}
      <Button className="min-h-11 w-full md:w-auto" disabled={admin.isPending || !left}
        onClick={() => admin.mutate({ action: "check_code", job_id: jobId }, {
          onSuccess: (r) => toast({ title: r.ok ? "Login gennemført – kørslen fortsætter" : "Portalen venter stadig på koden" }),
          onError: () => toast({ title: "Tjek fejlede", variant: "destructive" }),
        })}>Jeg har tastet koden</Button>
    </div>
  );
}

function NewSupplierForm() {
  const create = useCreateSupplierWithSource();
  const save = useSaveCredential();
  const { data: catalog = [] } = useIfPortalCatalog();
  const { data: employeeId } = useCurrentEmployeeId();
  const { toast } = useToast();
  const [type, setType] = useState<"email" | "portal">("email");
  const [slug, setSlug] = useState("");
  const [login, setLogin] = useState<Record<string, string>>({});
  const [f, setF] = useState({ name: "", cvr: "", cadence: "monthly", expected_day: "", mailbox: "", from_domain: "", subject_contains: "", attachment_contains: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  const supported = catalog.filter((c) => c.status === "understoettet");
  const entry = supported.find((c) => c.slug === slug);
  const loginFields = Array.isArray(entry?.login_fields) ? (entry!.login_fields as string[]) : [];

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Opret leverandør</CardTitle></CardHeader>
      <CardContent>
        <form className="grid gap-3 md:grid-cols-2" autoComplete="off" onSubmit={(e) => {
          e.preventDefault();
          if (!f.name.trim()) return;
          if (type === "email" && !f.mailbox.trim()) return;
          if (type === "portal" && (!entry || loginFields.some((k) => !login[k]))) return;
          const config = type === "portal" ? { catalog_slug: entry!.slug } : {
            mailbox: f.mailbox.trim(), from_domain: f.from_domain.trim() || undefined,
            subject_contains: f.subject_contains.trim() || undefined, attachment_contains: f.attachment_contains.trim() || undefined,
          };
          create.mutate({
            supplier: { name: f.name.trim(), cvr: f.cvr.trim() || null, cadence: f.cadence, expected_day: f.expected_day ? Number(f.expected_day) : null },
            source: { type, owner_employee_id: employeeId ?? null, config },
          }, {
            onSuccess: (r) => {
              const done = () => { toast({ title: "Leverandør oprettet", description: "Godkendelse er slået til. Tryk »Test nu« for at prøve forbindelsen." }); setF({ ...f, name: "", cvr: "", from_domain: "", subject_contains: "", attachment_contains: "" }); setLogin({}); };
              if (type !== "portal") return done();
              save.mutate({ action: "save", source_id: r.sourceId, fields: login }, {
                onSuccess: done,
                onError: () => toast({ title: "Leverandør oprettet, men login blev ikke gemt", description: "Gem login på leverandøren.", variant: "destructive" }),
              });
            },
            onError: () => toast({ title: "Kunne ikke oprette", variant: "destructive" }),
          });
        }}>
          <Field label="Type">
            <Select value={type} onValueChange={(v) => setType(v as "email" | "portal")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="email">Mail-regel</SelectItem><SelectItem value="portal">Portal</SelectItem></SelectContent>
            </Select>
          </Field>
          {type === "portal" && (
            <Field label="Portal">
              <Select value={slug} onValueChange={(v) => { setSlug(v); const c = supported.find((x) => x.slug === v); if (c && !f.name) setF({ ...f, name: c.supplier_name }); }}>
                <SelectTrigger><SelectValue placeholder="Vælg portal" /></SelectTrigger>
                <SelectContent>{supported.map((c) => <SelectItem key={c.slug} value={c.slug}>{c.supplier_name}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Navn"><Input value={f.name} onChange={set("name")} required /></Field>
          <Field label="CVR"><Input value={f.cvr} onChange={set("cvr")} inputMode="numeric" /></Field>
          <Field label="Kadence">
            <Select value={f.cadence} onValueChange={(v) => setF({ ...f, cadence: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(CADENCE).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Forventet dag i måneden"><Input value={f.expected_day} onChange={set("expected_day")} inputMode="numeric" /></Field>
          {type === "email" ? (<>
            <Field label="Indbakke der læses (M365)"><Input type="email" value={f.mailbox} onChange={set("mailbox")} required /></Field>
            <Field label="Afsender-domæne"><Input value={f.from_domain} onChange={set("from_domain")} placeholder="leverandoer.dk" /></Field>
            <Field label="Emneord"><Input value={f.subject_contains} onChange={set("subject_contains")} placeholder="Faktura" /></Field>
            <Field label="Navn på vedhæftning indeholder"><Input value={f.attachment_contains} onChange={set("attachment_contains")} /></Field>
          </>) : loginFields.map((k) => (
            <Field key={k} label={FIELD_LABEL[k] ?? k}>
              <Input type={k === "password" ? "password" : k === "email" ? "email" : "text"} inputMode={k === "email" ? "email" : undefined}
                autoComplete="new-password" value={login[k] ?? ""} onChange={(e) => setLogin({ ...login, [k]: e.target.value })} required />
            </Field>
          ))}
          <div className="md:col-span-2"><Button type="submit" className="min-h-11" disabled={create.isPending || save.isPending}>Opret</Button></div>
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
          <Card key={j.id}>
          {j.status === "afventer_kode" && last?.live_view_expires_at && <CodeWaitBox jobId={j.id} supplier={nameFor(j.source_id)} expiresAt={last.live_view_expires_at} />}
          <CardContent className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 space-y-1 text-sm">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {nameFor(j.source_id)} <Badge variant={j.status === "fejlet" || j.status === "pauset" ? "destructive" : "secondary"}>{JOB_STATUS[j.status]}</Badge>
                <span className="text-muted-foreground">{j.kind} · {j.period ?? "–"} · forsøg {j.attempt}</span>
              </div>
              {last && <p className="text-muted-foreground break-words">Seneste: {fmtDate(last.started_at)} · {last.result ?? "–"} · {last.invoices_found} fakturaer{last.error_message ? ` · ${last.error_code}: ${last.error_message}` : ""}</p>}
              {j.next_attempt_at && <p className="text-muted-foreground">Næste forsøg {fmtDate(j.next_attempt_at)}</p>}
              {last?.browserbase_session_id && (
                <a className="inline-flex min-h-11 items-center text-primary underline" href={`https://www.browserbase.com/sessions/${last.browserbase_session_id}`} target="_blank" rel="noreferrer noopener">
                  Se optagelse (kræver Browserbase-login)
                </a>
              )}
            </div>
            <Button size="sm" variant="outline" className="min-h-11" disabled={admin.isPending || j.status === "koerer" || j.status === "afventer_kode"}
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
