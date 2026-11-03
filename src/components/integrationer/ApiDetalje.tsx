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
import { Switch } from "@/components/ui/switch";
import { KlientVaelger } from "@/components/integrationer/KlientVaelger";
import { useKaldFeltKatalog } from "@/hooks/useKaldFeltKatalog";
import {
  API_STATUS_LABEL,
  RETNING_LABEL,
  useDialerKonti,
  useKampagnePolitikker,
  useKampagnerMedRegel,
  useKampagnerUdenRegel,
  useKontoKampagner,
  useOpdaterKonto,
  useRaekkerUdenRegel,
  useSyncState,
  useSystemPolitikker,
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

const OPBEVARING_LINK = "/compliance?tab=registre&side=retention-policies";

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

function Sletteregler({ konto, api, kampagner }: { konto: ApiKonto; api: ApiRegisterRaekke; kampagner: string[] | undefined }) {
  const { data: system = [] } = useSystemPolitikker(api.tabeller);
  const erDialer = !!konto.integration_id;
  const { data: alleKampagner = [] } = useKampagnePolitikker(erDialer);
  const politikker = kampagner ? alleKampagner.filter((k) => k.adversusKampagneIds.some((id) => kampagner.includes(id))) : alleKampagner;
  const { data: felter = [] } = useKaldFeltKatalog(api.noegle);
  const synlige = kampagner ? felter.filter((f) => !f.kampagne_ekstern_id || kampagner.includes(f.kampagne_ekstern_id)) : felter;
  const medFrist = synlige.filter((f) => f.retention_dage != null);
  const ryddes = synlige.filter((f) => f.hentes && f.status === "aktiv" && !["teknisk", "forretning"].includes(f.klassifikation));
  const afventer = synlige.filter((f) => f.status === "forslag");
  const udenRegelQ = useKampagnerUdenRegel(); const medRegelQ = useKampagnerMedRegel(); const raekkerQ = useRaekkerUdenRegel();
  const udenRegel = udenRegelQ.data ?? []; const medRegel = medRegelQ.data ?? []; const raekkerUdenRegel = raekkerQ.data ?? [];
  const portFejl = [udenRegelQ.error, medRegelQ.error, raekkerQ.error].filter(Boolean) as Error[];
  const kontoensUdenRegel = kampagner ? udenRegel.filter((k) => kampagner.includes(k.kampagne_ekstern_id)) : [];
  return (
    <div className="space-y-4">
      <Laast api={api} />
      <Card>
        <CardHeader>
          <CardTitle>Sletteregel-porten</CardTitle>
          <CardDescription>
            Fast regel: intet hentes, før hver datatype har en sletteregel. Hentningen beder kun dialeren om kald og emner for kampagner med en gældende
            sletteregel (direkte, aktiv politik på den koblede klientkampagne). Nye felter lander som forslag og hentes først, når du har afgjort hentes,
            klassifikation og frist under fanen <strong>Felter</strong>. Der er ingen standardfrister: rækker uden regel slettes ikke stille, de står her, til reglen er sat.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {portFejl.length > 0 && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-destructive">Kunne ikke læse sletteregel-porten: {portFejl.map((e) => e.message).join(" · ")}. Tallene nedenfor er ikke retvisende.</div>}
          <div className="grid gap-3 sm:grid-cols-3">
            <div><div className="text-2xl font-semibold">{medRegel.length}</div><div className="text-muted-foreground">kampagner med sletteregel (hentes)</div></div>
            <div><div className={`text-2xl font-semibold ${udenRegel.length ? "text-destructive" : ""}`}>{udenRegel.length}</div><div className="text-muted-foreground">kampagner uden sletteregel (hentes ikke){kontoensUdenRegel.length ? ` · ${kontoensUdenRegel.length} set på denne konto` : ""}</div></div>
            <div><div className={`text-2xl font-semibold ${afventer.length ? "text-destructive" : ""}`}>{afventer.length}</div><div className="text-muted-foreground">felter, der afventer din afgørelse</div></div>
          </div>
          {udenRegel.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead>Kampagne</TableHead><TableHead>Navn i dialeren</TableHead><TableHead>Mangler</TableHead></TableRow></TableHeader>
              <TableBody>
                {udenRegel.slice(0, 40).map((k) => (
                  <TableRow key={k.kampagne_ekstern_id} className={kontoensUdenRegel.some((x) => x.kampagne_ekstern_id === k.kampagne_ekstern_id) ? "bg-destructive/5" : undefined}>
                    <TableCell className="font-mono text-xs">{k.kampagne_ekstern_id}</TableCell>
                    <TableCell className="text-xs">{k.navn ?? "–"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{k.aarsag}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="text-muted-foreground">
            Rækker uden sletteregel (røres ikke af oprydningen): {raekkerUdenRegel.map((r) => `${r.tabel} ${Number(r.antal).toLocaleString("da-DK")}`).join(" · ") || "–"}.
            Kampagner kobles og politikker sættes under <Link to={OPBEVARING_LINK} className="text-primary underline">Compliance › Opbevaring</Link>.
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Sådan ryddes data fra {konto.navn}</CardTitle>
          <CardDescription>
            Reglerne er data: feltkataloget afgør pr. felt, hvad der beholdes, og kampagnepolitikken afgør hvornår. Statistiske felter
            (teknisk og forretning) beholdes; identifikatorer, personoplysninger og ikke-klassificerede felter ryddes efter politikken. En frist pr. felt
            går forud, hvis den er kortere.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
          <div><div className="text-2xl font-semibold">{synlige.length}</div><div className="text-muted-foreground">felter i kataloget for kontoen</div></div>
          <div><div className="text-2xl font-semibold">{ryddes.length}</div><div className="text-muted-foreground">ryddes efter politik (identifikator/person/følsom/ukendt)</div></div>
          <div><div className="text-2xl font-semibold">{medFrist.length}</div><div className="text-muted-foreground">felter med egen frist</div></div>
          <div className="sm:col-span-3 text-muted-foreground">
            Klassifikation rettes under fanen <strong>Felter</strong>. Kampagne- og systempolitikker rettes under{" "}
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
          {system.length === 0 && <div className="text-sm text-muted-foreground">Ingen systempolitik for API'ens tabeller – kampagnepolitikken gælder; uden politik hentes og ryddes intet.</div>}
          {system.length > 0 && (
            <Table>
              <TableHeader><TableRow><TableHead>Tabel</TableHead><TableHead>Navn</TableHead><TableHead>Frist (dage)</TableHead><TableHead>Tilstand</TableHead><TableHead>Aktiv</TableHead></TableRow></TableHeader>
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
            <CardTitle>Kampagnepolitikker for kontoen</CardTitle>
            <CardDescription>
              Frister pr. klientkampagne (campaign_retention_policies) for de kampagner, kontoen har kald eller emner på. Kun en direkte, aktiv politik på den
              koblede klientkampagne er en regel; uden regel hentes kampagnen ikke, og eksisterende rækker røres ikke.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {politikker.length === 0 && <div className="text-sm text-muted-foreground">Ingen kampagnepolitikker rammer kontoens kampagner – intet hentes, før de er sat.</div>}
            {politikker.length > 0 && (
              <Table>
                <TableHeader><TableRow><TableHead>Klientkampagne</TableHead><TableHead>Adversus-kampagner</TableHead><TableHead>Frist (dage)</TableHead><TableHead>Dialer-frist (dage)</TableHead><TableHead>Tilstand</TableHead><TableHead>Aktiv</TableHead></TableRow></TableHeader>
                <TableBody>
                  {politikker.map((k) => (
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
          <TabsTrigger value="sletteregler">Sletteregler</TabsTrigger>
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
        <TabsContent value="sletteregler"><Sletteregler konto={konto} api={api} kampagner={kampagneFilter} /></TabsContent>
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
