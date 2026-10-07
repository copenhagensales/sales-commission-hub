import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Database } from "@/integrations/supabase/types";
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
  useAddDpaClientField,
  useRemoveDpaClientField,
  useSaveDpaClientDefault,
  useDpaClientFields,
  useDpaCampaignDeviations,
  useSetDpaCampaignDeviates,
  useDownloadDpaFile,
  useDeleteDpaAddendum,
  useDpaCampaignExclusions,
  useDpaCampaignSources,
  useSaveDpaCampaignSource,
  useDpaCampaignRetentionTexts,
  useSaveDpaCampaignRetentionText,
  useSetDpaCampaignIncluded,
  useDpaAddendaVersions,
  useDpaCampaignFields,
  useDpaClientProfiles,
  useDpaClientsAndCampaigns,
  useDpaSubprocessors,
  useGenerateDpaAddendum,
  useRemoveDpaCampaignField,
  useDpaParties,
  useSaveDpaParty,
  useSetDpaClientParty,
  useSaveDpaDisplayName,
  useSaveDpaSubprocessor,
  useUpdateDpaAddendumStatus,
  useUploadSignedDpaAddendum,
  type DpaAddendum,
  type DpaAddendumStatus,
  type DpaClientProfile,
  type DpaParty,
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
            Tillæg (allonge) til databehandleraftalen pr. aftalepart. Hver genereret version er låst.
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
  const { data: parties = [] } = useDpaParties();
  const { data: versions = [] } = useDpaAddendaVersions();
  const { data: retentionTexts = new Map<string, string>() } = useDpaCampaignRetentionTexts();
  const [showInactive, setShowInactive] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const profileMap = useMemo(() => new Map(profiles.map((p) => [p.client_id, p])), [profiles]);
  const partyMap = useMemo(() => new Map(parties.map((p) => [p.id, p])), [parties]);

  if (isLoading || !base) return <p className="text-muted-foreground">Indlæser…</p>;

  // Aftalepartens id = ankerkundens id. Kunder uden profil er deres egen aftalepart.
  const partyOf = (clientId: string) => profileMap.get(clientId)?.party_id ?? clientId;
  const members = new Map<string, { id: string; name: string }[]>();
  for (const c of base.clients) {
    const pid = partyOf(c.id);
    members.set(pid, [...(members.get(pid) ?? []), c]);
  }
  const clientName = (id: string) => base.clients.find((c) => c.id === id)?.name ?? "Ukendt";

  if (selected) {
    return <PartyDetail partyId={selected} anchorName={clientName(selected)} onBack={() => setSelected(null)} onOpen={setSelected} />;
  }

  const rows = base.clients
    .map((c) => c.id)
    .filter((id) => (members.get(id)?.length ?? 0) > 0 || versions.some((v) => v.client_id === id))
    .filter((id) => showInactive || partyMap.get(id)?.is_active !== false);

  return (
    <>
      <SubprocessorEditor />
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Aftaleparter</CardTitle>
            <CardDescription>En aftalepart er den juridiske part i tillægget og kan samle flere Stork-kunder.</CardDescription>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} /> Vis inaktive
          </label>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aftalepart</TableHead>
                <TableHead>Stork-kunder</TableHead>
                <TableHead>Kampagner</TableHead>
                <TableHead>Seneste version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sendt</TableHead>
                <TableHead>Godkendt</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((pid) => {
                const party = partyMap.get(pid);
                const mem = members.get(pid) ?? [];
                const v = versions.filter((x) => x.client_id === pid);
                const latest = v[0];
                const camps = base.campaigns.filter((k) => mem.some((m) => m.id === k.client_id));
                const missing = camps.some((k) => !k.has_retention && !retentionTexts.get(k.id));
                return (
                  <TableRow key={pid} className="cursor-pointer" onClick={() => setSelected(pid)}>
                    <TableCell className="font-medium">
                      {party?.legal_name || clientName(pid)} {party?.is_active === false && <Badge variant="outline">Inaktiv</Badge>}
                      {missing && <AlertTriangle className="inline h-4 w-4 ml-1 text-destructive" />}
                    </TableCell>
                    <TableCell>{mem.map((m) => m.name).join(", ") || "—"}</TableCell>
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

type CampaignRow = { id: string; client_id: string; name: string; retention_days: number | null; has_retention: boolean };

function PartyDetail({ partyId, anchorName, onBack, onOpen }: { partyId: string; anchorName: string; onBack: () => void; onOpen: (id: string) => void }) {
  const { data: base } = useDpaClientsAndCampaigns();
  const { data: profiles = [] } = useDpaClientProfiles();
  const { data: parties = [], isLoading: partiesLoading } = useDpaParties();
  const { data: subs = [] } = useDpaSubprocessors();
  const { data: fields = [] } = useDpaCampaignFields();
  const { data: allVersions = [] } = useDpaAddendaVersions();
  const { data: excluded = new Set<string>() } = useDpaCampaignExclusions();
  const { data: sources = new Map<string, string>() } = useDpaCampaignSources();
  const { data: retentionTexts = new Map<string, string>() } = useDpaCampaignRetentionTexts();
  const { data: clientFields = [] } = useDpaClientFields();
  const { data: deviating = new Set<string>() } = useDpaCampaignDeviations();
  const saveParty = useSaveDpaParty();
  const setClientParty = useSetDpaClientParty();
  const generate = useGenerateDpaAddendum();
  const [addId, setAddId] = useState("");

  if (partiesLoading) return <p className="text-muted-foreground">Indlæser…</p>;
  const existing = parties.find((x) => x.id === partyId);
  const profileOf = (id: string) => profiles.find((x) => x.client_id === id);
  const partyOf = (id: string) => profileOf(id)?.party_id ?? id;
  const clients = base?.clients ?? [];
  const members = clients.filter((c) => partyOf(c.id) === partyId);
  const candidates = clients.filter((c) => partyOf(c.id) !== partyId);
  const versions = allVersions.filter((v) => v.client_id === partyId);

  // Effektive værdier pr. kunde: afvigende kampagner bruger egne værdier, øvrige kundens standard.
  const perClient = members.map((c) => {
    const prof = profileOf(c.id);
    const allCampaigns = (base?.campaigns ?? []).filter((k) => k.client_id === c.id) as CampaignRow[];
    const campaigns = allCampaigns.filter((k) => !excluded.has(k.id));
    const defaultFields = clientFields.filter((f) => f.client_id === c.id);
    const effRetText = (id: string) => (deviating.has(id) ? retentionTexts.get(id) : prof?.retention_text) ?? "";
    const effHasFields = (id: string) => (deviating.has(id) ? fields.some((f) => f.client_campaign_id === id) : defaultFields.length > 0);
    return {
      client: c,
      prof,
      brand: prof?.display_name?.trim() || c.name,
      allCampaigns,
      campaigns,
      defaultFields,
      defaultEmpty: defaultFields.length === 0 && campaigns.some((k) => !deviating.has(k.id)),
      noFields: campaigns.filter((k) => deviating.has(k.id) && !fields.some((f) => f.client_campaign_id === k.id)),
      missingRetention: campaigns.filter((k) => !k.has_retention && !effRetText(k.id)),
      fieldsConflict: campaigns.filter((k) => k.has_retention && !effRetText(k.id) && effHasFields(k.id) && k.retention_days == null),
    };
  });

  return (
    <PartyForm
      key={existing?.updated_at ?? "new"}
      partyId={partyId}
      anchorName={anchorName}
      existing={existing}
      subs={subs}
      onBack={onBack}
      header={
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Stork-kunder i aftaleparten</CardTitle>
            <CardDescription>Med flere kunder får tabellen i tillægget kolonnen "Brand" med kundens visningsnavn.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm border rounded-md px-3 py-2">
                <span>{m.name}{m.id === partyId && <span className="text-muted-foreground"> · aftalepartens oprindelige kunde</span>}</span>
                {m.id !== partyId && (
                  <Button size="sm" variant="ghost" disabled={setClientParty.isPending} onClick={() => setClientParty.mutate({ clientId: m.id, partyId: m.id }, { onSuccess: () => toast.success(`${m.name} er flyttet ud til sin egen aftalepart`), onError: (e) => toast.error(errMsg(e)) })}>
                    Flyt ud
                  </Button>
                )}
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <select className="h-9 rounded-md border bg-background px-2 text-sm flex-1" value={addId} onChange={(e) => setAddId(e.target.value)}>
                <option value="">Vælg kunde…</option>
                {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <Button size="sm" variant="outline" disabled={!addId || setClientParty.isPending} onClick={() => {
                const name = clients.find((c) => c.id === addId)?.name;
                setClientParty.mutate({ clientId: addId, partyId }, { onSuccess: () => { setAddId(""); toast.success(`${name} er tilføjet til aftaleparten`); }, onError: (e) => toast.error(errMsg(e)) });
              }}>
                <Plus className="h-4 w-4 mr-1" /> Tilføj kunde til denne aftalepart
              </Button>
            </div>
            {members.length === 0 && versions.length > 0 && (
              <p className="text-sm text-muted-foreground">Ingen kunder i aftaleparten. Tidligere versioner vises nedenfor.</p>
            )}
          </CardContent>
        </Card>
      }
      clientSections={perClient.map((pc) => (
        <ClientSection key={pc.client.id} pc={pc} fields={fields} excluded={excluded} deviating={deviating} sources={sources} retentionTexts={retentionTexts} />
      ))}
      extraMissing={[
        members.length === 0 && "mindst én Stork-kunde",
        ...perClient.flatMap((pc) => [
          pc.campaigns.length === 0 && `mindst én medtaget kampagne for ${pc.brand}`,
          pc.defaultEmpty && `persondatafelter i standarden for ${pc.brand}`,
          pc.noFields.length > 0 && `persondatafelter på ${pc.noFields.map((k) => k.name).join(", ")} (eller fravælg kampagnen)`,
        ]),
      ].filter(Boolean) as string[]}
      versions={versions}
      saving={saveParty.isPending}
      generating={generate.isPending}
      onSave={(row) => saveParty.mutateAsync(row)}
      onGenerate={async (row) => {
        await saveParty.mutateAsync(row);
        const version = (versions[0]?.version ?? 0) + 1;
        const multi = perClient.length > 1;
        const content: DpaAddendumContent = {
          version,
          generated_at: new Date().toISOString(),
          client: { name: anchorName, legal_name: row.legal_name ?? "", cvr: row.cvr ?? "", address: row.address ?? "" },
          original_agreement: { title: row.original_title ?? "", date: row.original_date ?? "" },
          subprocessor_approval: { form: row.approval_form as "general" | "specific", notice_days: row.notice_days ?? null },
          multi_brand: multi,
          campaigns: perClient.flatMap((pc) =>
            pc.campaigns.map((k) => {
              const own = deviating.has(k.id);
              const src = own ? fields.filter((f) => f.client_campaign_id === k.id) : pc.defaultFields;
              return {
                name: k.name,
                brand: pc.brand,
                fields: src.map((f) => (f.description?.trim() ? `${f.business_label} (${f.description.trim()})` : f.business_label)),
                data_source: own ? sources.get(k.id) ?? null : pc.prof?.data_source ?? null,
                retention_days: k.retention_days,
                retention_text: own ? retentionTexts.get(k.id) ?? null : pc.prof?.retention_text ?? null,
                missing_retention: !k.has_retention,
              };
            }),
          ),
          subprocessors: subs
            .filter((s) => (row.subprocessor_ids ?? []).includes(s.id))
            .map((s) => ({ name: s.name, registration: s.registration ?? "", processing: s.processing ?? "", location: s.location ?? "", transfer_basis: s.transfer_basis ?? "" })),
          hosting: HOSTING_TEXT,
          other_changes: row.other_changes ?? null,
        };
        await generate.mutateAsync({ clientId: partyId, version, content });
        return version;
      }}
    />
  );
}

type PartyInsert = Database["public"]["Tables"]["dpa_parties"]["Insert"];

function PartyForm({ partyId, anchorName, existing, subs, onBack, header, clientSections, extraMissing, versions, saving, generating, onSave, onGenerate }: {
  partyId: string; anchorName: string; existing: DpaParty | undefined; subs: DpaSubprocessor[]; onBack: () => void;
  header: ReactNode; clientSections: ReactNode[]; extraMissing: string[]; versions: DpaAddendum[];
  saving: boolean; generating: boolean; onSave: (row: PartyInsert) => Promise<void>; onGenerate: (row: PartyInsert) => Promise<number>;
}) {
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
  const toRow = (): PartyInsert => ({
    id: partyId,
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
    ...extraMissing,
  ].filter(Boolean) as string[];
  const title = p.legal_name.trim() || anchorName;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Alle aftaleparter</Button>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{title}</h2>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={p.is_active} onCheckedChange={(v) => setP({ ...p, is_active: v })} /> Aktiv aftalepart
        </label>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Aftalepart og databehandleraftale</CardTitle></CardHeader>
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
            <Label>Underdatabehandlere</Label>
            <div className="flex flex-wrap gap-4 mt-2">
              {subs.map((s) => (
                <label key={s.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={p.subprocessor_ids.includes(s.id)}
                    onCheckedChange={(v) => setP({ ...p, subprocessor_ids: v ? [...p.subprocessor_ids, s.id] : p.subprocessor_ids.filter((x) => x !== s.id) })}
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
          <div>
            <Button variant="outline" disabled={saving} onClick={() => onSave(toRow()).then(() => toast.success("Aftaleparten er gemt"), (e) => toast.error(errMsg(e)))}>
              Gem aftalepart
            </Button>
          </div>
        </CardContent>
      </Card>

      {header}
      {clientSections}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Versioner</CardTitle>
          <Button
            onClick={() => onGenerate(toRow()).then((v) => toast.success(`Version v${v} er genereret og låst`), (e) => toast.error(errMsg(e)))}
            disabled={missingInputs.length > 0 || generating || saving}
          >
            <FilePlus2 className="h-4 w-4 mr-1" /> {generating ? "Genererer…" : "Generér version"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {missingInputs.length > 0 && <p className="text-sm text-muted-foreground">Mangler før generering: {missingInputs.join(", ")}.</p>}
          {versions.length === 0 && <p className="text-sm text-muted-foreground">Ingen versioner endnu.</p>}
          {versions.map((v) => <VersionRow key={v.id} v={v} clientName={title} />)}
        </CardContent>
      </Card>
    </div>
  );
}

type ClientState = {
  client: { id: string; name: string };
  prof: DpaClientProfile | undefined;
  brand: string;
  allCampaigns: CampaignRow[];
  campaigns: CampaignRow[];
  defaultFields: { id: string; business_label: string; description: string | null }[];
  defaultEmpty: boolean;
  noFields: CampaignRow[];
  missingRetention: CampaignRow[];
  fieldsConflict: CampaignRow[];
};

/** Én Stork-kunde inden for aftaleparten: visningsnavn, standard og kampagner. */
function ClientSection({ pc, fields, excluded, deviating, sources, retentionTexts }: {
  pc: ClientState; fields: { id: string; client_campaign_id: string; business_label: string; description: string | null }[];
  excluded: Set<string>; deviating: Set<string>; sources: Map<string, string>; retentionTexts: Map<string, string>;
}) {
  const saveName = useSaveDpaDisplayName();
  const savedName = pc.prof?.display_name ?? "";
  const [name, setName] = useState(savedName || pc.client.name);
  const policyDays = pc.campaigns.map((k) => (k.has_retention ? k.retention_days : null)).filter((d): d is number => d != null);
  const policyRange = policyDays.length === 0
    ? "ingen politik"
    : Math.min(...policyDays) === Math.max(...policyDays)
      ? `${policyDays[0]} dage`
      : `${Math.min(...policyDays)}–${Math.max(...policyDays)} dage`;
  const warn = (text: string) => (
    <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription>{text}</AlertDescription></Alert>
  );
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-lg font-semibold">{pc.client.name}</h3>
        <div className="w-72">
          <Label className="text-xs">Visningsnavn i tillægget</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              const v = name.trim() === pc.client.name ? "" : name;
              if (v.trim() === savedName.trim()) return;
              saveName.mutate({ clientId: pc.client.id, name: v }, { onSuccess: () => toast.success("Visningsnavn gemt"), onError: (e) => toast.error(errMsg(e)) });
            }}
          />
        </div>
      </div>
      {pc.missingRetention.length > 0 && warn(`Mangler opbevaringspolitik: ${pc.missingRetention.map((k) => k.name).join(", ")}. Kampagnen står som "Ikke fastsat" i tillægget.`)}
      {pc.defaultEmpty && warn('Kundens standard har ingen persondatafelter angivet — tilføj felter under "Persondata i Stork".')}
      {pc.noFields.length > 0 && warn(`${pc.noFields.map((k) => k.name).join(", ")}: Kampagnen afviger fra standard, men har ingen persondatafelter angivet — tilføj felter, slå afvigelsen fra eller fjern kampagnen fra tillægget.`)}
      {pc.fieldsConflict.length > 0 && warn(`${pc.fieldsConflict.map((k) => k.name).join(", ")}: Kampagnen har persondatafelter, men retentionspolitikken mangler periode — opbevaringen er ikke fastsat.`)}
      <ClientDefaults
        key={`${pc.prof?.data_source ?? ""}|${pc.prof?.retention_text ?? ""}`}
        clientId={pc.client.id}
        source={pc.prof?.data_source ?? ""}
        retentionText={pc.prof?.retention_text ?? ""}
        labels={pc.defaultFields}
        policyRange={policyRange}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kampagner</CardTitle>
          <CardDescription>Kampagner følger kundens standard. Sæt "Afviger fra standard" for at angive kampagnens egne felter, datakilde og opbevaring.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {pc.allCampaigns.length === 0 && <p className="text-sm text-muted-foreground">Ingen kampagner.</p>}
          {pc.allCampaigns.map((k) => (
            <CampaignFields key={k.id} campaign={k} included={!excluded.has(k.id)} deviates={deviating.has(k.id)} source={sources.get(k.id) ?? ""} retentionText={retentionTexts.get(k.id) ?? ""} labels={fields.filter((f) => f.client_campaign_id === k.id)} />
          ))}
          <p className="text-xs text-muted-foreground">
            Fast tekst i tillægget: ingen navn, adresse, e-mail, fritekst/sælgernoter eller berigelsesdata; anonymisering er endelig efter backup-vinduet på 14 dage. Hosting: {HOSTING_TEXT}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const policyText = (k: { has_retention: boolean; retention_days: number | null }) =>
  k.has_retention && k.retention_days != null ? `${k.retention_days} dage` : "ingen politik";

/** Kundens standard: felter, datakilde og opbevaring, der gælder alle ikke-afvigende kampagner. */
function ClientDefaults({ clientId, source, retentionText, labels, policyRange }: { clientId: string; source: string; retentionText: string; labels: { id: string; business_label: string; description: string | null }[]; policyRange: string }) {
  const add = useAddDpaClientField();
  const remove = useRemoveDpaClientField();
  const saveDefault = useSaveDpaClientDefault();
  const [src, setSrc] = useState(source);
  const [ret, setRet] = useState(retentionText);
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const persist = (key: "data_source" | "retention_text", value: string, saved: string, msg: string) => {
    if (value.trim() === saved.trim()) return;
    saveDefault.mutate({ clientId, key, value }, { onSuccess: () => toast.success(msg), onError: (e) => toast.error(errMsg(e)) });
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Persondata i Stork</CardTitle>
        <CardDescription>Kundens standard. Gælder alle medtagne kampagner, der ikke er sat til at afvige.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {labels.length === 0 && <span className="text-sm text-muted-foreground">Ingen felter endnu.</span>}
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
            add.mutate({ clientId, label, description: desc }, { onSuccess: () => { setLabel(""); setDesc(""); }, onError: (err) => toast.error(errMsg(err)) });
          }}
        >
          <Input className="h-8" placeholder="Tilføj felt, fx Mødetype" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input className="h-8" placeholder="Beskrivelse (valgfri), fx fysisk, online eller telefon" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button type="submit" size="sm" variant="outline" disabled={add.isPending}><Plus className="h-4 w-4" /></Button>
        </form>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Datakilde</Label>
            <Input placeholder="fx Den dataansvarliges eget dialersystem" value={src} onChange={(e) => setSrc(e.target.value)} onBlur={() => persist("data_source", src, source, "Datakilde gemt")} />
          </div>
          <div>
            <Label>Opbevaring (tekst i tillægget)</Label>
            <Input placeholder="Tom = beregnes fra slettepolitikken" value={ret} onChange={(e) => setRet(e.target.value)} onBlur={() => persist("retention_text", ret, retentionText, "Opbevaring gemt")} />
            <p className="text-xs text-muted-foreground mt-1">Slettepolitik i Stork: {policyRange}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CampaignFields({ campaign, included, deviates, source, retentionText, labels }: { campaign: { id: string; name: string; retention_days: number | null; has_retention: boolean }; included: boolean; deviates: boolean; source: string; retentionText: string; labels: { id: string; business_label: string; description: string | null }[] }) {
  const add = useAddDpaCampaignField();
  const remove = useRemoveDpaCampaignField();
  const setIncluded = useSetDpaCampaignIncluded();
  const setDeviates = useSetDpaCampaignDeviates();
  const saveSource = useSaveDpaCampaignSource();
  const saveRetention = useSaveDpaCampaignRetentionText();
  const [src, setSrc] = useState(source);
  const [ret, setRet] = useState(retentionText);
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const header = (
    <div className="flex flex-wrap justify-between gap-2 text-sm">
      <span className="flex flex-wrap items-center gap-3">
        <span className="font-medium">{campaign.name}</span>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={included}
            disabled={setIncluded.isPending}
            onCheckedChange={(v) => setIncluded.mutate({ campaignId: campaign.id, included: v === true }, { onError: (e) => toast.error(errMsg(e)) })}
          />
          Medtag i tillægget
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Checkbox
            checked={deviates}
            disabled={setDeviates.isPending}
            onCheckedChange={(v) => setDeviates.mutate({ campaignId: campaign.id, deviates: v === true }, { onError: (e) => toast.error(errMsg(e)) })}
          />
          Afviger fra standard
        </label>
      </span>
      <span className={campaign.has_retention ? "text-muted-foreground" : "text-destructive"}>
        Slettepolitik: {policyText(campaign)}
      </span>
    </div>
  );
  if (!deviates) {
    return <div className={`border rounded-md px-3 py-2 ${included ? "" : "opacity-60"}`}>{header}</div>;
  }
  return (
    <div className={`border rounded-md p-3 space-y-2 ${included ? "" : "opacity-60"}`}>
      {header}
      <div className="flex flex-wrap gap-2">
        {labels.map((l) => (
          <Badge key={l.id} variant="secondary" className="gap-1">
            {l.business_label}{l.description ? ` (${l.description})` : ""}
            <button aria-label={`Fjern ${l.business_label}`} onClick={() => remove.mutate(l.id, { onError: (e) => toast.error(errMsg(e)) })}><X className="h-3 w-3" /></button>
          </Badge>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-xs shrink-0">Datakilde</Label>
        <Input
          className="h-8"
          placeholder="fx Den dataansvarliges eget dialersystem"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          onBlur={() => {
            if (src.trim() === source.trim()) return;
            saveSource.mutate({ campaignId: campaign.id, source: src }, { onSuccess: () => toast.success("Datakilde gemt"), onError: (e) => toast.error(errMsg(e)) });
          }}
        />
        <Label className="text-xs shrink-0">Opbevaring (tekst i tillægget)</Label>
        <Input
          className="h-8"
          placeholder="Tom = beregnes fra slettepolitikken"
          value={ret}
          onChange={(e) => setRet(e.target.value)}
          onBlur={() => {
            if (ret.trim() === retentionText.trim()) return;
            saveRetention.mutate({ campaignId: campaign.id, text: ret }, { onSuccess: () => toast.success("Opbevaring gemt"), onError: (e) => toast.error(errMsg(e)) });
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground text-right">
        Slettepolitik i Stork: {campaign.has_retention && campaign.retention_days != null ? `${campaign.retention_days} dage` : "ingen politik"}
      </p>
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
