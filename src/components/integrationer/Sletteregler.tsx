import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SletteregelDialog, type ProevSnapshot, type SletteregelDialogMaal } from "@/components/integrationer/SletteregelDialog";
import { SletteregelInfo } from "@/components/integrationer/SletteregelInfo";
import { ResponsiveTable } from "@/components/mobile/ResponsiveTable";
import { KATALOG_KLASSIFIKATIONER, useKaldFeltKatalog, type KatalogFelt } from "@/hooks/useKaldFeltKatalog";
import { useKampagnerMedRegel, useKampagnerUdenRegel, useKontoKlienter, useRaekkerUdenRegel, useSystemPolitikker, useWebhookDatasaet, type ApiKonto, type ApiRegisterRaekke } from "@/hooks/useApiRegister";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useIsSuperadmin } from "@/hooks/useIsSuperadmin";
import {
  SLETTEREGEL_STATUS,
  forklarToerkoersel,
  useAktiverSletteregel,
  useFjernHentesIkke,
  useGemKladde,
  useGodkendSletteregel,
  useKampagneAfgoerelser,
  useKoblKampagne,
  useProevSletteregel,
  useSaetHentesIkke,
  useSletteregelAendringer,
  useSletteregelGrundlag,
  useSletteregelNavne,
  type KampagneAfgoerelse,
  type Klientfrist,
  type Klientkampagne,
  type SletteregelAendring,
  type SletteregelMaal,
  type SletteregelStatus,
} from "@/hooks/useSletteregler";

export const SLETTEREGEL_NOEGLE = "tab_integrationer_sletteregler";
const OPBEVARING_LINK = "/compliance?tab=registre&side=retention-policies";

function tid(v: string | null | undefined): string {
  return v ? new Date(v).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" }) : "–";
}
function fristTekst(d: number | null | undefined, tom = "ingen"): string {
  return d == null ? tom : `${d} d`;
}

type KampagneRaekke = {
  id: string;
  navn: string;
  klientkampagne?: Klientkampagne;
  gaeldende: number | null;
  kilde: string | null;
  klientfrist: number | null;
  aaben?: SletteregelAendring;
  afgoerelse?: KampagneAfgoerelse;
  mangler: boolean;
  aarsag?: string;
};

type KlientRaekke = { id: string; navn: string; frist?: Klientfrist; kampagner: number; undtagelser: number; aaben?: SletteregelAendring };

function AendringInfo({ a }: { a?: SletteregelAendring }) {
  if (!a) return <span className="text-muted-foreground">–</span>;
  const s = SLETTEREGEL_STATUS[a.status as SletteregelStatus];
  return (
    <div className="text-xs space-y-0.5">
      <div className="flex items-center gap-1"><Badge variant={s?.variant ?? "outline"}>{s?.label ?? a.status}</Badge><span>{fristTekst(a.frist_dage, a.maal === "klient" ? "fjern klientregel" : a.maal === "kampagne" ? "følg klienten / ingen" : "følg kampagnen")}</span></div>
      {a.proevet && <div className="text-muted-foreground" title={`Tørkørsel ${tid(a.proevet)}`}>{forklarToerkoersel(a.proevet_resultat as Parameters<typeof forklarToerkoersel>[0])[0] ?? "–"}</div>}
      {a.proevet && typeof (a.proevet_resultat as { advarsel?: string } | null)?.advarsel === "string" && <div className="text-destructive">{(a.proevet_resultat as { advarsel: string }).advarsel}</div>}
      {a.godkendt && <div className="text-muted-foreground">Godkendt {tid(a.godkendt)}</div>}
    </div>
  );
}

function Historik({ rader, navne }: { rader: SletteregelAendring[]; navne: Map<string, string> }) {
  if (rader.length === 0) return <div className="text-xs text-muted-foreground">Ingen aktiveringer endnu.</div>;
  return (
    <ul className="text-xs space-y-0.5">
      {rader.slice(0, 5).map((h) => {
        const foer = (h.foer ?? {}) as Record<string, number | boolean | string | null>;
        const foerFrist = (foer.retention_days ?? foer.retention_dage ?? foer.frist_dage) as number | null | undefined;
        const foerKilde = typeof foer.regel_kilde === "string" ? ` (${foer.regel_kilde === "klient" ? "fra klient" : "egen"})` : "";
        const af = h.aktiveret_af ? navne.get(h.aktiveret_af) ?? "superadmin" : "startværdi";
        return <li key={h.id}><span className="text-muted-foreground">{tid(h.aktiveret)}</span> · {fristTekst(h.frist_dage, "ingen frist")} <span className="text-muted-foreground">(før: {fristTekst(foerFrist ?? null)}{foerKilde})</span> · {af} · {h.begrundelse}</li>;
      })}
    </ul>
  );
}

export function Sletteregler({ konto, api, kampagner }: { konto: ApiKonto; api: ApiRegisterRaekke; kampagner: string[] | undefined }) {
  const p = usePermissions();
  const { isSuperadmin } = useIsSuperadmin();
  const erEjer = p.position?.name?.toLowerCase() === "ejer";  // samme ejer-afgørelse som Administration (useAdminSynlighed); databasen afgør endeligt (is_owner/is_superadmin)
  const erLeder = ["ejer", "teamleder", "assisterende teamleder", "assisterende teamleder fm", "fieldmarketing leder", "rekruttering"].includes(p.position?.name?.toLowerCase() ?? "");  // spejler is_teamleder_or_above (tørkørslens krav)
  const kanRedigere = p.canEdit(SLETTEREGEL_NOEGLE) && api.redigerbar && (erEjer || (isSuperadmin && erLeder));  // oprette/prøve/godkende: ejer eller superadmin m. lederadgang (Codex SR2 r2 P2-8)
  const erDialer = !!konto.integration_id;
  const { data: kontoKlienterMap } = useKontoKlienter();
  const { data: navne = new Map<string, string>() } = useSletteregelNavne();
  const { data: felter = [] } = useKaldFeltKatalog(api.noegle);
  const { data: system = [] } = useSystemPolitikker(api.tabeller);
  const medRegelQ = useKampagnerMedRegel(); const udenRegelQ = useKampagnerUdenRegel(); const raekkerQ = useRaekkerUdenRegel();
  const grundlagQ = useSletteregelGrundlag(); const aendringerQ = useSletteregelAendringer(); const afgoerelserQ = useKampagneAfgoerelser();
  const webhookQ = useWebhookDatasaet(konto.integration_id);
  const aktiver = useAktiverSletteregel(); const gem = useGemKladde(); const proev = useProevSletteregel(); const godkend = useGodkendSletteregel();
  const [dialog, setDialog] = useState<SletteregelDialogMaal | null>(null);
  const [snapshots, setSnapshots] = useState<Map<string, ProevSnapshot>>(new Map());
  const gemSnapshot = (id: string, s: ProevSnapshot) => setSnapshots((m) => new Map(m).set(id, s));
  const [visAlleKolonner, setVisAlleKolonner] = useState(false);
  const saetHentesIkke = useSaetHentesIkke(); const fjernHentesIkke = useFjernHentesIkke(); const kobl = useKoblKampagne();
  const [visning, setVisning] = useState<"mangler" | "alle" | "aabne" | "afgjort">("mangler");
  const [soeg, setSoeg] = useState("");
  const [valgte, setValgte] = useState<Set<string>>(new Set());
  const [udfoldet, setUdfoldet] = useState<string | null>(null);
  const [aktiverIds, setAktiverIds] = useState<string[] | null>(null);
  const [begrundelse, setBegrundelse] = useState("");
  const [hentesIkkeIds, setHentesIkkeIds] = useState<string[] | null>(null);
  const [bulkFrist, setBulkFrist] = useState("");

  const medRegel = useMemo(() => new Map((medRegelQ.data ?? []).map((r) => [r.kampagne_ekstern_id, r.retention_days] as const)), [medRegelQ.data]);
  const udenRegel = useMemo(() => new Map((udenRegelQ.data ?? []).map((r) => [r.kampagne_ekstern_id, r] as const)), [udenRegelQ.data]);
  const afgoerelser = useMemo(() => new Map((afgoerelserQ.data ?? []).map((a) => [a.kampagne_ekstern_id, a] as const)), [afgoerelserQ.data]);
  const aendringer = aendringerQ.data ?? [];
  const passer = (a: SletteregelAendring, maal: SletteregelMaal) => maal.maal === "klient" ? a.klient_id === maal.klient_id : maal.maal === "kampagne" ? a.klientkampagne_id === maal.klientkampagne_id : a.katalog_id === maal.katalog_id;
  const aabenFor = (maal: SletteregelMaal) => aendringer.find((a) => a.status !== "aktiv" && passer(a, maal));
  const historikFor = (maal: SletteregelMaal) => aendringer.filter((a) => a.status === "aktiv" && passer(a, maal)).sort((a, b) => (b.aktiveret ?? "").localeCompare(a.aktiveret ?? ""));

  const kampagnerFor = (klientkampagneIds: string[]) => { const g = grundlagQ.data; if (!g) return []; const set = new Set(klientkampagneIds); return [...g.koblinger.values()].filter((m) => m.client_campaign_id && set.has(m.client_campaign_id) && !afgoerelser.has(m.adversus_campaign_id)).map((m) => m.adversus_campaign_id); };
  const klientkampagnerUdenEgen = (clientId: string) => { const g = grundlagQ.data; if (!g) return []; return g.klientkampagner.filter((k) => k.client_id === clientId && g.politikker.get(k.id)?.regel_kilde !== "kampagne").map((k) => k.id); };
  const aabnDialog = (d: SletteregelDialogMaal) => setDialog(d);
  const dialogAaben = dialog ? aabenFor(dialog.maal) : undefined;
  // Codex SR2 r2 P1-1/P1-2: dialogens grundlag (gældende frist, klientfrist, kampagne- og klientkampagnemængde) genberegnes fra aktuelle data – ikke fra øjeblikket, dialogen blev åbnet
  const dialogLive = useMemo<SletteregelDialogMaal | null>(() => {
    if (!dialog) return null; const g = grundlagQ.data; if (!g) return dialog;
    if (dialog.maal.maal === "klient") { const id = dialog.maal.klient_id; const kk = klientkampagnerUdenEgen(id); return { ...dialog, gaeldende: g.klientfrister.get(id)?.frist_dage ?? null, kampagner: kampagnerFor(kk), klientkampagner: kk }; }
    if (dialog.maal.maal === "kampagne") { const kkId = dialog.maal.klientkampagne_id; const kk = g.klientkampagnePrId.get(kkId); const pol = g.politikker.get(kkId); const kf = kk ? g.klientfrister.get(kk.client_id) : undefined;
      return { ...dialog, gaeldende: pol?.is_active ? pol.retention_days : null, kilde: pol?.is_active ? (pol.regel_kilde as "klient" | "kampagne" | null) : null, klientfrist: kf?.frist_dage ?? null, kampagner: kampagnerFor([kkId]), klientkampagner: [kkId] }; }
    const f = felter.find((x) => x.id === (dialog.maal as { katalog_id: string }).katalog_id); return { ...dialog, gaeldende: f?.retention_dage ?? null };
  }, [dialog, grundlagQ.data, felter, afgoerelser]);  // eslint-disable-line react-hooks/exhaustive-deps
  const [visUdenData, setVisUdenData] = useState(false);
  const rader = useMemo<KampagneRaekke[]>(() => {
    const g = grundlagQ.data;
    const egne = new Set(kampagner ?? []);
    const ekstra = visUdenData ? [...udenRegel.keys()].filter((id) => !egne.has(id)) : [];
    return [...(kampagner ?? []), ...ekstra].map((id) => {
      const kobling = g?.koblinger.get(id);
      const kk = kobling?.client_campaign_id ? g?.klientkampagnePrId.get(kobling.client_campaign_id) : undefined;
      const gaeldende = medRegel.get(id) ?? null;
      const afg = afgoerelser.get(id);
      const pol = kk ? g?.politikker.get(kk.id) : undefined;
      const kf = kk ? g?.klientfrister.get(kk.client_id) : undefined;
      return {
        id, navn: kobling?.adversus_campaign_name ?? id, klientkampagne: kk, gaeldende, kilde: pol?.is_active ? pol.regel_kilde : null, klientfrist: kf?.frist_dage ?? null, afgoerelse: afg,
        aaben: kk ? aabenFor({ maal: "kampagne", klientkampagne_id: kk.id }) : undefined,
        mangler: gaeldende == null && !afg, aarsag: udenRegel.get(id)?.aarsag ?? (kobling ? undefined : "kampagnen er ikke registreret i koblingen endnu"),
      };
    }).sort((a, b) => Number(b.mangler) - Number(a.mangler) || a.navn.localeCompare(b.navn, "da"));
  }, [kampagner, grundlagQ.data, medRegel, afgoerelser, udenRegel, aendringer, visUdenData]);  // eslint-disable-line react-hooks/exhaustive-deps

  const klientRader = useMemo<KlientRaekke[]>(() => {
    const g = grundlagQ.data; if (!g) return [];
    const ids = new Set<string>(kontoKlienterMap?.get(konto.id) ?? []);
    for (const r of rader) if (r.klientkampagne) ids.add(r.klientkampagne.client_id);
    return [...ids].map((id) => {
      const kamp = g.klientkampagner.filter((k) => k.client_id === id);
      return { id, navn: g.klientNavn.get(id) ?? id, frist: g.klientfrister.get(id), kampagner: kamp.length, undtagelser: kamp.filter((k) => g.politikker.get(k.id)?.is_active && g.politikker.get(k.id)?.regel_kilde === "kampagne").length, aaben: aabenFor({ maal: "klient", klient_id: id }) };
    }).sort((a, b) => a.navn.localeCompare(b.navn, "da"));
  }, [grundlagQ.data, kontoKlienterMap, konto.id, rader, aendringer]);  // eslint-disable-line react-hooks/exhaustive-deps

  const synlige = rader.filter((r) => {
    if (visning === "mangler" && !r.mangler) return false;
    if (visning === "aabne" && !r.aaben) return false;
    if (visning === "afgjort" && !r.afgoerelse) return false;
    const q = soeg.trim().toLowerCase();
    return !q || `${r.navn} ${r.id} ${r.klientkampagne?.name ?? ""} ${r.klientkampagne?.klient ?? ""}`.toLowerCase().includes(q);
  });
  const antalMangler = rader.filter((r) => r.mangler).length;
  const antalAabne = aendringer.filter((a) => a.status !== "aktiv").length;
  const afventerFelter = felter.filter((f) => f.status === "forslag" && (!f.kampagne_ekstern_id || !kampagner || kampagner.includes(f.kampagne_ekstern_id))).length;
  const raekkerUdenRegel = raekkerQ.data ?? [];
  const portFejl = [medRegelQ.error, udenRegelQ.error, raekkerQ.error, grundlagQ.error, aendringerQ.error].filter(Boolean) as Error[];
  const tal = (v: number | null | undefined) => (v == null ? "–" : Number(v).toLocaleString("da-DK"));

  // samlede handlinger på valgte kampagner
  const valgteRader = synlige.filter((r) => valgte.has(r.id));
  const valgteUgemte = false;  // inline-redigering er afløst af dialogen (SR2)
  const koerSamlet = async (fn: (r: KampagneRaekke) => Promise<unknown> | undefined) => { for (const r of valgteRader) { try { await fn(r); } catch { /* fejl vises af mutationens toast */ } } setValgte(new Set()); };
  const samletSaetFrist = () => { const ny = bulkFrist.trim() === "" ? null : Number(bulkFrist); if (ny != null && (!Number.isInteger(ny) || ny < 0)) return; const set = new Set<string>(); void koerSamlet((r) => { if (!r.klientkampagne || set.has(r.klientkampagne.id)) return; set.add(r.klientkampagne.id); return gem.mutateAsync({ maal: { maal: "kampagne", klientkampagne_id: r.klientkampagne.id }, frist_dage: ny, aabenId: r.aaben?.id }); }); };
  const samletProev = () => { const set = new Set<string>(); void koerSamlet((r) => { if (!r.aaben || r.aaben.status === "aktiv" || set.has(r.aaben.id)) return; set.add(r.aaben.id); return proev.mutateAsync(r.aaben.id); }); };
  const samletGodkend = () => { const set = new Set<string>(); void koerSamlet((r) => { if (!r.aaben || r.aaben.status !== "proevet" || set.has(r.aaben.id)) return; set.add(r.aaben.id); return godkend.mutateAsync(r.aaben.id); }); };
  const samletAktiver = () => { const ids = [...new Set(valgteRader.filter((r) => r.aaben?.status === "godkendt").map((r) => r.aaben!.id))]; if (ids.length) { setBegrundelse(""); setAktiverIds(ids); } };
  const udfoerAktiver = async () => { const ids = aktiverIds ?? []; setAktiverIds(null); for (const id of ids) { try { await aktiver.mutateAsync({ id, begrundelse }); } catch { /* toast */ } } setValgte(new Set()); };
  const udfoerHentesIkke = async () => { const ids = hentesIkkeIds ?? []; setHentesIkkeIds(null); for (const id of ids) { try { await saetHentesIkke.mutateAsync({ kampagne_ekstern_id: id, begrundelse }); } catch { /* toast */ } } setValgte(new Set()); };

  const udfoldetRaekke = udfoldet && udfoldet !== "faelles" && !udfoldet.startsWith("klient:") ? rader.find((r) => r.id === udfoldet) : undefined;
  const kolonner: KatalogFelt[] = udfoldet === "faelles" ? felter.filter((f) => !f.kampagne_ekstern_id) : udfoldet && !udfoldet.startsWith("klient:") ? felter.filter((f) => f.kampagne_ekstern_id === udfoldet) : [];
  const klassLabel = (k: string) => KATALOG_KLASSIFIKATIONER.find((x) => x.value === k)?.label ?? k;

  return (
    <div className="space-y-4">
      {!api.redigerbar && <div className="rounded-md border p-2 text-sm text-muted-foreground">Låst API: reglerne vises, men kan først ændres, når API'en er flyttet over på kataloget.</div>}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div><CardTitle>Sletteregler</CardTitle><CardDescription>Intet hentes uden regel. Klienten er reglen, kampagne og kolonne er undtagelser. Tryk »Ret frist« på en række for at ændre.</CardDescription></div>
            <SletteregelInfo />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {portFejl.length > 0 && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">Kunne ikke læse sletteregel-porten: {portFejl.map((e) => e.message).join(" · ")}. Tallene nedenfor er ikke retvisende.</div>}
          <div className="grid gap-3 sm:grid-cols-5">
            <div><div className="text-2xl font-semibold">{klientRader.filter((k) => k.frist?.frist_dage != null).length}<span className="text-base text-muted-foreground">/{klientRader.length}</span></div><div className="text-muted-foreground">klienter med klientregel</div></div>
            <div><div className="text-2xl font-semibold">{rader.filter((r) => r.gaeldende != null).length}</div><div className="text-muted-foreground">kampagner med sletteregel (hentes)</div></div>
            <div><div className={`text-2xl font-semibold ${antalMangler ? "text-destructive" : ""}`}>{antalMangler}</div><div className="text-muted-foreground">mangler sletteregel (hentes ikke)</div></div>
            <div><div className="text-2xl font-semibold">{antalAabne}</div><div className="text-muted-foreground">åbne ændringer (alle konti)</div></div>
            <div><div className={`text-2xl font-semibold ${afventerFelter ? "text-destructive" : ""}`}>{afventerFelter}</div><div className="text-muted-foreground">felter, der afventer din afgørelse (fanen Felter)</div></div>
          </div>
          <div className="text-muted-foreground">Rækker uden sletteregel i Stork (røres ikke af oprydningen): {raekkerUdenRegel.map((r) => `${r.tabel} ${tal(r.antal)}`).join(" · ") || "–"}.</div>
        </CardContent>
      </Card>

      {erDialer && (
        <Card>
          <CardHeader>
            <CardTitle>Klientregler for {konto.navn}</CardTitle>
            <CardDescription>Klientens frist gælder alle klientens kampagner uden egen frist – også nye.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveTable
              columns={[
                { key: "navn", header: "Klient", isTitle: true, cell: (k) => <div><div className="text-sm font-medium">{k.navn}</div><div className="text-xs text-muted-foreground">{k.kampagner} kampagner{k.undtagelser ? ` · ${k.undtagelser} med egen frist` : ""}</div></div> },
                { key: "frist", header: "Klientfrist", isKey: true, cell: (k) => k.frist?.frist_dage != null ? <span className="font-medium" title={`Aktiveret ${tid(k.frist.aktiveret)}: ${k.frist.begrundelse ?? ""}`}>{k.frist.frist_dage} d</span> : <span className="text-muted-foreground">ingen</span> },
                ...(klientRader.some((k) => k.aaben) ? [{ key: "aendring", header: "Ændring", cell: (k: KlientRaekke) => <AendringInfo a={k.aaben} /> }] : []),
              ]}
              rows={klientRader}
              rowKey={(k) => k.id}
              actions={(k) => (
                <div className="flex flex-wrap items-center gap-1">
                  {kanRedigere && <Button size="sm" variant={k.aaben ? "default" : "outline"} className="h-8 text-xs" onClick={() => aabnDialog({ maal: { maal: "klient", klient_id: k.id }, titel: k.navn, gaeldende: k.frist?.frist_dage ?? null, kampagner: kampagnerFor(klientkampagnerUdenEgen(k.id)), klientkampagner: klientkampagnerUdenEgen(k.id) })}>{k.aaben ? "Fortsæt ændring" : "Ret frist"}</Button>}
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setUdfoldet(udfoldet === `klient:${k.id}` ? null : `klient:${k.id}`)}>{udfoldet === `klient:${k.id}` ? "Skjul" : "Historik"}</Button>
                </div>
              )}
              empty="Kontoen har ingen klienter – vælg klienter på kontoens oversigt."
            />
            {udfoldet?.startsWith("klient:") && <div className="mt-3"><div className="text-sm font-medium mb-1">Historik for klientreglen</div><Historik rader={historikFor({ maal: "klient", klient_id: udfoldet.slice(7) })} navne={navne} /></div>}
          </CardContent>
        </Card>
      )}

      {erDialer && (
        <Card>
          <CardHeader>
            <CardTitle>Sletteregler for {konto.navn}</CardTitle>
            <CardDescription>Kampagner med data på kontoen. »Fra klient« følger klientens frist; »egen« er en undtagelse.</CardDescription>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Select value={visning} onValueChange={(v) => setVisning(v as typeof visning)}>
                <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mangler">Mangler regel ({antalMangler})</SelectItem>
                  <SelectItem value="aabne">Med åben ændring</SelectItem>
                  <SelectItem value="afgjort">Afgjort »hentes ikke« ({rader.filter((r) => r.afgoerelse).length})</SelectItem>
                  <SelectItem value="alle">Alle ({rader.length})</SelectItem>
                </SelectContent>
              </Select>
              <Input className="h-8 w-56" placeholder="Søg kampagne…" value={soeg} onChange={(e) => setSoeg(e.target.value)} />
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setUdfoldet(udfoldet === "faelles" ? null : "faelles")}>Fælles kolonner ({felter.filter((f) => !f.kampagne_ekstern_id).length})</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setVisUdenData((v) => !v)} title="Kampagner, der er registreret i koblingen, men som porten endnu ikke har hentet data for (alle konti)">{visUdenData ? "Skjul" : "Vis"} registrerede uden data ({[...udenRegel.keys()].filter((id) => !(kampagner ?? []).includes(id)).length})</Button>
              {kanRedigere && valgteRader.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 rounded-md border p-1 text-xs">
                  <span className="px-1 text-muted-foreground">{valgteRader.length} valgt:</span>
                  <Input type="number" min={0} className="h-9 w-24 text-base sm:h-8 sm:w-20 sm:text-sm" placeholder="dage" value={bulkFrist} onChange={(e) => setBulkFrist(e.target.value)} />
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={samletSaetFrist} disabled={gem.isPending}>Sæt frist (kladde)</Button>
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={samletProev} disabled={proev.isPending || valgteUgemte} title={valgteUgemte ? "Gem først de rettede frister" : undefined}>Prøv</Button>
                  <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={samletGodkend} disabled={godkend.isPending || valgteUgemte}>Godkend</Button>
                  {isSuperadmin && <Button size="sm" className="h-7 text-xs" onClick={samletAktiver} disabled={valgteUgemte} title={valgteUgemte ? "Gem først de rettede frister" : undefined}>Aktivér</Button>}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setBegrundelse(""); setHentesIkkeIds(valgteRader.filter((r) => !r.afgoerelse && r.gaeldende == null && !r.aaben).map((r) => r.id)); }} title="Kun kampagner uden regel og uden åben ændring">Hentes ikke</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setValgte(new Set())}>Ryd</Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveTable
              columns={[
                { key: "navn", header: "Kampagne", isTitle: true, cell: (r) => (
                  <div className="flex items-start gap-2">
                    {kanRedigere && <Checkbox className="mt-0.5 h-6 w-6 sm:h-4 sm:w-4" checked={valgte.has(r.id)} onCheckedChange={(v) => setValgte((s) => { const n = new Set(s); if (v) n.add(r.id); else n.delete(r.id); return n; })} aria-label={`Vælg ${r.navn}`} />}
                    <div>
                      <div className={`text-sm ${r.mangler ? "font-medium text-destructive" : ""}`}>{r.navn}</div>
                      <div className="text-xs text-muted-foreground font-mono">{r.id}{r.mangler && r.aarsag ? ` · ${r.aarsag}` : ""}{r.afgoerelse ? ` · hentes ikke: ${r.afgoerelse.begrundelse}` : ""}</div>
                    </div>
                  </div>
                ) },
                { key: "klient", header: "Klientkampagne", cell: (r) => kanRedigere && grundlagQ.data ? (
                  <Select value={r.klientkampagne?.id ?? "-"} onValueChange={(v) => kobl.mutate({ adversus_campaign_id: r.id, client_campaign_id: v === "-" ? null : v })}>
                    <SelectTrigger className="h-7 w-[220px] text-xs"><SelectValue placeholder="Kobl til klientkampagne" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-">– ikke koblet –</SelectItem>
                      {grundlagQ.data.klientkampagner.map((k) => <SelectItem key={k.id} value={k.id}>{k.klient ? `${k.klient} · ` : ""}{k.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : <span className="text-xs">{r.klientkampagne ? `${r.klientkampagne.klient} · ${r.klientkampagne.name}` : "–"}</span> },
                { key: "gaeldende", header: "Gældende frist", isKey: true, cell: (r) => <span className={r.gaeldende == null ? "text-muted-foreground" : "font-medium"}>{fristTekst(r.gaeldende, "–")}{r.gaeldende != null && r.kilde && <span className="ml-1 text-xs font-normal text-muted-foreground">{r.kilde === "klient" ? "fra klient" : "egen"}</span>}</span> },
                ...(synlige.some((r) => r.aaben) ? [{ key: "aendring", header: "Ændring", cell: (r: KampagneRaekke) => <AendringInfo a={r.aaben} /> }] : []),
              ]}
              rows={synlige}
              rowKey={(r) => r.id}
              actions={(r) => (
                <div className="flex flex-wrap items-center gap-1">
                  {kanRedigere && r.klientkampagne && !r.afgoerelse && <Button size="sm" variant={r.aaben ? "default" : "outline"} className="h-8 text-xs" onClick={() => aabnDialog({ maal: { maal: "kampagne", klientkampagne_id: r.klientkampagne!.id }, titel: r.navn, gaeldende: r.gaeldende, kilde: (r.kilde as "klient" | "kampagne" | null) ?? null, klientfrist: r.klientfrist, kampagner: kampagnerFor([r.klientkampagne!.id]), klientkampagner: [r.klientkampagne!.id] })}>{r.aaben ? "Fortsæt ændring" : "Ret frist"}</Button>}
                  {!r.klientkampagne && !r.afgoerelse && <span className="text-xs text-muted-foreground">kobl først – eller afgør »hentes ikke«</span>}
                  {kanRedigere && !r.afgoerelse && r.gaeldende == null && !r.aaben && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setBegrundelse(""); setHentesIkkeIds([r.id]); }}>Hentes ikke</Button>}
                  {kanRedigere && r.afgoerelse && <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={fjernHentesIkke.isPending} onClick={() => fjernHentesIkke.mutate(r.id)}>Fortryd »hentes ikke«</Button>}
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setUdfoldet(udfoldet === r.id ? null : r.id)}>{udfoldet === r.id ? "Skjul" : `Kolonner (${felter.filter((f) => f.kampagne_ekstern_id === r.id).length}) · historik`}</Button>
                </div>
              )}
              empty={visning === "mangler" ? "Alle kontoens kampagner har en sletteregel eller en afgørelse." : "Ingen kampagner."}
            />
          </CardContent>
        </Card>
      )}

      {udfoldet && !udfoldet.startsWith("klient:") && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{udfoldet === "faelles" ? `Fælles kolonner for ${api.navn}` : `Kolonner for ${udfoldetRaekke?.navn ?? udfoldet}`}</CardTitle>
            <CardDescription>
              {visAlleKolonner ? "Alle kolonner." : "Kun kolonner, der ryddes (person, identifikator, følsom, ukendt)."} En kortere kolonnefrist går forud for kampagnens. Hentes og klassifikation rettes under fanen <strong>Felter</strong>.
              <Button size="sm" variant="link" className="h-auto p-0 pl-1 text-xs" onClick={() => setVisAlleKolonner((v) => !v)}>{visAlleKolonner ? "Vis kun dem der ryddes" : `Vis alle (${kolonner.length})`}</Button>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {udfoldetRaekke?.klientkampagne && (
              <div><div className="text-sm font-medium mb-1">Historik for kampagnefristen ({udfoldetRaekke.klientkampagne.name})</div><Historik rader={historikFor({ maal: "kampagne", klientkampagne_id: udfoldetRaekke.klientkampagne.id })} navne={navne} /></div>
            )}
            <ResponsiveTable
              columns={[
                { key: "kolonne", header: "Kolonne", isTitle: true, cell: (f) => { const hist = historikFor({ maal: "kolonne", katalog_id: f.id }); return <div><div className="text-sm">{f.felt_navn}</div><div className="text-xs text-muted-foreground font-mono">{f.felt_sti} · {f.maal_kolonne ? `${f.maal_tabel}.${f.maal_kolonne}` : f.metadata_noegle ? `${f.maal_tabel}.${f.maal_tabel === "dialer_leads" ? "felter" : "metadata"}.${f.metadata_noegle}` : "gemmes ikke"}</div>{hist.length > 0 && <div className="mt-1"><Historik rader={hist} navne={navne} /></div>}</div>; } },
                { key: "klass", header: "Klassifikation", cell: (f) => <span className="text-sm">{klassLabel(f.klassifikation)}{f.hentes ? "" : " · hentes ikke"}</span> },
                { key: "frist", header: "Gældende frist", isKey: true, cell: (f) => f.retention_dage == null ? <span className="text-muted-foreground">kampagnens</span> : <span className="font-medium">{f.retention_dage} d</span> },
                ...(kolonner.some((f) => aabenFor({ maal: "kolonne", katalog_id: f.id })) ? [{ key: "aendring", header: "Ændring", cell: (f: KatalogFelt) => <AendringInfo a={aabenFor({ maal: "kolonne", katalog_id: f.id })} /> }] : []),
              ]}
              rows={visAlleKolonner ? kolonner : kolonner.filter((f) => !["teknisk", "forretning"].includes(f.klassifikation) || f.retention_dage != null || !!aabenFor({ maal: "kolonne", katalog_id: f.id }))}
              rowKey={(f) => f.id}
              actions={(f) => kanRedigere && f.status !== "skabelon" ? <Button size="sm" variant={aabenFor({ maal: "kolonne", katalog_id: f.id }) ? "default" : "outline"} className="h-8 text-xs" onClick={() => aabnDialog({ maal: { maal: "kolonne", katalog_id: f.id }, titel: f.felt_navn, gaeldende: f.retention_dage, kampagner: [], klientkampagner: [] })}>{aabenFor({ maal: "kolonne", katalog_id: f.id }) ? "Fortsæt ændring" : "Ret frist"}</Button> : null}
              empty="Ingen kolonner registreret for denne kampagne – de fælles kolonner gælder."
            />
          </CardContent>
        </Card>
      )}

      {erDialer && (
        <Card>
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>Webhook-hændelser følger kampagnens sletteregel og har ingen egen frist. Uden kampagne eller regel står de som »uden regel«.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {webhookQ.isLoading && <div className="text-muted-foreground">Indlæser webhook-datasæt …</div>}
            {webhookQ.error && <div className="text-destructive">Kunne ikke læse webhook-datasættene: {(webhookQ.error as Error).message}</div>}
            {!webhookQ.isLoading && !webhookQ.error && (
              <ResponsiveTable
                columns={[
                  { key: "datasaet", header: "Datasæt", isTitle: true, cell: (w) => <div><div className="font-mono text-sm">{w.datasaet}</div><div className="text-sm text-muted-foreground">{w.beskrivelse}</div></div> },
                  { key: "gemt", header: "Gemt", isKey: true, cell: (w) => tal(w.gemt) },
                  { key: "med_regel", header: "Med regel", isKey: true, cell: (w) => tal(w.med_regel) },
                  { key: "uden_regel", header: "Uden regel", isKey: true, cell: (w) => <span className={(w.uden_regel ?? 0) > 0 ? "text-destructive" : undefined}>{tal(w.uden_regel)}</span> },
                  { key: "afvist", header: "Afvist", isKey: true, cell: (w) => tal(w.afvist) },
                  { key: "anonymiseret", header: "Ryddet", cell: (w) => tal(w.anonymiseret) },
                  { key: "seneste", header: "Seneste", cell: (w) => (w.seneste ? new Date(w.seneste).toLocaleString("da-DK") : "–") },
                ]}
                rows={(webhookQ.data ?? []).filter((w) => w.seneste != null || (w.gemt ?? 0) > 0)}
                rowKey={(w) => w.datasaet}
                empty="Ingen rå hændelser eller loggede afvigelser fundet (sidste 30 dage). Vellykkede Enreach-hooks tælles ikke – de skriver samme række som hentningen."
              />
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Oprydningen</CardTitle>
          <CardDescription>
            Kører hver nat efter reglerne her; rensningstype for salg vælges under <Link to={OPBEVARING_LINK} className="text-primary underline">Compliance › Opbevaring</Link>. Status:{" "}
            {system.filter((s) => s.data_type === "dialer_calls").map((s) => (s.is_active ? "tændt" : "SLUKKET – oprydningen kører ikke")).join("") || "ingen tænd/sluk-række"}. Hvad der ryddes, står bag infoknappen øverst.
          </CardDescription>
        </CardHeader>
      </Card>

      <SletteregelDialog maal={dialogLive} aaben={dialogAaben} open={dialog != null} onOpenChange={(o) => { if (!o) setDialog(null); }} kanRedigere={kanRedigere} erSuperadmin={isSuperadmin} snapshots={snapshots} setSnapshot={gemSnapshot} />
      <Dialog open={aktiverIds != null} onOpenChange={(o) => { if (!o) setAktiverIds(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aktivér {aktiverIds?.length === 1 ? "sletteregel" : `${aktiverIds?.length ?? 0} sletteregler`}</DialogTitle>
            <DialogDescription>Fristen bliver gældende med det samme: en klientfrist skrives ind på alle klientens kampagner uden egen frist; hentningen følger den fra næste kørsel, oprydningen og salgsrensningen fra næste nat. Begrundelsen logges (kun superadmin).</DialogDescription>
          </DialogHeader>
          <Textarea value={begrundelse} onChange={(e) => setBegrundelse(e.target.value)} placeholder="Begrundelse (påkrævet), fx »aftalt med klienten 4/11«" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAktiverIds(null)}>Annullér</Button>
            <Button disabled={begrundelse.trim() === "" || aktiver.isPending} onClick={udfoerAktiver}>Aktivér</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={hentesIkkeIds != null} onOpenChange={(o) => { if (!o) setHentesIkkeIds(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hentes ikke ({hentesIkkeIds?.length ?? 0} {hentesIkkeIds?.length === 1 ? "kampagne" : "kampagner"})</DialogTitle>
            <DialogDescription>Kampagnen hentes ikke (som i dag uden regel) og forlader »mangler«-listen. Eksisterende rækker røres ikke. Afgørelsen logges og kan fortrydes.</DialogDescription>
          </DialogHeader>
          <Textarea value={begrundelse} onChange={(e) => setBegrundelse(e.target.value)} placeholder="Begrundelse (påkrævet), fx »klientens egne brugere – ikke vores«" rows={3} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setHentesIkkeIds(null)}>Annullér</Button>
            <Button disabled={begrundelse.trim() === "" || saetHentesIkke.isPending} onClick={udfoerHentesIkke}>Gem afgørelse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
