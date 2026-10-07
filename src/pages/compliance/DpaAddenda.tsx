import { useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { SuperadminGate } from "@/components/auth/SuperadminGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, ArrowLeft, Download, FilePlus2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  useAddDpaCampaignField,
  useDownloadDpaFile,
  useDeleteDpaAddendum,
  useDpaCampaignExclusions,
  useSetDpaCampaignIncluded,
  useDpaAddendaVersions,
  useDpaCampaignFields,
  useDpaClientProfiles,
  useDpaClientsAndCampaigns,
  useDpaSubprocessors,
  useGenerateDpaAddendum,
  useRemoveDpaCampaignField,
  useSaveDpaClientProfile,
  useSaveDpaSubprocessor,
  useUpdateDpaAddendumStatus,
  useUploadSignedDpaAddendum,
  type DpaAddendum,
  type DpaAddendumStatus,
  type DpaClientProfile,
  type DpaSubprocessor,
} from "@/hooks/useDpaAddenda";
import { HOSTING_TEXT, type DpaAddendumContent } from "@/lib/compliance/dpaAddendumPdf";

const STATUS_LABEL: Record<DpaAddendumStatus, string> = {
  draft: "Kladde",
  sent: "Sendt",
  approved: "Godkendt",
  rejected: "Afvist",
  superseded: "Erstattet",
};

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("da-DK") : "—");

function errMsg(e: unknown) {
  return e instanceof Error ? e.message : "Ukendt fejl";
}

export default function DpaAddenda() {
  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Kundeaftaler – tillæg</h1>
          <p className="text-muted-foreground">
            Tillæg (allonge) til databehandleraftalen pr. kunde. Hver genereret version er låst.
          </p>
        </div>
        <SuperadminGate message="Kundeaftaler – tillæg er forbeholdt superadmins.">
          <DpaAddendaContent />
        </SuperadminGate>
      </div>
    </MainLayout>
  );
}

function DpaAddendaContent() {
  const { data: base, isLoading } = useDpaClientsAndCampaigns();
  const { data: profiles = [] } = useDpaClientProfiles();
  const { data: versions = [] } = useDpaAddendaVersions();
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.client_id, p])), [profiles]);

  if (isLoading || !base) return <p className="text-muted-foreground">Indlæser…</p>;

  if (selected) {
    const client = base.clients.find((c) => c.id === selected);
    if (client) return <ClientDetail client={client} onBack={() => setSelected(null)} />;
  }

  const rows = base.clients.filter((c) => showInactive || profileMap.get(c.id)?.is_active !== false);

  return (
    <>
      <SubprocessorEditor />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Kunder</CardTitle>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Vis inaktive
          </label>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kunde</TableHead>
                <TableHead>Kampagner</TableHead>
                <TableHead>Seneste version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sendt</TableHead>
                <TableHead>Godkendt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => {
                const v = versions.filter((x) => x.client_id === c.id);
                const latest = v[0];
                const camps = base.campaigns.filter((k) => k.client_id === c.id);
                const missing = camps.some((k) => !k.has_retention);
                const inactive = profileMap.get(c.id)?.is_active === false;
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => setSelected(c.id)}>
                    <TableCell className="font-medium">
                      {c.name} {inactive && <Badge variant="outline">Inaktiv</Badge>}
                      {missing && <AlertTriangle className="inline h-4 w-4 ml-1 text-destructive" />}
                    </TableCell>
                    <TableCell>{camps.length}</TableCell>
                    <TableCell>{latest ? `v${latest.version}` : "—"}</TableCell>
                    <TableCell>{latest ? STATUS_LABEL[latest.status as DpaAddendumStatus] : "Ingen"}</TableCell>
                    <TableCell>{fmt(latest?.sent_at ?? null)}</TableCell>
                    <TableCell>{fmt(v.find((x) => x.status === "approved")?.approved_at ?? null)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}

function SubprocessorEditor() {
  const { data: subs = [] } = useDpaSubprocessors();
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Underdatabehandlere</CardTitle>
          <CardDescription>Udfyldes manuelt. Bruges i afsnit 2 i tillægget.</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>{open ? "Luk" : "Rediger"}</Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-3">
          {subs.map((s) => <SubprocessorRow key={s.id} sub={s} />)}
        </CardContent>
      )}
    </Card>
  );
}

function SubprocessorRow({ sub }: { sub: DpaSubprocessor }) {
  const save = useSaveDpaSubprocessor();
  const [v, setV] = useState({
    registration: sub.registration ?? "",
    processing: sub.processing ?? "",
    location: sub.location ?? "",
    transfer_basis: sub.transfer_basis ?? "",
  });
  const saved = {
    registration: sub.registration ?? "",
    processing: sub.processing ?? "",
    location: sub.location ?? "",
    transfer_basis: sub.transfer_basis ?? "",
  };
  const dirty = (Object.keys(saved) as (keyof typeof saved)[]).some((k) => saved[k] !== v[k]);
  // Gemmer automatisk, når man forlader et felt.
  const persist = () => {
    if (!dirty || save.isPending) return;
    save.mutate(
      { id: sub.id, registration: v.registration.trim() || null, processing: v.processing.trim() || null, location: v.location.trim() || null, transfer_basis: v.transfer_basis.trim() || null },
      { onSuccess: () => toast.success(`${sub.name} gemt`), onError: (e) => toast.error(errMsg(e)) },
    );
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-6 gap-2 items-end border-b pb-3">
      <div className="font-medium">{sub.name}</div>
      {(["registration", "processing", "location", "transfer_basis"] as const).map((k) => (
        <div key={k}>
          <Label className="text-xs">{{ registration: "CVR/registrering", processing: "Behandling", location: "Lokation", transfer_basis: "Overførselsgrundlag" }[k]}</Label>
          <Input value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} onBlur={persist} />
        </div>
      ))}
      <span className={`text-xs ${dirty ? "text-destructive" : "text-muted-foreground"}`}>
        {save.isPending ? "Gemmer…" : dirty ? "Ikke gemt" : "Gemt"}
      </span>
    </div>
  );
}

function ClientDetail({ client, onBack }: { client: { id: string; name: string }; onBack: () => void }) {
  const { data: base } = useDpaClientsAndCampaigns();
  const { data: profiles = [] } = useDpaClientProfiles();
  const { data: subs = [] } = useDpaSubprocessors();
  const { data: fields = [] } = useDpaCampaignFields();
  const { data: allVersions = [] } = useDpaAddendaVersions();
  const { data: excluded = new Set<string>() } = useDpaCampaignExclusions();
  const saveProfile = useSaveDpaClientProfile();
  const generate = useGenerateDpaAddendum();

  const existing = profiles.find((p) => p.client_id === client.id);
  const [p, setP] = useState(() => ({
    is_active: existing?.is_active ?? true,
    legal_name: existing?.legal_name ?? "",
    cvr: existing?.cvr ?? "",
    address: existing?.address ?? "",
    original_title: existing?.original_title ?? "",
    original_date: existing?.original_date ?? "",
    approval_form: (existing?.approval_form ?? "") as "" | "general" | "specific",
    notice_days: existing?.notice_days?.toString() ?? "",
    subprocessor_ids: existing?.subprocessor_ids ?? subs.map((s) => s.id),
    other_changes: existing?.other_changes ?? "",
  }));

  const allCampaigns = (base?.campaigns ?? []).filter((k) => k.client_id === client.id);
  // Kun medtagne kampagner indgår i tillægget, advarsler og blokering.
  const campaigns = allCampaigns.filter((k) => !excluded.has(k.id));
  const noFields = campaigns.filter((k) => !fields.some((f) => f.client_campaign_id === k.id));
  const versions = allVersions.filter((v) => v.client_id === client.id);
  const missingRetention = campaigns.filter((k) => !k.has_retention);
  const fieldsConflict = campaigns.filter(
    (k) => k.has_retention && fields.some((f) => f.client_campaign_id === k.id) && k.retention_days == null,
  );

  const toRow = (): DpaClientProfile => ({
    client_id: client.id,
    is_active: p.is_active,
    legal_name: p.legal_name.trim() || null,
    cvr: p.cvr.trim() || null,
    address: p.address.trim() || null,
    original_title: p.original_title.trim() || null,
    original_date: p.original_date || null,
    approval_form: p.approval_form || null,
    notice_days: p.notice_days ? Number(p.notice_days) : null,
    subprocessor_ids: p.subprocessor_ids,
    other_changes: p.other_changes.trim() || null,
    updated_by: null,
    created_at: existing?.created_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const missingInputs = [
    !p.legal_name.trim() && "juridisk navn",
    !p.cvr.trim() && "CVR",
    !p.address.trim() && "adresse",
    !p.original_title.trim() && "databehandleraftalens titel",
    !p.original_date && "databehandleraftalens dato",
    !p.approval_form && "godkendelsesform",
    p.approval_form === "general" && !p.notice_days && "varselsperiode",
    p.subprocessor_ids.length === 0 && "underdatabehandlere",
    campaigns.length === 0 && "mindst én medtaget kampagne",
    noFields.length > 0 && `persondatafelter på ${noFields.map((k) => k.name).join(", ")} (eller fravælg kampagnen)`,
  ].filter(Boolean) as string[];

  const onSave = () => {
    const { updated_by, created_at, updated_at, ...row } = toRow();
    void updated_by; void created_at; void updated_at;
    saveProfile.mutate(row, { onSuccess: () => toast.success("Kunden er gemt"), onError: (e) => toast.error(errMsg(e)) });
  };

  const onGenerate = async () => {
    const { updated_by, created_at, updated_at, ...row } = toRow();
    void updated_by; void created_at; void updated_at;
    try {
      await saveProfile.mutateAsync(row);
      const version = (versions[0]?.version ?? 0) + 1;
      const content: DpaAddendumContent = {
        version,
        generated_at: new Date().toISOString(),
        client: { name: client.name, legal_name: p.legal_name.trim(), cvr: p.cvr.trim(), address: p.address.trim() },
        original_agreement: { title: p.original_title.trim(), date: p.original_date },
        subprocessor_approval: { form: p.approval_form as "general" | "specific", notice_days: p.notice_days ? Number(p.notice_days) : null },
        campaigns: campaigns.map((k) => ({
          name: k.name,
          fields: fields
            .filter((f) => f.client_campaign_id === k.id)
            .map((f) => (f.description?.trim() ? `${f.business_label} (${f.description.trim()})` : f.business_label)),
          retention_days: k.retention_days,
          missing_retention: !k.has_retention,
        })),
        subprocessors: subs
          .filter((s) => p.subprocessor_ids.includes(s.id))
          .map((s) => ({ name: s.name, registration: s.registration ?? "", processing: s.processing ?? "", location: s.location ?? "", transfer_basis: s.transfer_basis ?? "" })),
        hosting: HOSTING_TEXT,
        other_changes: p.other_changes.trim() || null,
      };
      await generate.mutateAsync({ clientId: client.id, version, content });
      toast.success(`Version v${version} er genereret og låst`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Alle kunder</Button>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{client.name}</h2>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={p.is_active} onCheckedChange={(v) => setP({ ...p, is_active: v })} /> Aktiv kunde
        </label>
      </div>

      {missingRetention.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Mangler opbevaringspolitik: {missingRetention.map((k) => k.name).join(", ")}. Kampagnen står som "Ikke fastsat" i tillægget.
          </AlertDescription>
        </Alert>
      )}

      {noFields.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {noFields.map((k) => k.name).join(", ")}: Kampagnen har ingen persondatafelter angivet — tilføj felter eller fjern kampagnen fra tillægget.
          </AlertDescription>
        </Alert>
      )}

      {fieldsConflict.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {fieldsConflict.map((k) => k.name).join(", ")}: Kampagnen har persondatafelter, men retentionspolitikken mangler periode — opbevaringen er ikke fastsat.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Kundeoplysninger og databehandleraftale</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <div><Label>Juridisk navn</Label><Input value={p.legal_name} onChange={(e) => setP({ ...p, legal_name: e.target.value })} /></div>
          <div><Label>CVR</Label><Input value={p.cvr} onChange={(e) => setP({ ...p, cvr: e.target.value })} /></div>
          <div className="md:col-span-2"><Label>Adresse</Label><Input value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} /></div>
          <div><Label>Databehandleraftalens titel</Label><Input value={p.original_title} onChange={(e) => setP({ ...p, original_title: e.target.value })} /></div>
          <div><Label>Databehandleraftalens dato</Label><Input type="date" value={p.original_date} onChange={(e) => setP({ ...p, original_date: e.target.value })} /></div>
          <div>
            <Label>Godkendelse af underdatabehandlere</Label>
            <RadioGroup value={p.approval_form} onValueChange={(v) => setP({ ...p, approval_form: v as "general" | "specific" })} className="mt-2">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="general" /> Generel (varsel)</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="specific" /> Specifik (forudgående godkendelse)</label>
            </RadioGroup>
          </div>
          <div><Label>Varselsperiode (dage)</Label><Input type="number" min={0} value={p.notice_days} onChange={(e) => setP({ ...p, notice_days: e.target.value })} /></div>
          <div className="md:col-span-2">
            <Label>Underdatabehandlere der behandler kundens data</Label>
            <div className="flex flex-wrap gap-4 mt-2">
              {subs.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={p.subprocessor_ids.includes(s.id)}
                    onCheckedChange={(v) =>
                      setP({ ...p, subprocessor_ids: v ? [...p.subprocessor_ids, s.id] : p.subprocessor_ids.filter((x) => x !== s.id) })
                    }
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label>Øvrige ændringer/præciseringer (valgfrit)</Label>
            <Textarea rows={3} value={p.other_changes} onChange={(e) => setP({ ...p, other_changes: e.target.value })} />
          </div>
          <div><Button variant="outline" onClick={onSave} disabled={saveProfile.isPending}>Gem kunde</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kampagner, persondatafelter og opbevaring</CardTitle>
          <CardDescription>Vælg selv de persondatafelter, der indgår pr. kampagne, med forretningsnavn (fx "Telefonnummer").</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {allCampaigns.length === 0 && <p className="text-sm text-muted-foreground">Ingen kampagner.</p>}
          {allCampaigns.map((k) => (
            <CampaignFields key={k.id} campaign={k} included={!excluded.has(k.id)} labels={fields.filter((f) => f.client_campaign_id === k.id)} />
          ))}
          <p className="text-xs text-muted-foreground">
            Fast tekst i tillægget: ingen navn, adresse, e-mail, fritekst/sælgernoter eller berigelsesdata; anonymisering er endelig efter backup-vinduet på 14 dage. Hosting: {HOSTING_TEXT}.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Versioner</CardTitle>
          <Button onClick={onGenerate} disabled={missingInputs.length > 0 || generate.isPending || saveProfile.isPending}>
            <FilePlus2 className="h-4 w-4 mr-1" /> {generate.isPending ? "Genererer…" : "Generér version"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {missingInputs.length > 0 && (
            <p className="text-sm text-muted-foreground">Mangler før generering: {missingInputs.join(", ")}.</p>
          )}
          {versions.length === 0 && <p className="text-sm text-muted-foreground">Ingen versioner endnu.</p>}
          {versions.map((v) => <VersionRow key={v.id} v={v} clientName={client.name} />)}
        </CardContent>
      </Card>
    </div>
  );
}

function CampaignFields({ campaign, included, labels }: { campaign: { id: string; name: string; retention_days: number | null; has_retention: boolean }; included: boolean; labels: { id: string; business_label: string; description: string | null }[] }) {
  const add = useAddDpaCampaignField();
  const remove = useRemoveDpaCampaignField();
  const setIncluded = useSetDpaCampaignIncluded();
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  return (
    <div className={`border rounded-md p-3 space-y-2 ${included ? "" : "opacity-60"}`}>
      <div className="flex justify-between text-sm">
        <span className="flex items-center gap-3">
          <span className="font-medium">{campaign.name}</span>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Checkbox
              checked={included}
              disabled={setIncluded.isPending}
              onCheckedChange={(v) => setIncluded.mutate({ campaignId: campaign.id, included: v === true }, { onError: (e) => toast.error(errMsg(e)) })}
            />
            Medtag i tillægget
          </label>
        </span>
        <span className={campaign.has_retention ? "text-muted-foreground" : "text-destructive"}>
          {!campaign.has_retention ? "Mangler opbevaringspolitik" : campaign.retention_days == null ? "Periode ikke fastsat" : `${campaign.retention_days} dage → irreversibel anonymisering`}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {labels.map((l) => (
          <Badge key={l.id} variant="secondary" className="gap-1">
            {l.business_label}{l.description ? ` (${l.description})` : ""}
            <button aria-label={`Fjern ${l.business_label}`} onClick={() => remove.mutate(l.id, { onError: (e) => toast.error(errMsg(e)) })}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!label.trim()) return;
          add.mutate({ campaignId: campaign.id, label, description: desc }, { onSuccess: () => { setLabel(""); setDesc(""); }, onError: (err) => toast.error(errMsg(err)) });
        }}
      >
        <Input className="h-8" placeholder="Tilføj felt, fx Mødetype" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input className="h-8" placeholder="Beskrivelse (valgfri), fx fysisk, online eller telefon" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Button type="submit" size="sm" variant="outline" disabled={add.isPending}><Plus className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function VersionRow({ v, clientName }: { v: DpaAddendum; clientName: string }) {
  const update = useUpdateDpaAddendumStatus();
  const uploadSigned = useUploadSignedDpaAddendum();
  const download = useDownloadDpaFile();
  const del = useDeleteDpaAddendum();
  const fileRef = useRef<HTMLInputElement>(null);
  const [contact, setContact] = useState(v.approved_contact ?? "");
  const [date, setDate] = useState(today());
  const onErr = (e: unknown) => toast.error(errMsg(e));
  const safeName = clientName.replace(/[^\wæøåÆØÅ-]+/g, "_");

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold">v{v.version}</span>
          <Badge variant={v.status === "approved" ? "default" : v.status === "rejected" ? "destructive" : "outline"}>
            {STATUS_LABEL[v.status as DpaAddendumStatus]}
          </Badge>
          <span className="text-xs text-muted-foreground">
            Genereret {new Date(v.created_at).toLocaleString("da-DK")} · Sendt {fmt(v.sent_at)} · Godkendt {fmt(v.approved_at)}
            {v.approved_contact ? ` (${v.approved_contact})` : ""} · Afvist {fmt(v.rejected_at)}
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => download.mutate({ path: v.pdf_path, fileName: `Tillaeg_DPA_${safeName}_v${v.version}.pdf` }, { onError: onErr })}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          {v.signed_pdf_path && (
            <Button size="sm" variant="outline" onClick={() => download.mutate({ path: v.signed_pdf_path!, fileName: `Tillaeg_DPA_${safeName}_v${v.version}_underskrevet.pdf` }, { onError: onErr })}>
              <Download className="h-4 w-4 mr-1" /> Underskrevet
            </Button>
          )}
          {v.status === "draft" && !v.sent_at && !v.approved_at && !v.signed_pdf_path && (
            <Button
              size="sm"
              variant="outline"
              disabled={del.isPending}
              onClick={() => {
                if (!window.confirm(`Slet kladde v${v.version}? Det kan ikke fortrydes.`)) return;
                del.mutate(v, { onSuccess: () => toast.success(`v${v.version} er slettet`), onError: onErr });
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Slet
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div><Label className="text-xs">Dato</Label><Input type="date" className="h-8" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: v.id, status: "sent", sent_at: date }, { onError: onErr })}>Markér sendt</Button>
        <div><Label className="text-xs">Kundens kontaktperson</Label><Input className="h-8" value={contact} onChange={(e) => setContact(e.target.value)} /></div>
        <Button size="sm" variant="outline" disabled={!contact.trim()} onClick={() => update.mutate({ id: v.id, client_id: v.client_id, status: "approved", approved_at: date, approved_contact: contact.trim() }, { onError: onErr })}>Markér godkendt</Button>
        <Button size="sm" variant="outline" onClick={() => update.mutate({ id: v.id, status: "rejected", rejected_at: date }, { onError: onErr })}>Markér afvist</Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) uploadSigned.mutate({ addendum: v, file: f }, { onSuccess: () => toast.success("Underskrevet kopi gemt"), onError: onErr });
          }}
        />
        <Button size="sm" variant="outline" disabled={uploadSigned.isPending} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" /> Upload underskrevet
        </Button>
      </div>
    </div>
  );
}
