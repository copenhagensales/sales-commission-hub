import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";
import { KaldFeltKatalog } from "@/components/settings/KaldFeltKatalog";
import { DialerIntegrations } from "@/components/settings/DialerIntegrations";
import { IntegrationLogs } from "@/components/settings/IntegrationLogs";
import { SaelgereUdenKobling } from "@/components/integrationer/SaelgereUdenKobling";
import { SLETTEREGEL_NOEGLE, Sletteregler } from "@/components/integrationer/Sletteregler";
import { usePermissions } from "@/hooks/usePositionPermissions";
import { Switch } from "@/components/ui/switch";
import { KlientVaelger } from "@/components/integrationer/KlientVaelger";
import {
  API_STATUS_LABEL,
  RETNING_LABEL,
  useDialerKonti,
  useKontoKampagner,
  useOpdaterKonto,
  useSyncState,
  type ApiKonto,
  type ApiRegisterRaekke,
  type Klient,
} from "@/hooks/useApiRegister";

const DATASET_LABEL: Record<string, string> = {
  calls_v1: "Kald (inkrementel)",
  calls_v1_afstemning: "Kald – natlig afstemning",
  calls_v1_backfill: "Kald – historisk backfill",
  leads_v1: "Emner (inkrementel)",
  leads_v1_fuld: "Emner – fuld indlæsning",
  calls_v1_nat: "Kald – nat (fejl)",
};

function tid(v: string | null | undefined): string {
  if (!v) return "–";
  return new Date(v).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

interface Props { konto: ApiKonto; api: ApiRegisterRaekke; klienter: Klient[]; valgteKlienter: string[]; tilbage: string }

function Laast({ api }: { api: ApiRegisterRaekke }) {
  if (api.redigerbar) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
      <Lock className="h-4 w-4" />
      Låst: felter og sletteregler for {api.navn} ændres først, når API'en flyttes over på kataloget i en senere leverance. Navn, klienter og kørsel (synkronisering) kan ændres som hidtil.
    </div>
  );
}

/** Krav 11: kontoens egne e-maildomæner (data). Brugere med e-mail i et af dem er »vores«; andre markeres automatisk »ikke vores«. */
function EgneDomaener({ konto }: { konto: ApiKonto }) {
  const opdater = useOpdaterKonto();
  const [tekst, setTekst] = useState((konto.egne_domaener ?? []).join(", "));
  useEffect(() => { setTekst((konto.egne_domaener ?? []).join(", ")); }, [konto.egne_domaener]);
  const gem = () => {
    const domaener = [...new Set(tekst.split(/[,\s]+/).map((d) => d.trim().toLowerCase().replace(/^@/, "")).filter(Boolean))];
    const ugyldige = domaener.filter((d) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
    if (ugyldige.length > 0) { toast.error(`Ugyldigt domæne: ${ugyldige.join(", ")}`); return; }
    if (JSON.stringify(domaener) !== JSON.stringify(konto.egne_domaener ?? [])) opdater.mutate({ id: konto.id, aendring: { egne_domaener: domaener } });
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Egne e-maildomæner:</span>
      <Input className="h-8 w-80 text-xs" value={tekst} disabled={opdater.isPending} placeholder="fx copenhagensales.dk, cph-relatel.dk" onChange={(e) => setTekst(e.target.value)} onBlur={gem} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      <span className="text-xs text-muted-foreground">Brugere med e-mail i disse domæner regnes som vores medarbejdere; andre markeres »ikke vores«.</span>
    </div>
  );
}

function Oversigt({ konto, api, klienter, valgteKlienter }: Props) {
  const ids = konto.integration_id ? [konto.integration_id] : [];
  const { data: dialer = [] } = useDialerKonti(ids);
  const { data: sync = [] } = useSyncState(ids);
  const d = dialer[0];
  const opdaterKonto = useOpdaterKonto();
  const cfg = (d?.config ?? {}) as Record<string, unknown>;
  const status = API_STATUS_LABEL[api.status] ?? API_STATUS_LABEL.laast;
  return (
    <div className="space-y-4">
      <Laast api={api} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {konto.navn}
            <Badge variant="outline">{api.navn}</Badge>
            <Badge variant={status.variant}>{status.label}</Badge>
          </CardTitle>
          <CardDescription>{konto.note ?? api.beskrivelse}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="sm:col-span-2 flex items-center gap-2"><span className="text-muted-foreground">Klient(er):</span> <KlientVaelger kontoId={konto.id} valgte={valgteKlienter} klienter={klienter} /></div>
          <div><span className="text-muted-foreground">Leverandør:</span> {api.leverandoer ?? "–"}</div>
          <div><span className="text-muted-foreground">Retning:</span> {RETNING_LABEL[api.retning] ?? api.retning}</div>
          {d && (
            <>
              <div><span className="text-muted-foreground">Aktiv:</span> {d.is_active ? "Ja" : "Nej"} · <span className="text-muted-foreground">Teknisk navn:</span> {d.name}</div>
              <div><span className="text-muted-foreground">Sidste salgs-sync:</span> {tid(d.last_sync_at)} {d.last_status && <span className="text-xs text-muted-foreground">({d.last_status})</span>}</div>
              {(d.provider === "adversus" || d.provider === "enreach") && (
                <>
                  <div className="sm:col-span-2">
                    {d.provider === "adversus" ? (
                      <><span className="text-muted-foreground">Henter kald:</span> {cfg.calls_v1 === true ? "ja, ny /calls-vej" : "legacy /cdr"} · <span className="text-muted-foreground">Henter emner:</span> {cfg.leads_v1 === true ? "ja" : "nej"}</>
                    ) : (
                      <><span className="text-muted-foreground">Henter sessions (emner med lukkestatus):</span> {cfg.sessions_v1 === true ? "ja, med sletteregel-port" : "som hidtil (uden port – aktiveres pr. konto)"}</>
                    )}
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-3">
                    <Switch id={`kun-egne-${konto.id}`} checked={konto.kun_egne_medarbejdere} disabled={opdaterKonto.isPending || (cfg.calls_v1 !== true && cfg.sessions_v1 !== true)}
                      onCheckedChange={(v) => opdaterKonto.mutate({ id: konto.id, aendring: { kun_egne_medarbejdere: v } })} />
                    <label htmlFor={`kun-egne-${konto.id}`} className="text-sm">
                      Hent kun egne medarbejderes {d.provider === "enreach" ? "sessions" : "kald"}{konto.kun_egne_medarbejdere ? " (til)" : " (fra)"}
                      <span className="block text-xs text-muted-foreground">
                        {cfg.calls_v1 === true || cfg.sessions_v1 === true
                          ? "Til: kun data for brugere, der er koblet til en medarbejder eller har e-mail i et af kontoens egne domæner, gemmes. Fra: alt fra kontoen gemmes."
                          : "Gælder først, når kontoen er på den nye vej med sletteregel-port (ikke aktiv her endnu). Indstillingen er sat på forhånd og kan ikke ændres, før kontoen er på den nye vej."}
                      </span>
                    </label>
                  </div>
                  <div className="sm:col-span-2">
                    <EgneDomaener konto={konto} />
                  </div>
                </>
              )}
            </>
          )}
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">Skriver til:</span>{" "}
            {api.tabeller.length === 0 ? "ingen tabeller i Stork" : api.tabeller.map((t) => <Badge key={t} variant="outline" className="mr-1 font-mono">{t}</Badge>)}
          </div>
          {api.link && (
            <div className="sm:col-span-2">
              <a href={api.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">API-dokumentation <ExternalLink className="h-3 w-3" /></a>
            </div>
          )}
        </CardContent>
      </Card>
      {konto.integration_id && <SaelgereUdenKobling kilde={api.noegle} kontoId={konto.id} kunEgne={konto.kun_egne_medarbejdere} egneDomaener={konto.egne_domaener ?? []} />}
      {sync.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Seneste kørsler</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Datasæt</TableHead><TableHead>Sidst gennemført</TableHead><TableHead>Cursor</TableHead><TableHead>Sidste fejl</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {sync.map((s) => (
                  <TableRow key={`${s.integration_id}-${s.dataset}`}>
                    <TableCell>{DATASET_LABEL[s.dataset] ?? s.dataset}</TableCell>
                    <TableCell>{tid(s.last_success_at)}</TableCell>
                    <TableCell className="font-mono text-xs">{s.cursor ?? "–"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.last_error ? `${tid(s.last_error_at)}: ${s.last_error}` : "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Koersel({ konto, api }: { konto: ApiKonto; api: ApiRegisterRaekke }) {
  if (!konto.integration_id) {
    return (
      <div className="space-y-4">
        <Laast api={api} />
        <Card>
          <CardHeader>
            <CardTitle>Kørsel</CardTitle>
            <CardDescription>Denne API har ingen kørselsindstillinger i Stork endnu (frekvens, webhooks og backfill vises her, når API'en flyttes over på kataloget).</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <Laast api={api} />
      <DialerIntegrations integrationIds={[konto.integration_id]} />
    </div>
  );
}

export function ApiDetalje(props: Props) {
  const { konto, api, tilbage } = props;
  const { data: kampagner } = useKontoKampagner(konto.integration_id);
  const kampagneFilter = konto.integration_id ? (kampagner ?? []) : undefined;
  const visSletteregler = usePermissions().canView(SLETTEREGEL_NOEGLE);  // rettighedsnøgle som data (masterplan 1.8); databasen håndhæver skridtene
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to={tilbage}><ArrowLeft className="mr-1 h-4 w-4" /> Alle konti</Link></Button>
        <h2 className="text-2xl font-bold">{konto.navn}</h2>
        <Badge variant="outline">{api.navn}</Badge>
      </div>
      <Tabs defaultValue="oversigt">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="oversigt">Oversigt</TabsTrigger>
          <TabsTrigger value="felter">Felter</TabsTrigger>
          {visSletteregler && <TabsTrigger value="sletteregler">Sletteregler</TabsTrigger>}
          <TabsTrigger value="koersel">Kørsel</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
        </TabsList>
        <TabsContent value="oversigt"><Oversigt {...props} /></TabsContent>
        <TabsContent value="felter">
          <div className="space-y-4">
            <Laast api={api} />
            {konto.integration_id && kampagneFilter && kampagneFilter.length === 0 && (
              <div className="text-sm text-muted-foreground">Kontoen har endnu ingen kald eller emner i Stork – kun de fælles felter vises.</div>
            )}
            <KaldFeltKatalog kilde={api.noegle} laast={!api.redigerbar} indlejret kampagner={kampagneFilter} />
          </div>
        </TabsContent>
        {visSletteregler && <TabsContent value="sletteregler"><Sletteregler konto={konto} api={api} kampagner={kampagneFilter} /></TabsContent>}
        <TabsContent value="koersel"><Koersel konto={konto} api={api} /></TabsContent>
        <TabsContent value="log">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{konto.integration_id ? "Seneste 50 kørsler for kontoen." : "Seneste 50 kørsler på tværs af integrationer."}</div>
            <IntegrationLogs integrationId={konto.integration_id ?? undefined} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
