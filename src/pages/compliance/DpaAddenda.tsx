import { useMemo, useRef, useState, type ReactNode } from "react";
import type { Database, Json } from "@/integrations/supabase/types";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, Download, Eye, FilePlus2, LogOut, MoreHorizontal, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  useAddDpaClientField,
  useRemoveDpaClientField,
  useSaveDpaClientDefault,
  useDpaClientFields,
  useCopyDpaClientDefaults,
  useDownloadDpaFile,
  useDeleteDpaAddendum,
  useDpaCampaignRetentionTexts,
  useDpaAddendaVersions,
  useDpaClientProfiles,
  useDpaClientsAndCampaigns,
  useDpaSubprocessors,
  useGenerateDpaAddendum,
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
import { HOSTING_TEXT, generateDpaAddendumPdf, type DpaAddendumContent } from "@/lib/compliance/dpaAddendumPdf";

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
    return <PartyDetail partyId={selected} anchorName={clientName(selected)} onBack={() => setSelected(null)} />;
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
type PartyInsert = Database["public"]["Tables"]["dpa_parties"]["Insert"];
type Agreement = { title: string; date: string; brand?: string | null };
type FieldLabel = { id: string; business_label: string; description: string | null };

const QUICK_FIELDS = ["Telefonnummer", "CVR-nr.", "Medlemsnummer", "Mødetype", "Ordre-/salgs-id", "Abonnementstype", "Tidspunkt for salg"];

const policyRangeOf = (camps: CampaignRow[]) => {
  const d = camps.map((k) => (k.has_retention ? k.retention_days : null)).filter((x): x is number => x != null);
  if (d.length === 0) return "ingen politik";
  const lo = Math.min(...d), hi = Math.max(...d);
  return lo === hi ? `${lo} dage` : `${lo}–${hi} dage`;
};

const focusField = (id: string) => {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  (el?.matches("input,textarea,button") ? el : el?.querySelector<HTMLElement>("input,textarea,button"))?.focus({ preventScroll: true });
};

function Step({ n, title, description, children }: { n: number; title: string; description?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">{n}. {title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function PartyDetail({ partyId, anchorName, onBack }: { partyId: string; anchorName: string; onBack: () => void }) {
  const { data: base } = useDpaClientsAndCampaigns();
  const { data: profiles = [] } = useDpaClientProfiles();
  const { data: parties = [], isLoading: partiesLoading } = useDpaParties();
  const { data: subs = [] } = useDpaSubprocessors();
  const { data: allVersions = [] } = useDpaAddendaVersions();
  const { data: clientFields = [] } = useDpaClientFields();

  if (partiesLoading || !base) return <p className="text-muted-foreground">Indlæser…</p>;
  const existing = parties.find((x) => x.id === partyId);
  const profileOf = (id: string) => profiles.find((x) => x.client_id === id);
  const partyOf = (id: string) => profileOf(id)?.party_id ?? id;
  const members = base.clients.filter((c) => partyOf(c.id) === partyId);
  const brands: BrandState[] = members.map((c) => {
    const prof = profileOf(c.id);
    return {
      client: c,
      prof,
      brand: prof?.display_name?.trim() || c.name,
      // Alle kundens kampagner er med og følger kundens standard.
      campaigns: base.campaigns.filter((k) => k.client_id === c.id) as CampaignRow[],
      fields: clientFields.filter((f) => f.client_id === c.id),
    };
  });
  return (
    <PartyForm
      partyId={partyId}
      anchorName={anchorName}
      existing={existing}
      subs={subs}
      brands={brands}
      candidates={base.clients.filter((c) => partyOf(c.id) !== partyId)}
      versions={allVersions.filter((v) => v.client_id === partyId)}
      onBack={onBack}
    />
  );
}

type BrandState = {
  client: { id: string; name: string };
  prof: DpaClientProfile | undefined;
  brand: string;
  campaigns: CampaignRow[];
  fields: FieldLabel[];
};

function PartyForm({ partyId, anchorName, existing, subs, brands, candidates, versions, onBack }: {
  partyId: string; anchorName: string; existing: DpaParty | undefined; subs: DpaSubprocessor[]; brands: BrandState[];
  candidates: { id: string; name: string }[]; versions: DpaAddendum[]; onBack: () => void;
}) {
  const saveParty = useSaveDpaParty();
  const setClientParty = useSetDpaClientParty();
  const generate = useGenerateDpaAddendum();
  const [addId, setAddId] = useState("");
  const [p, setP] = useState(() => ({
    is_active: existing?.is_active ?? true,
    legal_name: existing?.legal_name ?? "",
    cvr: existing?.cvr ?? "",
    address: existing?.address ?? "",
    approval_form: (existing?.approval_form ?? "") as "" | "general" | "specific",
    notice_days: existing?.notice_days?.toString() ?? "",
    subprocessor_ids: existing?.subprocessor_ids ?? subs.map((s) => s.id),
    other_changes: existing?.other_changes ?? "",
    agreements: (Array.isArray(existing?.agreements) && existing.agreements.length
      ? (existing.agreements as Agreement[])
      : [{ title: existing?.original_title ?? "", date: existing?.original_date ?? "", brand: null }]
    ).map((a) => ({ title: a.title ?? "", date: a.date ?? "", brand: a.brand ?? "" })),
  }));
  const lastSaved = useRef(JSON.stringify(p));

  const cleanAgreements = (s = p) => s.agreements
    .filter((a) => a.title.trim() || a.date)
    .map((a) => ({ title: a.title.trim(), date: a.date, brand: a.brand.trim() || null }));
  const toRow = (s = p): PartyInsert => {
    const ag = cleanAgreements(s);
    return {
      id: partyId,
      is_active: s.is_active,
      legal_name: s.legal_name.trim() || null,
      cvr: s.cvr.trim() || null,
      address: s.address.trim() || null,
      // Første aftale spejles i de gamle felter for bagudkompatibilitet.
      original_title: ag[0]?.title || null,
      original_date: ag[0]?.date || null,
      agreements: ag as unknown as Json,
      approval_form: s.approval_form || null,
      notice_days: s.notice_days ? Number(s.notice_days) : null,
      subprocessor_ids: s.subprocessor_ids,
      other_changes: s.other_changes.trim() || null,
    };
  };
  // Gemmer automatisk ved blur / ved valg.
  const persist = (s = p) => {
    const json = JSON.stringify(s);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    saveParty.mutate(toRow(s), { onError: (e) => toast.error(errMsg(e)) });
  };
  const update = (patch: Partial<typeof p>, save = false) => {
    const next = { ...p, ...patch };
    setP(next);
    if (save) persist(next);
  };
  const setAgreement = (i: number, patch: Partial<{ title: string; date: string; brand: string }>) =>
    update({ agreements: p.agreements.map((a, j) => (j === i ? { ...a, ...patch } : a)) });

  const ag = cleanAgreements();
  const checklist: { label: string; target: string }[] = [
    !p.legal_name.trim() && { label: "Juridisk navn", target: "f-legal" },
    !p.cvr.trim() && { label: "CVR", target: "f-cvr" },
    !p.address.trim() && { label: "Adresse", target: "f-address" },
    (ag.length === 0 || ag.some((a) => !a.title || !a.date)) && { label: "Titel og dato på databehandleraftaler", target: "f-agreements" },
    !p.approval_form && { label: "Godkendelsesform", target: "f-approval" },
    p.approval_form === "general" && !p.notice_days && { label: "Varsel", target: "f-notice" },
    brands.length === 0 && { label: "Mindst ét brand", target: "f-add-brand" },
    ...brands.map((b) => b.fields.length === 0 && { label: `Oplysninger for ${b.brand}`, target: `brand-${b.client.id}` }),
    p.subprocessor_ids.length === 0 && { label: "Underdatabehandlere", target: "f-subs" },
  ].filter(Boolean) as { label: string; target: string }[];

  const buildContent = (version: number): DpaAddendumContent => {
    const row = toRow();
    return {
      version,
      generated_at: new Date().toISOString(),
      client: { name: anchorName, legal_name: row.legal_name ?? "", cvr: row.cvr ?? "", address: row.address ?? "" },
      original_agreement: { title: row.original_title ?? "", date: row.original_date ?? "" },
      agreements: ag,
      subprocessor_approval: { form: row.approval_form as "general" | "specific", notice_days: row.notice_days ?? null },
      multi_brand: brands.length > 1,
      // Kundens standard gælder alle kundens kampagner. Kunde uden kampagner indgår med "ikke fastsat" opbevaring.
      campaigns: brands.flatMap((b) => {
        const fields = b.fields.map((f) => (f.description?.trim() ? `${f.business_label} (${f.description.trim()})` : f.business_label));
        const common = { brand: b.brand, fields, data_source: b.prof?.data_source ?? null, retention_text: b.prof?.retention_text ?? null };
        const camps = b.campaigns.length ? b.campaigns : [{ name: b.client.name, retention_days: null, has_retention: false }];
        return camps.map((k) => ({ ...common, name: k.name, retention_days: k.retention_days, missing_retention: !k.has_retention }));
      }),
      subprocessors: subs
        .filter((s) => p.subprocessor_ids.includes(s.id))
        .map((s) => ({ name: s.name, registration: s.registration ?? "", processing: s.processing ?? "", location: s.location ?? "", transfer_basis: s.transfer_basis ?? "" })),
      hosting: HOSTING_TEXT,
      other_changes: row.other_changes ?? null,
    };
  };

  const preview = () => {
    // Åbner fanen synkront (undgår popup-blokering), og fylder den med PDF'en. Intet gemmes eller låses.
    const win = window.open("", "_blank");
    try {
      const url = URL.createObjectURL(generateDpaAddendumPdf(buildContent((versions[0]?.version ?? 0) + 1)));
      if (win) win.location.href = url;
      else window.location.assign(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      win?.close();
      toast.error(errMsg(e));
    }
  };

  const onGenerate = async () => {
    try {
      await saveParty.mutateAsync(toRow());
      lastSaved.current = JSON.stringify(p);
      const version = (versions[0]?.version ?? 0) + 1;
      await generate.mutateAsync({ clientId: partyId, version, content: buildContent(version) });
      toast.success(`Version v${version} er genereret og låst`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const title = p.legal_name.trim() || anchorName;
  const others = (id: string) => brands.filter((b) => b.client.id !== id);

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" /> Alle aftaleparter</Button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="flex items-center gap-4">
          <span className="text-xs text-muted-foreground">{saveParty.isPending ? "Gemmer…" : "Ændringer gemmes automatisk"}</span>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={p.is_active} onCheckedChange={(v) => update({ is_active: v }, true)} /> Aktiv aftalepart
          </label>
        </div>
      </div>

      <div className={`rounded-lg border px-4 py-3 text-sm ${checklist.length ? "bg-muted/40" : "border-primary/40 bg-primary/5"}`}>
        {checklist.length === 0 ? (
          <span className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-4 w-4 text-primary" /> Klar til at generere</span>
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium">Mangler:</span>
            {checklist.map((c, i) => (
              <span key={c.target + c.label}>
                <button type="button" className="underline underline-offset-2 hover:text-primary" onClick={() => focusField(c.target)}>{c.label}</button>
                {i < checklist.length - 1 && ","}
              </span>
            ))}
          </div>
        )}
      </div>

      <Step n={1} title="Aftalepart" description="Den juridiske part i tillægget og de databehandleraftaler, det supplerer.">
        <div className="grid md:grid-cols-[2fr_1fr] gap-4">
          <div><Label htmlFor="f-legal">Juridisk navn</Label><Input id="f-legal" value={p.legal_name} onChange={(e) => update({ legal_name: e.target.value })} onBlur={() => persist()} /></div>
          <div><Label htmlFor="f-cvr">CVR</Label><Input id="f-cvr" value={p.cvr} onChange={(e) => update({ cvr: e.target.value })} onBlur={() => persist()} /></div>
          <div className="md:col-span-2"><Label htmlFor="f-address">Adresse</Label><Input id="f-address" value={p.address} onChange={(e) => update({ address: e.target.value })} onBlur={() => persist()} /></div>
        </div>
        <div id="f-agreements" className="space-y-2">
          <Label>Eksisterende databehandleraftaler</Label>
          {p.agreements.map((a, i) => (
            <div key={i} className="grid grid-cols-[1fr_10rem_11rem_auto] gap-2">
              <Input placeholder="Titel" value={a.title} onChange={(e) => setAgreement(i, { title: e.target.value })} onBlur={() => persist()} />
              <Input type="date" value={a.date} onChange={(e) => setAgreement(i, { date: e.target.value })} onBlur={() => persist()} />
              <Input placeholder="Brand (valgfrit)" value={a.brand} onChange={(e) => setAgreement(i, { brand: e.target.value })} onBlur={() => persist()} />
              <Button type="button" size="icon" variant="ghost" aria-label="Fjern aftale" disabled={p.agreements.length === 1} onClick={() => update({ agreements: p.agreements.filter((_, j) => j !== i) }, true)}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => update({ agreements: [...p.agreements, { title: "", date: "", brand: "" }] })}>
            <Plus className="h-4 w-4 mr-1" /> Tilføj databehandleraftale
          </Button>
        </div>
        <div className="grid md:grid-cols-[2fr_1fr] gap-4">
          <div id="f-approval">
            <Label>Godkendelse af underdatabehandlere</Label>
            <RadioGroup value={p.approval_form} onValueChange={(v) => update({ approval_form: v as "general" | "specific" }, true)} className="mt-2 flex gap-6">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="general" /> Generel (varsel)</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="specific" /> Specifik (forudgående godkendelse)</label>
            </RadioGroup>
          </div>
          <div><Label htmlFor="f-notice">Varsel (dage)</Label><Input id="f-notice" type="number" min={0} value={p.notice_days} onChange={(e) => update({ notice_days: e.target.value })} onBlur={() => persist()} /></div>
        </div>
      </Step>

      <Step n={2} title="Brands og data" description="Én række pr. brand. Alle brandets kampagner følger rækken. Felterne gemmes, når du forlader dem.">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[17%]">Brand</TableHead>
                <TableHead className="w-[33%]">Oplysninger</TableHead>
                <TableHead className="w-[22%]">Datakilde</TableHead>
                <TableHead className="w-[22%]">Opbevaring</TableHead>
                <TableHead className="w-[6%]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {brands.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-sm text-muted-foreground">Ingen brands endnu.</TableCell></TableRow>
              )}
              {brands.map((b) => (
                <BrandRow
                  key={`${b.client.id}|${b.prof?.display_name ?? ""}|${b.prof?.data_source ?? ""}|${b.prof?.retention_text ?? ""}`}
                  b={b}
                  others={others(b.client.id)}
                  isAnchor={b.client.id === partyId}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <div id="f-add-brand" className="flex gap-2 max-w-lg">
          <select className="h-9 rounded-md border bg-background px-2 text-sm flex-1" value={addId} onChange={(e) => setAddId(e.target.value)} aria-label="Vælg Stork-kunde">
            <option value="">Vælg Stork-kunde…</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button size="sm" variant="outline" disabled={!addId || setClientParty.isPending} onClick={() => {
            const name = candidates.find((c) => c.id === addId)?.name;
            setClientParty.mutate({ clientId: addId, partyId }, { onSuccess: () => { setAddId(""); toast.success(`${name} er tilføjet`); }, onError: (e) => toast.error(errMsg(e)) });
          }}>
            <Plus className="h-4 w-4 mr-1" /> Tilføj brand
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Fast tekst i tillægget: ingen navn, adresse, e-mail, fritekst/sælgernoter eller berigelsesdata; anonymisering er endelig efter backup-vinduet på 14 dage. Hosting: {HOSTING_TEXT}.
        </p>
      </Step>

      <Step n={3} title="Underdatabehandlere" description='Vælg hvilke der står i tillægget. Selve listen redigeres under "Underdatabehandlere" på oversigten.'>
        <div id="f-subs" className="flex flex-wrap gap-6">
          {subs.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={p.subprocessor_ids.includes(s.id)}
                onCheckedChange={(v) => update({ subprocessor_ids: v ? [...p.subprocessor_ids, s.id] : p.subprocessor_ids.filter((x) => x !== s.id) }, true)}
              />
              {s.name}
            </label>
          ))}
        </div>
        <div>
          <Label htmlFor="f-other">Øvrige ændringer/præciseringer (valgfrit)</Label>
          <Textarea id="f-other" rows={2} value={p.other_changes} onChange={(e) => update({ other_changes: e.target.value })} onBlur={() => persist()} />
        </div>
      </Step>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {checklist.length > 0 && <span className="text-sm text-muted-foreground">Udfyld manglerne øverst for at generere.</span>}
        <Button variant="outline" onClick={preview}><Eye className="h-4 w-4 mr-1" /> Forhåndsvis PDF</Button>
        <Button onClick={onGenerate} disabled={checklist.length > 0 || generate.isPending || saveParty.isPending}>
          <FilePlus2 className="h-4 w-4 mr-1" /> {generate.isPending ? "Genererer…" : "Generér version"}
        </Button>
      </div>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Versioner</h3>
        {versions.length === 0 && <p className="text-sm text-muted-foreground">Ingen versioner endnu.</p>}
        {versions.map((v) => <VersionRow key={v.id} v={v} clientName={title} />)}
      </section>
    </div>
  );
}

/** Én række i trin 2: et brand (Stork-kunde) med visningsnavn, oplysninger, datakilde og opbevaring. */
function BrandRow({ b, others, isAnchor }: { b: BrandState; others: BrandState[]; isAnchor: boolean }) {
  const saveName = useSaveDpaDisplayName();
  const saveDefault = useSaveDpaClientDefault();
  const remove = useRemoveDpaClientField();
  const copy = useCopyDpaClientDefaults();
  const setClientParty = useSetDpaClientParty();
  const savedName = b.prof?.display_name ?? "";
  const savedSrc = b.prof?.data_source ?? "";
  const savedRet = b.prof?.retention_text ?? "";
  const [name, setName] = useState(savedName || b.client.name);
  const [src, setSrc] = useState(savedSrc);
  const [ret, setRet] = useState(savedRet);
  const onErr = (e: unknown) => toast.error(errMsg(e));
  const persist = (key: "data_source" | "retention_text", value: string, saved: string) => {
    if (value.trim() !== saved.trim()) saveDefault.mutate({ clientId: b.client.id, key, value }, { onError: onErr });
  };
  return (
    <TableRow id={`brand-${b.client.id}`} className="align-top hover:bg-transparent">
      <TableCell>
        <Input
          className="h-8 font-medium"
          aria-label={`Visningsnavn for ${b.client.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const v = name.trim() === b.client.name ? "" : name;
            if (v.trim() !== savedName.trim()) saveName.mutate({ clientId: b.client.id, name: v }, { onError: onErr });
          }}
        />
        {name.trim() !== b.client.name && <p className="text-xs text-muted-foreground mt-1">{b.client.name}</p>}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1.5">
          {b.fields.map((l) => (
            <Badge key={l.id} variant="secondary" className="gap-1 font-normal">
              {l.business_label}{l.description ? ` (${l.description})` : ""}
              <button aria-label={`Fjern ${l.business_label}`} onClick={() => remove.mutate(l.id, { onError: onErr })}><X className="h-3 w-3" /></button>
            </Badge>
          ))}
          <AddFieldPopover clientId={b.client.id} existing={b.fields.map((f) => f.business_label)} />
        </div>
      </TableCell>
      <TableCell>
        <Input className="h-8" placeholder="fx Den dataansvarliges eget dialersystem" aria-label={`Datakilde for ${b.brand}`} value={src} onChange={(e) => setSrc(e.target.value)} onBlur={() => persist("data_source", src, savedSrc)} />
      </TableCell>
      <TableCell>
        <Input className="h-8" placeholder="Tom = fra slettepolitikken" aria-label={`Opbevaring for ${b.brand}`} value={ret} onChange={(e) => setRet(e.target.value)} onBlur={() => persist("retention_text", ret, savedRet)} />
        <p className="text-xs text-muted-foreground mt-1">Slettepolitik i Stork: {policyRangeOf(b.campaigns)}</p>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Handlinger for ${b.brand}`}><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuSub>
              <DropdownMenuSubTrigger disabled={others.length === 0}><Copy className="h-4 w-4 mr-2" /> Kopiér fra …</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {others.map((o) => (
                  <DropdownMenuItem key={o.client.id} onSelect={() => {
                    if (b.fields.length && !window.confirm(`Erstat oplysninger, datakilde og opbevaring for ${b.brand} med værdierne fra ${o.brand}?`)) return;
                    copy.mutate({ fromClientId: o.client.id, toClientId: b.client.id }, { onSuccess: () => toast.success(`Kopieret fra ${o.brand}`), onError: onErr });
                  }}>
                    {o.brand}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isAnchor}
              onSelect={() => setClientParty.mutate({ clientId: b.client.id, partyId: b.client.id }, { onSuccess: () => toast.success(`${b.client.name} er fjernet fra aftaleparten`), onError: onErr })}
            >
              <LogOut className="h-4 w-4 mr-2" /> {isAnchor ? "Aftalepartens oprindelige kunde" : "Fjern fra aftalepart"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function AddFieldPopover({ clientId, existing }: { clientId: string; existing: string[] }) {
  const add = useAddDpaClientField();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const onErr = (e: unknown) => toast.error(errMsg(e));
  const has = (l: string) => existing.some((x) => x.trim().toLowerCase() === l.toLowerCase());
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-6 px-2 text-xs rounded-full"><Plus className="h-3 w-3 mr-1" /> Tilføj</Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_FIELDS.map((q) => (
            <Button key={q} size="sm" variant="secondary" className="h-7 text-xs" disabled={has(q) || add.isPending} onClick={() => add.mutate({ clientId, label: q }, { onError: onErr })}>
              {q}
            </Button>
          ))}
        </div>
        <form
          className="space-y-2 border-t pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!label.trim()) return;
            add.mutate({ clientId, label, description: desc }, { onSuccess: () => { setLabel(""); setDesc(""); }, onError: onErr });
          }}
        >
          <Input className="h-8" placeholder="Andet felt" value={label} onChange={(e) => setLabel(e.target.value)} />
          <Input className="h-8" placeholder="Beskrivelse (valgfri)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <Button type="submit" size="sm" className="w-full" disabled={!label.trim() || add.isPending}>Tilføj felt</Button>
        </form>
      </PopoverContent>
    </Popover>
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
