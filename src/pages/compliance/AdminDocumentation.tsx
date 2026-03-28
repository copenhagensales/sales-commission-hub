import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, FileText, Server, Database, Trash2, Brain, UserCog, ArrowLeft, Globe, HardDrive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AdminDocumentation() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/compliance")} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Tilbage til oversigt
        </Button>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <FileText className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Admin og dokumentation</h1>
            <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">Admin</Badge>
          </div>
          <p className="text-muted-foreground">
            Denne side er for systemejer, admin og andre relevante nøglepersoner med ansvar for governance, dokumentation og compliance.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-foreground">
              Her samles den dokumentation og de kontroller, som understøtter lovpligtig databeskyttelse og intern styring.
            </p>
          </CardContent>
        </Card>

        <Card className="border-muted">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground italic">
              Denne side samler intern dokumentation om datatyper, leverandører, logging, backup, sletning, AI og ansvar.
            </p>
          </CardContent>
        </Card>

        <Accordion type="multiple" defaultValue={["oversigt", "leverandoer", "tredjeland", "logging", "backup", "sletning", "ai", "ansvar"]} className="space-y-3">
          <AccordionItem value="oversigt" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Database className="h-4 w-4" /> Det vi holder styr på</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Vi fører intern dokumentation over:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>behandlingsaktiviteter</li>
                <li>datakategorier</li>
                <li>formål</li>
                <li>behandlingsgrundlag</li>
                <li>registrerede kategorier</li>
                <li>opbevaringsperioder</li>
                <li>sikkerhedsforanstaltninger</li>
                <li>leverandører og databehandlere</li>
                <li>tredjelandsoverførsler</li>
                <li>rettighedsanmodninger</li>
                <li>sikkerhedshændelser</li>
                <li>review-datoer og ansvarlige</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="leverandoer" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Server className="h-4 w-4" /> Leverandører og databehandlere</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Vi anvender eksterne leverandører, herunder Lovable og Supabase, og eventuelt andre tekniske underleverandører.</p>
              <p>For hver relevant leverandør skal vi kunne dokumentere:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>leverandørens navn</li>
                <li>leverandørens rolle</li>
                <li>hvilke data leverandøren kan behandle</li>
                <li>om der er databehandleraftale</li>
                <li>om der anvendes underdatabehandlere</li>
                <li>om der sker tredjelandsoverførsel</li>
                <li>hvornår leverandøren sidst er vurderet</li>
              </ul>

              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leverandør</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead>DPA</TableHead>
                      <TableHead>Tredjeland</TableHead>
                      <TableHead>Sidst vurderet</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Lovable</TableCell>
                      <TableCell>App-platform / hosting</TableCell>
                      <TableCell><span className="bg-green-200/60 text-green-800 px-1 rounded text-xs">Ja (Business/Enterprise)</span></TableCell>
                      <TableCell><span className="bg-green-200/60 text-green-800 px-1 rounded text-xs">Nej (EU-hostet)</span></TableCell>
                      <TableCell><span className="bg-green-200/60 text-green-800 px-1 rounded text-xs">28.03.2026</span></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Supabase (via Lovable Cloud)</TableCell>
                      <TableCell>Database / Auth / Storage</TableCell>
                      <TableCell><span className="bg-green-200/60 text-green-800 px-1 rounded text-xs">Ja (inkl. i Lovable Cloud)</span></TableCell>
                      <TableCell><span className="bg-green-200/60 text-green-800 px-1 rounded text-xs">Nej (EU-hostet)</span></TableCell>
                      <TableCell><span className="bg-green-200/60 text-green-800 px-1 rounded text-xs">28.03.2026</span></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Bekræft at DPA'er er underskrevet og arkiveret.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="tredjeland" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Globe className="h-4 w-4" /> Tredjelandsoverførsler</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-green-200/60 text-green-800 border-green-500/30">Ingen tredjelandsoverførsler</Badge>
              </div>
              <p>Alle data behandles og opbevares inden for EU/EØS.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Lovable: EU-hostet platform</li>
                <li>Database (Lovable Cloud): EU-region</li>
                <li>Ingen underdatabehandlere uden for EU/EØS</li>
              </ul>
              <p className="text-xs italic mt-2">Sidst vurderet: 28.03.2026</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="logging" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Logging og dokumentation</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Systemet logger relevante ændringer i databasen via <code>amo_audit_log</code>-tabellen. Følgende logges:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Brugerlogin</strong> – hvem loggede ind og hvornår (via auth-systemet)</li>
                <li><strong>Kontraktændringer</strong> – ændringer i medarbejderkontrakter og lønaftaler</li>
                <li><strong>Salgsdata-sync</strong> – import og synkronisering fra Adversus og klient-uploads</li>
                <li><strong>Lønberegninger</strong> – beregning og godkendelse af løn og provision</li>
                <li><strong>GDPR-anmodninger</strong> – registrering af rettighedsanmodninger og sikkerhedshændelser</li>
                <li><strong>AMO-ændringer</strong> – ændringer i arbejdsmiljøorganisationen</li>
              </ul>
              <p>Logs opbevares i databasen og er tilgængelige for systemadministratorer. Hver log-entry indeholder:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Bruger-ID og email</li>
                <li>Tidspunkt</li>
                <li>Handling (opret/opdater/slet)</li>
                <li>Tidligere og nye værdier (hvor relevant)</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="backup" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><HardDrive className="h-4 w-4" /> Backup og gendannelse</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="bg-green-200/60 text-green-800 border-green-500/30">Automatisk backup aktiv</Badge>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Parameter</TableHead>
                      <TableHead>Værdi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Backup</TableCell>
                      <TableCell>Ja – automatisk via Lovable Cloud</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Frekvens</TableCell>
                      <TableCell>Dagligt</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Ansvarlig</TableCell>
                      <TableCell>Lovable Cloud (platform-administreret)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Restore</TableCell>
                      <TableCell>Håndteres via Lovable Cloud support</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Dækning</TableCell>
                      <TableCell>Fuld database inkl. auth, storage og edge functions</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sletning" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Sletning og retention</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Følgende retentionspolitik gælder:</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datatype</TableHead>
                      <TableHead>Opbevaringsperiode</TableHead>
                      <TableHead>Grundlag</TableHead>
                      <TableHead>Sletning</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Løn- og økonomidata</TableCell>
                      <TableCell>5 år</TableCell>
                      <TableCell>Bogføringsloven §10</TableCell>
                      <TableCell>Manuel</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Salgsdata og provision</TableCell>
                      <TableCell>5 år</TableCell>
                      <TableCell>Bogføringsloven §10</TableCell>
                      <TableCell>Manuel</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Medarbejderstamdata</TableCell>
                      <TableCell>Slettes efter fratrædelse, senest 5 år</TableCell>
                      <TableCell>Berettiget interesse / bogføringsloven</TableCell>
                      <TableCell>Manuel</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Samtykker</TableCell>
                      <TableCell>Så længe samtykke er aktivt</TableCell>
                      <TableCell>GDPR art. 6(1)(a)</TableCell>
                      <TableCell>Manuel</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Ansøgerdata</TableCell>
                      <TableCell>6 måneder efter afslag</TableCell>
                      <TableCell>Databeskyttelsesloven §12</TableCell>
                      <TableCell>Manuel</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Audit logs</TableCell>
                      <TableCell>5 år</TableCell>
                      <TableCell>Intern kontrol / compliance</TableCell>
                      <TableCell>Manuel</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs italic mt-2">Systemejeren er ansvarlig for at følge op på sletning. Automatiseret sletning kan implementeres efter behov.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ai" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Brain className="h-4 w-4" /> AI-brug</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>AI anvendes i følgende funktioner:</p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funktion</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Persondata</TableHead>
                      <TableHead>Formål</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">FM Profit Agent</TableCell>
                      <TableCell>Google Gemini (via Lovable AI Gateway)</TableCell>
                      <TableCell><Badge variant="outline" className="bg-green-200/60 text-green-800 border-green-500/30 text-xs">Nej – aggregeret data</Badge></TableCell>
                      <TableCell>Analyse af salgsperformance og omsætning</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Udgiftsformel-parsing</TableCell>
                      <TableCell>Google Gemini (via Lovable AI Gateway)</TableCell>
                      <TableCell><Badge variant="outline" className="bg-green-200/60 text-green-800 border-green-500/30 text-xs">Nej – kun formelstrenge</Badge></TableCell>
                      <TableCell>Tolkning af provisionsformler til beregningslogik</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
              <p className="font-medium mt-3">Sikkerhedsforanstaltninger:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Al AI-kommunikation sker via Lovable AI Gateway – ingen direkte API-kald til tredjeparter</li>
                <li>Persondata sendes ikke til AI-modeller; data aggregeres eller anonymiseres først</li>
                <li>AI bruges udelukkende som beslutningsstøtte – ingen automatiserede beslutninger om enkeltpersoner</li>
                <li>AI-output valideres altid af en bruger før det anvendes</li>
              </ul>
              <p className="font-medium mt-3">Risici og begrænsninger:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>AI kan producere forkerte eller misvisende svar (hallucination)</li>
                <li>Brugere informeres om, at AI-svar skal verificeres</li>
                <li>Ingen følsomme personoplysninger (CPR, helbred, fagforening) må indgå i AI-prompts</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ansvar" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><UserCog className="h-4 w-4" /> Ansvar</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p><strong>Systemejeren (virksomhedens ejer)</strong> er dataansvarlig jf. GDPR art. 4, nr. 7.</p>
              <p>Dataansvarlig har ansvar for:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>At formål og retsgrundlag for databehandling er klart defineret</li>
                <li>At roller, adgange og rettigheder er korrekt tildelt og løbende reviewes</li>
                <li>At retentionspolitik overholdes og sletning gennemføres rettidigt</li>
                <li>At leverandører og databehandlere vurderes mindst årligt</li>
                <li>At sikkerhedshændelser håndteres og indberettes inden for 72 timer</li>
                <li>At rettighedsanmodninger fra registrerede behandles inden for 30 dage</li>
                <li>At denne dokumentation holdes opdateret ved systemændringer</li>
                <li>At compliance-notifikationsmodtagere er opdateret</li>
                <li>At AMO og arbejdsmiljøforhold overholder gældende lovgivning</li>
              </ul>
              <p className="text-xs italic mt-2">Sidst gennemgået: 28.03.2026</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </MainLayout>
  );
}
