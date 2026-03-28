import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, Lock, Users, Database, Wallet, UserCheck, AlertTriangle, RefreshCcw, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function InternalProcesses() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/compliance")} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Tilbage til oversigt
        </Button>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Lock className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Interne processer og compliance</h1>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/30">Intern</Badge>
          </div>
          <p className="text-muted-foreground">
            Denne side beskriver de interne processer, som gælder for Stork Copenhagen Sales i relation til behandling af oplysninger, adgang, sletning, sikkerhed og kontrol i systemet.
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-foreground">
              Denne side er et internt styringsværktøj for systemejer, admin, ledelse, HR/løn og rekruttering.
            </p>
          </CardContent>
        </Card>

        <Card className="border-muted">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground italic">
              Denne side samler de vigtigste interne processer for adgang, kundedata, løn/provision, rekruttering, sikkerhed og review.
            </p>
          </CardContent>
        </Card>

        <Accordion type="multiple" defaultValue={["formaal", "roller", "kundedata", "loen", "rekruttering", "rettigheder", "sikkerhed", "review"]} className="space-y-3">
          <AccordionItem value="formaal" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Database className="h-4 w-4" /> Systemets formål</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Stork Copenhagen Sales er et internt system, som bruges til:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>medarbejderstamoplysninger</li>
                <li>kontrakthåndtering</li>
                <li>modtagelse og behandling af ansøgninger</li>
                <li>beregning og visning af løn og provision</li>
                <li>planlægning og dashboards</li>
                <li>kontrol og validering af salgsdata</li>
                <li>fakturakontrol og dokumentation</li>
              </ul>
              <p>Systemet er ikke en kundevendt løsning. Kunder har ikke adgang.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="roller" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Rolle- og adgangsstyring</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Adgang til systemet gives efter rolle og behov.</p>
              <p className="font-medium text-foreground">Overordnede principper:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>medarbejdere ser egne relevante data</li>
                <li>ledere ser egne teams relevante data</li>
                <li>admin kan se bredere data, når det er nødvendigt</li>
                <li>rekruttering kan se og behandle ansøgerdata</li>
                <li>roller skal løbende vurderes og vedligeholdes</li>
              </ul>

              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-foreground text-sm mb-2">Proces for oprettelse, ændring og lukning af adgang</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>adgang oprettes kun efter godkendelse</li>
                  <li>adgang tildeles ud fra arbejdsbehov</li>
                  <li>ved rolleændring justeres adgangen</li>
                  <li>ved fratrædelse eller bortfald af behov lukkes adgangen uden unødig forsinkelse</li>
                  <li>adgangsrettigheder skal gennemgås løbende</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="kundedata" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Database className="h-4 w-4" /> Behandling af kundedata i kontrolflow</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Kundedata kan indgå midlertidigt i systemet med henblik på kontrol og validering.</p>
              <p>Det kan eksempelvis være for at:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>matche kundens data med egne salgsdata</li>
                <li>kontrollere om sælgere har tastet korrekt</li>
                <li>validere provisionsgrundlag</li>
                <li>validere fakturagrundlag og afregning</li>
              </ul>
              <p>Kundedata må kun behandles, når der er et konkret og sagligt kontrolbehov.</p>

              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-foreground text-sm mb-2">Proces for kundedata</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>data må kun uploades, importeres eller hentes ved konkret behov</li>
                  <li>kun nødvendige data må behandles</li>
                  <li>data må kun bruges til kontrol, afstemning, dokumentation eller fejlretning</li>
                  <li>data skal slettes eller anonymiseres, når formålet er afsluttet</li>
                  <li>standardfrist for sletning er <span className="bg-yellow-200/60 text-yellow-800 px-1 rounded font-medium">[indsæt intern frist]</span></li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="loen" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Wallet className="h-4 w-4" /> Løn- og provisionskontrol</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Data, der bruges til løn og provision, skal være så korrekte og sporbare som muligt.</p>

              <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-foreground text-sm mb-2">Proces for løn og provision</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>beregningsgrundlag skal kunne forklares</li>
                  <li>væsentlige ændringer skal kunne dokumenteres</li>
                  <li>fejl og afvigelser skal undersøges</li>
                  <li>godkendelse skal ske, før løn og provision afsluttes</li>
                  <li>systemets logs og dokumentation bruges som kontrolspor</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="rekruttering" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><UserCheck className="h-4 w-4" /> Rekrutteringsproces</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Ansøgerdata må kun bruges til rekrutteringsformål.</p>

              <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-foreground text-sm mb-2">Proces for rekruttering</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>kun relevante personer må se ansøgerdata</li>
                  <li>noter skal være saglige og arbejdsrelevante</li>
                  <li>data slettes, når processen er afsluttet</li>
                  <li>længere opbevaring kræver særskilt grundlag</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="rettigheder" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">Håndtering af rettighedsanmodninger</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Hvis en medarbejder, ansøger eller anden registreret person anmoder om indsigt, rettelse eller sletning, skal henvendelsen håndteres kontrolleret.</p>

              <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-foreground text-sm mb-2">Proces for rettighedsanmodninger</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>anmodningen registreres</li>
                  <li>modtagelsesdato noteres</li>
                  <li>ansvarlig person tildeles</li>
                  <li>svarfrist følges</li>
                  <li>afgørelse og svar dokumenteres</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sikkerhed" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Sikkerhedshændelser</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Mistanke om sikkerhedsbrud, fejldeling, uautoriseret adgang eller andre alvorlige hændelser skal meldes straks.</p>

              <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                <p className="font-medium text-foreground text-sm mb-2">Proces for sikkerhedshændelser</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>hændelsen registreres straks</li>
                  <li>relevante data og personer identificeres</li>
                  <li>risiko vurderes</li>
                  <li>behov for anmeldelse vurderes</li>
                  <li>afhjælpende handlinger igangsættes</li>
                  <li>læring og forbedringer dokumenteres</li>
                </ul>
              </div>
              <p>Sikkerhedshændelser meldes til <span className="bg-yellow-200/60 text-yellow-800 px-1 rounded font-medium">[indsæt funktion eller mail]</span>.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="review" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><RefreshCcw className="h-4 w-4" /> Review og opfølgning</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Systemejer eller relevant ansvarlig gennemgår med faste intervaller:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>brugerroller og adgange</li>
                <li>åbne hændelser</li>
                <li>slettefrister</li>
                <li>leverandørforhold</li>
                <li>ændringer i datatyper eller formål</li>
                <li>opdateringsbehov i tekster og procedurer</li>
              </ul>
              <p>Review gennemføres <span className="bg-yellow-200/60 text-yellow-800 px-1 rounded font-medium">[indsæt frekvens, fx månedligt eller kvartalsvist]</span>.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </MainLayout>
  );
}
