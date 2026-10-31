import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";
import { KaldFeltKatalog } from "@/components/settings/KaldFeltKatalog";
import { DialerIntegrations } from "@/components/settings/DialerIntegrations";
import { IntegrationLogs } from "@/components/settings/IntegrationLogs";
import { useKaldFeltKatalog } from "@/hooks/useKaldFeltKatalog";
import {
  API_PROVIDERE,
  API_STATUS_LABEL,
  RETNING_LABEL,
  useDialerKonti,
  useKampagnePolitikker,
  useSyncState,
  useSystemPolitikker,
  type ApiRegisterRaekke,
} from "@/hooks/useApiRegister";

const DATASET_LABEL: Record<string, string> = {
  calls_v1: "Kald (inkrementel)",
  calls_v1_afstemning: "Kald – natlig afstemning",
  calls_v1_backfill: "Kald – historisk backfill",
  leads_v1: "Emner (inkrementel)",
  leads_v1_fuld: "Emner – fuld indlæsning",
  calls_v1_nat: "Kald – nat (fejl)",
};

const OPBEVARING_LINK = "/compliance?tab=registre&side=retention-policies";

function tid(v: string | null | undefined): string {
  if (!v) return "–";
  return new Date(v).toLocaleString("da-DK", { dateStyle: "short", timeStyle: "short" });
}

function Laast({ api }: { api: ApiRegisterRaekke }) {
  if (api.redigerbar) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
      <Lock className="h-4 w-4" />
      Låst: felter og sletteregler for {api.navn} ændres først, når API'en flyttes over på kataloget i en senere leverance. Kørsel (synkronisering og konti) virker som hidtil.
    </div>
  );
}

function Oversigt({ api }: { api: ApiRegisterRaekke }) {
  const providere = API_PROVIDERE[api.noegle] ?? [];
  const { data: konti = [], isLoading } = useDialerKonti(providere);
  const { data: sync = [] } = useSyncState(konti.map((k) => k.id));
  const kontoNavn = new Map(konti.map((k) => [k.id, k.name] as const));
  const status = API_STATUS_LABEL[api.status] ?? API_STATUS_LABEL.laast;
  return (
    <div className="space-y-4">
      <Laast api={api} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {api.navn}
            <Badge variant={status.variant}>{status.label}</Badge>
          </CardTitle>
          <CardDescription>{api.beskrivelse}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Leverandør:</span> {api.leverandoer ?? "–"}</div>
          <div><span className="text-muted-foreground">Retning:</span> {RETNING_LABEL[api.retning] ?? api.retning}</div>
          <div className="sm:col-span-2">
            <span className="text-muted-foreground">Skriver til:</span>{" "}
            {api.tabeller.length === 0 ? "ingen tabeller i Stork" : api.tabeller.map((t) => <Badge key={t} variant="outline" className="mr-1 font-mono">{t}</Badge>)}
          </div>
          {api.link && (
            <div className="sm:col-span-2">
              <a href={api.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary underline">
                API-dokumentation <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>
      {providere.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Konti</CardTitle>
            <CardDescription>Forbindelser i Stork for denne API og deres seneste kørsel.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading && <div className="text-sm text-muted-foreground">Henter…</div>}
            {!isLoading && konti.length === 0 && <div className="text-sm text-muted-foreground">Ingen konti.</div>}
            {konti.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Konto</TableHead>
                    <TableHead>Aktiv</TableHead>
                    <TableHead>Henter kald</TableHead>
                    <TableHead>Henter emner</TableHead>
                    <TableHead>Sidste salgs-sync</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {konti.map((k) => {
                    const cfg = (k.config ?? {}) as Record<string, unknown>;
                    return (
                      <TableRow key={k.id}>
                        <TableCell className="font-medium">{k.name}</TableCell>
                        <TableCell>{k.is_active ? "Ja" : "Nej"}</TableCell>
                        <TableCell>{k.provider === "adversus" ? (cfg.calls_v1 === true ? "Ja (/calls)" : "Legacy (/cdr)") : "–"}</TableCell>
                        <TableCell>{k.provider === "adversus" ? (cfg.leads_v1 === true ? "Ja" : "Nej") : "–"}</TableCell>
                        <TableCell>{tid(k.last_sync_at)}</TableCell>
                        <TableCell className="text-xs">{k.last_status ?? "–"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {sync.length > 0 && (
              <div className="mt-6">
                <div className="mb-2 text-sm font-medium">Seneste kørsler</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Konto</TableHead>
                      <TableHead>Datasæt</TableHead>
                      <TableHead>Sidst gennemført</TableHead>
                      <TableHead>Cursor</TableHead>
                      <TableHead>Sidste fejl</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sync.map((s) => (
                      <TableRow key={`${s.integration_id}-${s.dataset}`}>
                        <TableCell>{kontoNavn.get(s.integration_id) ?? s.integration_id}</TableCell>
                        <TableCell>{DATASET_LABEL[s.dataset] ?? s.dataset}</TableCell>
                        <TableCell>{tid(s.last_success_at)}</TableCell>
                        <TableCell className="font-mono text-xs">{s.cursor ?? "–"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.last_error ? `${tid(s.last_error_at)}: ${s.last_error}` : "–"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Sletteregler({ api }: { api: ApiRegisterRaekke }) {
  const { data: system = [] } = useSystemPolitikker(api.tabeller);
  const erDialer = (API_PROVIDERE[api.noegle] ?? []).length > 0;
  const { data: kampagner = [] } = useKampagnePolitikker(erDialer);
  const { data: felter = [] } = useKaldFeltKatalog(api.noegle);
  const medFrist = felter.filter((f) => f.retention_dage != null);
  const ryddes = felter.filter((f) => f.hentes && f.status === "aktiv" && !["teknisk", "forretning"].includes(f.klassifikation));
  return (
    <div className="space-y-4">
      <Laast api={api} />
      <Card>
        <CardHeader>
          <CardTitle>Sådan ryddes data fra {api.navn}</CardTitle>
          <CardDescription>
            Reglerne er data: feltkataloget afgør pr. felt, hvad der beholdes, og kampagne-/klientpolitikkerne afgør hvornår. Statistiske felter
            (teknisk og forretning) beholdes; identifikatorer, personoplysninger og ikke-klassificerede felter ryddes efter politikken. En frist
            pr. felt går forud, hvis den er kortere.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div><div className="text-2xl font-semibold">{felter.length}</div><div className="text-muted-foreground">felter i kataloget</div></div>
          <div><div className="text-2xl font-semibold">{ryddes.length}</div><div className="text-muted-foreground">ryddes efter politik (identifikator/person/følsom/ukendt)</div></div>
          <div><div className="text-2xl font-semibold">{medFrist.length}</div><div className="text-muted-foreground">felter med egen frist</div></div>
          <div className="sm:col-span-3 text-muted-foreground">
            Felternes klassifikation og frister rettes under fanen <strong>Felter</strong>. Kampagne- og systempolitikker rettes under{" "}
            <Link to={OPBEVARING_LINK} className="text-primary underline">Compliance › Opbevaring</Link>.
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Systempolitikker</CardTitle>
          <CardDescription>Opbevaringspolitik pr. tabel (data_retention_policies) for de tabeller, API'en skriver til.</CardDescription>
        </CardHeader>
        <CardContent>
          {system.length === 0 && <div className="text-sm text-muted-foreground">Ingen systempolitik for API'ens tabeller – kampagne-/klientpolitik og fallback (90 dage) gælder.</div>}
          {system.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Tabel</TableHead><TableHead>Navn</TableHead><TableHead>Frist (dage)</TableHead><TableHead>Tilstand</TableHead><TableHead>Aktiv</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {system.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.data_type}</TableCell>
                    <TableCell>{p.display_name}</TableCell>
                    <TableCell>{p.retention_days ?? "–"}</TableCell>
                    <TableCell>{p.cleanup_mode}</TableCell>
                    <TableCell>{p.is_active ? "Ja" : "Nej"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {erDialer && (
        <Card>
          <CardHeader>
            <CardTitle>Kampagnepolitikker</CardTitle>
            <CardDescription>
              Frister pr. klientkampagne (campaign_retention_policies). Oprydningen af kald og emner bruger den korteste frist, der gælder for kampagnen
              (direkte eller via klienten); uden politik gælder 90 dage.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kampagner.length === 0 && <div className="text-sm text-muted-foreground">Ingen kampagnepolitikker.</div>}
            {kampagner.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Klientkampagne</TableHead><TableHead>Adversus-kampagner</TableHead><TableHead>Frist (dage)</TableHead><TableHead>Dialer-frist (dage)</TableHead><TableHead>Tilstand</TableHead><TableHead>Aktiv</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {kampagner.map((k) => (
                    <TableRow key={k.id}>
                      <TableCell className="font-medium">{k.klientkampagne}</TableCell>
                      <TableCell className="text-xs">{k.adversusKampagner.length ? k.adversusKampagner.join(", ") : "–"}</TableCell>
                      <TableCell>{k.retention_days ?? "–"}</TableCell>
                      <TableCell>{k.dialer_retention_days ?? "–"}</TableCell>
                      <TableCell>{k.no_data_held ? "ingen data" : k.cleanup_mode}</TableCell>
                      <TableCell>{k.is_active ? "Ja" : "Nej"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Koersel({ api }: { api: ApiRegisterRaekke }) {
  const providere = API_PROVIDERE[api.noegle] ?? [];
  if (providere.length === 0) {
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
      <DialerIntegrations provider={providere} />
    </div>
  );
}

export function ApiDetalje({ api, tilbage }: { api: ApiRegisterRaekke; tilbage: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to={tilbage}><ArrowLeft className="mr-1 h-4 w-4" /> Alle integrationer</Link>
        </Button>
        <h2 className="text-2xl font-bold">{api.navn}</h2>
      </div>
      <Tabs defaultValue="oversigt">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="oversigt">Oversigt</TabsTrigger>
          <TabsTrigger value="felter">Felter</TabsTrigger>
          <TabsTrigger value="sletteregler">Sletteregler</TabsTrigger>
          <TabsTrigger value="koersel">Kørsel</TabsTrigger>
          <TabsTrigger value="log">Log</TabsTrigger>
        </TabsList>
        <TabsContent value="oversigt"><Oversigt api={api} /></TabsContent>
        <TabsContent value="felter">
          <div className="space-y-4">
            <Laast api={api} />
            <KaldFeltKatalog kilde={api.noegle} laast={!api.redigerbar} indlejret />
          </div>
        </TabsContent>
        <TabsContent value="sletteregler"><Sletteregler api={api} /></TabsContent>
        <TabsContent value="koersel"><Koersel api={api} /></TabsContent>
        <TabsContent value="log">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Seneste 50 kørsler på tværs af integrationer.</div>
            <IntegrationLogs />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
