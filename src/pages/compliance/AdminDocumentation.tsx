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
              <p>Hvis data kan behandles uden for EU/EØS, skal dette være dokumenteret.</p>
              <p>Vi registrerer derfor:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>om overførsel sker</li>
                <li>til hvilke lande</li>
                <li>hvilket grundlag overførslen sker på</li>
                <li>hvilke supplerende foranstaltninger der er vurderet</li>
                <li>dato for seneste vurdering</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="logging" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Logging og dokumentation</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Systemet logger relevante ændringer, så vi kan følge:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>hvem der ændrede noget</li>
                <li>hvornår det skete</li>
                <li>hvad der blev ændret, når muligt</li>
              </ul>
              <p>Denne dokumentation bruges til:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>intern kontrol</li>
                <li>fejlsøgning</li>
                <li>sikkerhed</li>
                <li>afvigelseshåndtering</li>
                <li>dokumentation af løn-, provisions- og fakturaprocesser</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="backup" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><HardDrive className="h-4 w-4" /> Backup og gendannelse</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Der skal være backup af relevante data og en klar forståelse af, hvordan gendannelse håndteres.</p>
              <p>Vi dokumenterer:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>om backup findes</li>
                <li>hvor ofte backup tages</li>
                <li>hvem der er ansvarlig</li>
                <li>hvordan restore håndteres</li>
                <li>hvornår restore sidst blev testet, hvis relevant</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sletning" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Trash2 className="h-4 w-4" /> Sletning og retention</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Vi dokumenterer for hver relevant datatype:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>hvorfor data behandles</li>
                <li>hvor længe de må opbevares</li>
                <li>hvornår de skal slettes</li>
                <li>om sletning er automatisk eller manuel</li>
                <li>hvem der følger op</li>
                <li>om der findes lovkrav om længere opbevaring</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ai" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Brain className="h-4 w-4" /> AI-brug</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Hvis AI bruges i systemet eller i tilknyttede workflows, skal vi dokumentere:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>hvad AI bruges til</li>
                <li>om persondata indgår</li>
                <li>hvilke leverandører der bruges</li>
                <li>om der er særlige risici</li>
                <li>hvilke begrænsninger og kontroller der gælder</li>
              </ul>
              <p>AI må ikke bruges på en måde, der går videre end nødvendigt eller giver uvedkommende adgang til oplysninger.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="ansvar" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><UserCog className="h-4 w-4" /> Ansvar</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Det overordnede ansvar for systemet ligger hos systemejeren.</p>
              <p>Systemejeren har ansvar for:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>at formål og databrug er klare</li>
                <li>at roller og adgang er passende</li>
                <li>at sletning og opbevaring følges op</li>
                <li>at leverandører er vurderet</li>
                <li>at hændelser håndteres</li>
                <li>at dokumentation holdes opdateret</li>
                <li>at relevante reviews bliver gennemført</li>
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </MainLayout>
  );
}
