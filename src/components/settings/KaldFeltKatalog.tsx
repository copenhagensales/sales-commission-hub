import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Database as DatabaseIcon, Loader2 } from "lucide-react";
import { ResponsiveTable } from "@/components/mobile/ResponsiveTable";
import { SletteregelDialog, type ProevSnapshot, type SletteregelDialogMaal } from "@/components/integrationer/SletteregelDialog";
import { BeskyttelseDialog } from "@/components/integrationer/BeskyttelseDialog";
import { AendringInfo, Historik, erPersonfoelsom, useSletteregelRedigering } from "@/components/integrationer/sletteregelDele";
import { BESKYTTELSE_NOEGLE, useErEjerDb, useFlytRest, useNoegleBrugere, useNoegleRoller, useSletteregelAendringer, useSletteregelNavne, type BeskyttelseTilstand, type SletteregelAendring } from "@/hooks/useSletteregler";
import {
  KATALOG_ENDPOINTS,
  KATALOG_KLASSIFIKATIONER,
  daekningNoegle,
  useKaldFeltDaekning,
  useKaldFeltKatalog,
  useOpdaterKatalogFelt,
  type Daekning,
  type KatalogFelt,
  type KatalogKlassifikation,
} from "@/hooks/useKaldFeltKatalog";

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  aktiv: { label: "Aktiv", variant: "default" },
  inaktiv: { label: "Fravalgt", variant: "secondary" },
  forslag: { label: "Forslag", variant: "outline" },
  skabelon: { label: "Skabelon", variant: "outline" },
};

const DAEKNING_DAGE = 7;
type Visning = "alle" | "hentes" | "undlades" | "afventer" | "personfoelsom" | "beskyttet";
const BESKYTTELSE_LABEL: Record<BeskyttelseTilstand, { label: string; variant: "default" | "secondary" | "outline" }> = { ingen: { label: "–", variant: "outline" }, flytter: { label: "aktiverer", variant: "secondary" }, beskyttet: { label: "beskyttet", variant: "default" }, ophaever: { label: "ophæves", variant: "secondary" } };

function maalTekst(f: KatalogFelt): string {
  if (f.maal_kolonne) return `${f.maal_tabel}.${f.maal_kolonne}`;
  if (f.metadata_noegle) return `${f.maal_tabel}.${f.maal_tabel === "dialer_leads" ? "felter" : "metadata"}.${f.metadata_noegle}`;
  return "gemmes ikke";
}
const spaerret = (f: KatalogFelt, laast: boolean) => laast || f.status === "skabelon";

function DaekningCelle({ felt, daekning }: { felt: KatalogFelt; daekning?: Map<string, Daekning> }) {
  const n = daekningNoegle(felt);
  const d = n && daekning ? daekning.get(n) : undefined;
  if (!n) return <span className="text-xs text-muted-foreground">–</span>;
  if (!d || d.total === 0) return <span className="text-xs text-muted-foreground">0 rækker</span>;
  const pct = Math.round((d.antal / d.total) * 100);
  return (
    <span className={`text-xs ${pct === 0 ? "text-muted-foreground" : ""}`}>
      {d.antal.toLocaleString("da-DK")}/{d.total.toLocaleString("da-DK")} <span className="text-muted-foreground">({pct} %)</span>
    </span>
  );
}

function HentesCelle({ felt, laast }: { felt: KatalogFelt; laast: boolean }) {
  const opdater = useOpdaterKatalogFelt();
  return <Switch checked={felt.hentes} disabled={spaerret(felt, laast) || opdater.isPending} onCheckedChange={(v) => opdater.mutate({ id: felt.id, aendring: { hentes: v, status: v ? "aktiv" : "inaktiv" } })} aria-label={`Hent ${felt.felt_navn}`} />;
}

function KlassCelle({ felt, laast }: { felt: KatalogFelt; laast: boolean }) {
  const opdater = useOpdaterKatalogFelt();
  return (
    <Select value={felt.klassifikation} disabled={spaerret(felt, laast) || opdater.isPending} onValueChange={(v) => opdater.mutate({ id: felt.id, aendring: { klassifikation: v as KatalogKlassifikation } })}>
      <SelectTrigger className="h-9 w-[170px] text-xs sm:h-8" aria-label={`Klassifikation ${felt.felt_navn}`}><SelectValue /></SelectTrigger>
      <SelectContent>{KATALOG_KLASSIFIKATIONER.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function BegrundelseCelle({ felt, laast }: { felt: KatalogFelt; laast: boolean }) {
  const opdater = useOpdaterKatalogFelt();
  const [begrundelse, setBegrundelse] = useState<string>(felt.begrundelse ?? "");
  return (
    <Input className="h-9 w-56 max-w-full text-xs sm:h-8" placeholder="Begrundelse" value={begrundelse} disabled={spaerret(felt, laast) || opdater.isPending} aria-label={`Begrundelse ${felt.felt_navn}`}
      onChange={(e) => setBegrundelse(e.target.value)}
      onBlur={() => { const ny = begrundelse.trim() === "" ? null : begrundelse.trim(); if (ny !== (felt.begrundelse ?? null)) opdater.mutate({ id: felt.id, aendring: { begrundelse: ny } }); }} />
  );
}

/** Sletteregel pr. kolonne: gældende frist, åben ændring (kladde/prøvet/godkendt) og aktiveringshistorik (seneste 5). »Ret frist« ligger under handlinger. */
function FristCelle({ felt, aaben, historik, navne, kanSe }: { felt: KatalogFelt; aaben?: SletteregelAendring; historik: SletteregelAendring[]; navne: Map<string, string>; kanSe: boolean }) {
  const [visHistorik, setVisHistorik] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1 text-xs sm:items-start">
      <div>{felt.retention_dage == null ? <span className="text-muted-foreground">kampagnens</span> : <span className="font-medium">{felt.retention_dage} d</span>}</div>
      {kanSe && aaben && <AendringInfo a={aaben} />}
      {kanSe && historik.length > 0 && (
        <button type="button" className="min-h-[24px] text-xs text-muted-foreground underline" onClick={() => setVisHistorik((v) => !v)}>{visHistorik ? "Skjul historik" : `Historik (${historik.length})`}</button>
      )}
      {kanSe && visHistorik && <Historik rader={historik} navne={navne} />}
    </div>
  );
}

export interface KaldFeltKatalogProps {
  /** API-nøgle (api_register.noegle). Uden: alle kilder. */
  kilde?: string;
  /** Låst API (Integrationer-siden): kataloget vises, men kan ikke ændres. */
  laast?: boolean;
  /** Vises som fane på en API-underside (kortere titel/tekst). */
  indlejret?: boolean;
  /** Kontoens kampagner (med data): kampagnefelter for andre kampagner skjules, til »Vis kampagnefelter uden data« slås til (fælles felter vises altid). */
  kampagner?: string[];
}

/**
 * Kolonnerne (plan v2.5 F1b + SR3 krav 1): ét sted pr. API – hvad en API leverer, hvor det gemmes, om det hentes, klassifikation
 * (personfølsom foreslår beskyttelse), sletteregel pr. kolonne (SR1-livscyklus via SletteregelDialog) og dækning. Kun ejer/superadmin kan gemme (RLS).
 * Sletteregel-ændringer læses kun med rettighedsnøglen (kanSe); databasen afgør endeligt (RLS teamleder+, skriveret ejer/superadmin, aktivering superadmin).
 */
export function KaldFeltKatalog({ kilde, laast = false, indlejret = false, kampagner }: KaldFeltKatalogProps) {
  const { data, isLoading, error } = useKaldFeltKatalog(kilde);
  const { data: daekning } = useKaldFeltDaekning(DAEKNING_DAGE);
  const { kanRedigere, kanSe, isSuperadmin } = useSletteregelRedigering(!laast);
  const aendringerQ = useSletteregelAendringer(kanSe);
  const { data: navne = new Map<string, string>() } = useSletteregelNavne(kanSe);
  const [soeg, setSoeg] = useState("");
  const [visning, setVisning] = useState<Visning>("alle");
  const [visUdenData, setVisUdenData] = useState(false);
  const [dialog, setDialog] = useState<SletteregelDialogMaal | null>(null);
  const [snapshots, setSnapshots] = useState<Map<string, ProevSnapshot>>(new Map());
  const gemSnapshot = (id: string, s: ProevSnapshot) => setSnapshots((m) => new Map(m).set(id, s));

  // Codex SR3a r1 P2: ingen »Ret frist«, før ændringerne er læst – ellers kan en eksisterende ændring overses, fordi den ikke kunne hentes
  const kanRetteFrist = kanRedigere && kanSe && aendringerQ.isSuccess;
  const aendringer = useMemo(() => (kanSe ? aendringerQ.data ?? [] : []), [kanSe, aendringerQ.data]);
  const aabenFor = (katalogId: string) => aendringer.find((a) => a.status !== "aktiv" && a.katalog_id === katalogId && a.aendring_type === "frist");
  const aabenBeskytFor = (katalogId: string) => aendringer.find((a) => a.status !== "aktiv" && a.katalog_id === katalogId && a.aendring_type !== "frist");
  const [beskytDialog, setBeskytDialog] = useState<{ felt: KatalogFelt; retning: "beskyt" | "ophaev" } | null>(null);
  const beskytFelt = beskytDialog ? (data ?? []).find((f) => f.id === beskytDialog.felt.id) ?? beskytDialog.felt : null;
  const rollerQ = useNoegleRoller(BESKYTTELSE_NOEGLE, kanSe);
  const erEjerDb = useErEjerDb();
  const brugereQ = useNoegleBrugere(BESKYTTELSE_NOEGLE, rollerQ.data, kanSe && erEjerDb.data === true);  // tallet er kun retvisende for ejere (RLS: kun ejere læser alle grants/denies og system_roles) – Codex UI r3
  const flytKolonner = useMemo(() => (data ?? []).filter((f) => f.beskyttelse === "flytter" || f.beskyttelse === "ophaever").map((f) => ({ id: f.id, retning: f.beskyttelse as string, siden: f.beskyttelse_aendret })), [data]);
  const flytRestQ = useFlytRest(flytKolonner, kanSe);
  const historikFor = (katalogId: string) => aendringer.filter((a) => a.status === "aktiv" && a.katalog_id === katalogId && a.aendring_type === "frist").sort((a, b) => (b.aktiveret ?? "").localeCompare(a.aktiveret ?? ""));  // frist-historik (beskyttelse vises i Beskyttet-cellen)
  const aabenAlleFor = (katalogId: string) => aendringer.find((a) => a.status !== "aktiv" && a.katalog_id === katalogId);  // én åben ændring pr. mål uanset type (databasen håndhæver)
  const retFrist = (f: KatalogFelt) => setDialog({ maal: { maal: "kolonne", katalog_id: f.id }, titel: f.felt_navn, gaeldende: f.retention_dage, kampagner: [], klientkampagner: [] });
  const dialogKatalogId = dialog ? (dialog.maal as { katalog_id: string }).katalog_id : null;
  // dialogens gældende frist genberegnes fra aktuelle data (Codex SR2 r2 P1-1)
  const dialogLive = useMemo<SletteregelDialogMaal | null>(() => {
    if (!dialog || !dialogKatalogId) return dialog;
    const f = (data ?? []).find((x) => x.id === dialogKatalogId);
    return { ...dialog, gaeldende: f?.retention_dage ?? null };
  }, [dialog, dialogKatalogId, data]);

  // Codex SR3a r1 P1: kampagnefelter for kampagner, porten endnu ikke har hentet data for, kan vises (frister kan sættes før første import)
  const udenData = (f: KatalogFelt) => !!(kampagner && f.kampagne_ekstern_id && !kampagner.includes(f.kampagne_ekstern_id));
  const antalUdenData = useMemo(() => (data ?? []).filter(udenData).length, [data, kampagner]);  // eslint-disable-line react-hooks/exhaustive-deps
  const prEndpoint = useMemo(() => {
    const m = new Map<string, KatalogFelt[]>();
    const q = soeg.trim().toLowerCase();
    for (const f of data ?? []) {
      if (!visUdenData && udenData(f)) continue;
      if (visning === "hentes" && !f.hentes) continue;
      if (visning === "undlades" && f.hentes) continue;
      if (visning === "afventer" && f.status !== "forslag") continue;
      if (visning === "personfoelsom" && !erPersonfoelsom(f.klassifikation)) continue;
      if (visning === "beskyttet" && f.beskyttelse === "ingen") continue;
      if (q && !`${f.felt_navn} ${f.felt_sti} ${f.beskrivelse ?? ""} ${f.metadata_noegle ?? ""} ${f.maal_kolonne ?? ""} ${f.kampagne_ekstern_id ?? ""}`.toLowerCase().includes(q)) continue;
      const liste = m.get(f.endpoint) ?? [];
      liste.push(f);
      m.set(f.endpoint, liste);
    }
    return m;
  }, [data, soeg, kampagner, visning, visUdenData]);  // eslint-disable-line react-hooks/exhaustive-deps

  const synlige = useMemo(() => (data ?? []).filter((f) => visUdenData || !udenData(f)), [data, kampagner, visUdenData]);  // eslint-disable-line react-hooks/exhaustive-deps
  const endpoints = useMemo(() => {
    const kendte = KATALOG_ENDPOINTS.filter((e) => (data ?? []).some((f) => f.endpoint === e.endpoint));
    const kendteNavne = kendte.map((e) => e.endpoint);
    const ekstra = [...new Set((data ?? []).map((f) => f.endpoint))].filter((e) => !kendteNavne.includes(e)).map((e) => ({ endpoint: e, label: e }));
    return [...kendte, ...ekstra];
  }, [data]);

  const total = synlige.length;
  const hentes = synlige.filter((f) => f.hentes).length;
  const uklassificeret = synlige.filter((f) => f.klassifikation === "ukendt").length;
  const personfoelsomme = synlige.filter((f) => erPersonfoelsom(f.klassifikation)).length;
  const medFrist = synlige.filter((f) => f.retention_dage != null).length;
  const beskyttede = synlige.filter((f) => f.beskyttelse !== "ingen").length;

  const kolonner = [
    { key: "kolonne", header: "Kolonne", isTitle: true, cell: (f: KatalogFelt) => (
      <div>
        <div className="font-medium">{f.felt_navn}</div>
        <div className="text-xs text-muted-foreground font-mono">{f.felt_sti}{f.kampagne_ekstern_id && <span className="ml-1">· kampagne {f.kampagne_ekstern_id}{udenData(f) ? " (uden data endnu)" : ""}</span>}</div>
        {f.beskrivelse && <div className="text-xs text-muted-foreground mt-1 max-w-md">{f.beskrivelse}</div>}
        {f.felt_sti.startsWith("afledt:") && f.afledt_af.length > 0 && <div className="text-xs text-muted-foreground mt-1">Afledt af: {f.afledt_af.join(", ")}</div>}
      </div>
    ) },
    { key: "hentes", header: "Hentes", isKey: true, cell: (f: KatalogFelt) => <HentesCelle felt={f} laast={laast} /> },
    { key: "klass", header: "Klassifikation", isKey: true, cell: (f: KatalogFelt) => <KlassCelle felt={f} laast={laast} /> },
    { key: "beskyttet", header: "Beskyttet", isKey: true, cell: (f: KatalogFelt) => {
      const t = (f.beskyttelse ?? "ingen") as BeskyttelseTilstand; const b = aabenBeskytFor(f.id); const rest = flytRestQ.data?.get(f.id);
      return (
        <div className="flex flex-col items-start gap-1 text-xs">
          {t === "ingen"
            ? (erPersonfoelsom(f.klassifikation)
              ? <Badge variant="outline" title="Personfølsom kolonne (personoplysning, identifikator eller følsom) – foreslås beskyttet: værdierne flyttes til en lukket tabel, kun brugere med nøglen »se beskyttede kaldsfelter« kan slå dem op, og opslag logges.">foreslået</Badge>
              : <span className="text-muted-foreground">–</span>)
            : <Badge variant={BESKYTTELSE_LABEL[t].variant} title={t === "beskyttet" ? "Værdierne ligger i den lukkede tabel; opslag kræver nøglen og logges." : "Flytningen kører i baggrunden (batches hvert 2. minut)."}>{BESKYTTELSE_LABEL[t].label}{(t === "flytter" || t === "ophaever") ? (rest && rest.rest != null ? ` – ${rest.rest.toLocaleString("da-DK")} tilbage` : " – resttal kendes efter næste kørsel") : ""}</Badge>}
          {(t === "flytter" || t === "ophaever") && rest?.fejl && <span className="text-destructive" title={rest.fejl}>seneste kørsel fejlede – prøves igen</span>}
          {b && <AendringInfo a={b} />}
        </div>
      );
    } },
    { key: "sletteregel", header: "Sletteregel", isKey: true, cell: (f: KatalogFelt) => <FristCelle felt={f} aaben={aabenFor(f.id)} historik={historikFor(f.id)} navne={navne} kanSe={kanSe} /> },
    { key: "adgang", header: "Adgang", cell: (f: KatalogFelt) => (f.beskyttelse ?? "ingen") === "ingen"
      ? <span className="text-xs text-muted-foreground">som kaldsdata (manager og opefter)</span>
      : <span className="text-xs" title="Roller med nøglen »se beskyttede kaldsfelter« (role_page_permissions) + antal aktive brugere (rolle, personlige grants/denies, ejer). Rettes under Administration › Rettigheder.">
          {!kanSe ? "nøgle: (kræver sletteregel-adgang)" : rollerQ.isLoading ? "nøgle: indlæser …" : rollerQ.isError ? "nøgle: kunne ikke hentes" : rollerQ.data?.length ? `nøgle: ${rollerQ.data.join(", ")}` : "nøgle: ingen roller"}
          {kanSe && brugereQ.isSuccess ? ` · ${brugereQ.data} ${brugereQ.data === 1 ? "bruger" : "brugere"}` : kanSe && erEjerDb.data !== true ? " · antal brugere: kun for ejer" : ""}
        </span> },
    { key: "type", header: "Type", cell: (f: KatalogFelt) => <span className="text-xs">{f.datatype}</span> },
    { key: "gemmes", header: "Gemmes i", cell: (f: KatalogFelt) => <div className="text-xs font-mono">{maalTekst(f)}{f.kanonisk_felt && <div className="text-muted-foreground mt-1">fælles: {f.kanonisk_felt}</div>}{f.eksempel && <div className="text-muted-foreground mt-1">fx {f.eksempel}</div>}</div> },
    { key: "daekning", header: `Dækning (${DAEKNING_DAGE} d)`, cell: (f: KatalogFelt) => <DaekningCelle felt={f} daekning={daekning} /> },
    { key: "begrundelse", header: "Begrundelse", cell: (f: KatalogFelt) => <BegrundelseCelle felt={f} laast={laast} /> },
    { key: "status", header: "Status", cell: (f: KatalogFelt) => <Badge variant={STATUS_LABEL[f.status]?.variant ?? "outline"}>{STATUS_LABEL[f.status]?.label ?? f.status}</Badge> },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DatabaseIcon className="h-5 w-5" />
          {indlejret ? "Kolonner" : "Feltkatalog"}
        </CardTitle>
        <CardDescription>
          {laast
            ? "Låst: kolonnerne vises, men kan først ændres, når denne API flyttes over på kataloget i en senere leverance."
            : "Alle kolonner API'en kan levere, ét sted. Hentes: slås den fra, kasseres kolonnen ved næste hentning, og gemte værdier ryddes efter fristen. Klassifikation: personoplysning, identifikator og følsom er personfølsomme og foreslås beskyttet (lukket kolonne, adgangsnøgle og læselog – aktiveres pr. kolonne i næste leverance). Sletteregel: gældende frist pr. kolonne (tom = kampagnens; en kortere kolonnefrist går forud) – rettes med »Ret frist« gennem kladde → prøvet → godkendt → aktiv; aktivering kræver superadmin. Dækning: rækker med værdi de sidste 7 dage. Standard er »hent alt«. Ændringer logges."}
        </CardDescription>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Badge variant="outline">{total} kolonner</Badge>
          <Badge variant="outline">{hentes} hentes</Badge>
          <Badge variant="outline">{personfoelsomme} personfølsomme</Badge>
          <Badge variant="outline">{medFrist} med egen frist</Badge>
          <Badge variant={beskyttede > 0 ? "default" : "outline"}>{beskyttede} beskyttede</Badge>
          <Badge variant={uklassificeret > 0 ? "destructive" : "outline"}>{uklassificeret} ikke klassificeret</Badge>
          <Select value={visning} onValueChange={(v) => setVisning(v as Visning)}>
            <SelectTrigger className="h-9 w-[190px] text-xs sm:ml-auto sm:h-8" aria-label="Visning"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="alle">Alle kolonner</SelectItem>
              <SelectItem value="hentes">Kun dem der hentes</SelectItem>
              <SelectItem value="undlades">Kun dem der undlades</SelectItem>
              <SelectItem value="personfoelsom">Kun personfølsomme</SelectItem>
              <SelectItem value="beskyttet">Kun beskyttede</SelectItem>
              <SelectItem value="afventer">Afventer min afgørelse (forslag)</SelectItem>
            </SelectContent>
          </Select>
          <Input className="h-9 w-64 max-w-full sm:h-8" placeholder="Søg kolonne…" value={soeg} onChange={(e) => setSoeg(e.target.value)} />
          {kampagner && antalUdenData > 0 && (
            <Button size="sm" variant="ghost" className="h-9 text-xs sm:h-8" onClick={() => setVisUdenData((v) => !v)} title="Kampagnefelter for kampagner, der er registreret i koblingen, men som porten endnu ikke har hentet data for (alle konti). Frister kan sættes før første hentning.">
              {visUdenData ? "Skjul" : "Vis"} kampagnefelter uden data ({antalUdenData})
            </Button>
          )}
        </div>
        {kanSe && aendringerQ.isError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
            Sletteregel-ændringerne kunne ikke læses: {(aendringerQ.error as Error).message}. »Ret frist« er slået fra, til de er læst.
            <Button size="sm" variant="link" className="h-auto p-0 pl-2 text-destructive underline" onClick={() => void aendringerQ.refetch()}>Prøv igen</Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Henter kolonnerne…
          </div>
        )}
        {error && <div className="text-destructive text-sm py-4">Kolonnerne kunne ikke hentes: {(error as Error).message}</div>}
        {!isLoading && !error && total === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            Ingen kolonner registreret for denne API endnu. De registreres, når API'en flyttes over på kataloget.
          </div>
        )}
        {!isLoading && !error && total > 0 && (
          <Tabs defaultValue={endpoints[0]?.endpoint}>
            <TabsList className="flex flex-wrap h-auto">
              {endpoints.map((e) => (
                <TabsTrigger key={e.endpoint} value={e.endpoint}>
                  {e.label} <span className="ml-1 text-xs text-muted-foreground">({prEndpoint.get(e.endpoint)?.length ?? 0})</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {endpoints.map((e) => (
              <TabsContent key={e.endpoint} value={e.endpoint}>
                <ResponsiveTable
                  columns={kolonner}
                  rows={prEndpoint.get(e.endpoint) ?? []}
                  rowKey={(f) => f.id}
                  actions={(f) => {
                    if (!kanRetteFrist || f.status === "skabelon") return null;
                    const aa = aabenAlleFor(f.id); const t = (f.beskyttelse ?? "ingen") as BeskyttelseTilstand;
                    if (aa?.status === "aktiverer" || t === "flytter" || t === "ophaever") return <span className="text-xs text-muted-foreground">flytning i gang – ingen nye ændringer</span>;
                    if (aa) {  // én åben ændring pr. mål uanset type: kun den kan fortsættes
                      return aa.aendring_type === "frist"
                        ? <Button size="sm" variant="default" className="h-9 text-xs sm:h-8" onClick={() => retFrist(f)}>Fortsæt ændring</Button>
                        : <Button size="sm" variant="default" className="h-9 text-xs sm:h-8" onClick={() => setBeskytDialog({ felt: f, retning: aa.aendring_type === "beskyt" ? "beskyt" : "ophaev" })}>{aa.aendring_type === "beskyt" ? "Fortsæt beskyttelse" : "Fortsæt ophævelse"}</Button>;
                    }
                    return (
                      <>
                        <Button size="sm" variant="outline" className="h-9 text-xs sm:h-8" onClick={() => retFrist(f)}>Ret frist</Button>
                        {f.metadata_noegle && t === "ingen" && f.hentes && f.status === "aktiv" && <Button size="sm" variant="outline" className="h-9 text-xs sm:h-8" onClick={() => setBeskytDialog({ felt: f, retning: "beskyt" })}>Beskyt</Button>}
                        {f.metadata_noegle && t === "beskyttet" && <Button size="sm" variant="outline" className="h-9 text-xs sm:h-8" onClick={() => setBeskytDialog({ felt: f, retning: "ophaev" })}>Ophæv</Button>}
                      </>
                    );
                  }}
                  empty={<div className="text-center text-muted-foreground py-6 text-sm">Ingen kolonner</div>}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </CardContent>
      <BeskyttelseDialog felt={beskytFelt} retning={beskytDialog?.retning ?? "beskyt"} aaben={beskytFelt ? aabenBeskytFor(beskytFelt.id) : undefined} open={beskytDialog != null} onOpenChange={(o) => { if (!o) setBeskytDialog(null); }} kanRedigere={kanRetteFrist} erSuperadmin={isSuperadmin} roller={rollerQ.data ?? []} />
      <SletteregelDialog maal={dialogLive} aaben={dialogKatalogId ? aabenFor(dialogKatalogId) : undefined} open={dialog != null} onOpenChange={(o) => { if (!o) setDialog(null); }} kanRedigere={kanRetteFrist} erSuperadmin={isSuperadmin} snapshots={snapshots} setSnapshot={gemSnapshot} />
    </Card>
  );
}
