import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Shield, Users, Eye, Clock, Scale, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function EmployeePrivacy() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6 p-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/compliance")} className="gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Tilbage til oversigt
        </Button>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Users className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Privatliv for medarbejdere</h1>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border-blue-500/30">For medarbejdere</Badge>
          </div>
          <p className="text-muted-foreground">
            Denne side forklarer, hvordan Stork Copenhagen Sales behandler personoplysninger om medarbejdere i forbindelse med ansættelse, administration, løn, provision, performance, vagtplan og brug af interne systemer.
          </p>
        </div>

        {/* Highlight box */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-foreground">
              Vi behandler kun de oplysninger, der er nødvendige for konkrete og saglige formål, og adgangen er begrænset efter rolle og arbejdsbehov.
            </p>
          </CardContent>
        </Card>

        {/* Summary card */}
        <Card className="border-muted">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground italic">
              Vi bruger medarbejderdata til administration, løn, provision, planlægning og relevante driftsformål. Adgang gives efter rolle og behov.
            </p>
          </CardContent>
        </Card>

        <Accordion type="multiple" defaultValue={["om", "hvilke", "hvorfor", "adgang", "opbevaring", "rettigheder"]} className="space-y-3">
          <AccordionItem value="om" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">Om denne side</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
              Vi behandler personoplysninger for at kunne administrere ansættelsesforhold, udbetale løn og provision, understøtte drift og planlægning samt sikre korrekt registrering og opfølgning på relevante arbejdsrelaterede forhold.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="hvilke" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">Hvilke oplysninger vi behandler</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Vi kan blandt andet behandle følgende oplysninger om medarbejdere:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>navn</li>
                <li>e-mailadresse</li>
                <li>ansættelsesoplysninger</li>
                <li>lønoplysninger</li>
                <li>provisionsdata</li>
                <li>salgsperformance</li>
                <li>vagt- og planlægningsoplysninger</li>
                <li>interne administrative oplysninger, når det er nødvendigt</li>
              </ul>
              <p>Vi behandler kun de oplysninger, der er nødvendige for et konkret og sagligt formål.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="hvorfor" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">Hvorfor vi behandler oplysningerne</AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Vi behandler medarbejderoplysninger for at kunne:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>administrere ansættelsesforhold</li>
                <li>sende og opbevare kontrakter og ansættelsesrelaterede dokumenter</li>
                <li>beregne og dokumentere løn og provision</li>
                <li>vise relevante oplysninger til medarbejderen selv</li>
                <li>understøtte planlægning, ledelse og opfølgning</li>
                <li>dokumentere og kontrollere arbejdsrelaterede registreringer</li>
                <li>opfylde lovgivningsmæssige forpligtelser</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="adgang" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Eye className="h-4 w-4" /> Adgang til oplysninger</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Adgang til medarbejderoplysninger gives efter rolle og arbejdsbehov. Systemet anvender rollebaseret adgangsstyring:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Medarbejder:</strong> kan se egne oplysninger — løn, provision, vagtplan og personlige data</li>
                <li><strong>Teamleder:</strong> kan se salgs- og vagtdata for eget teams medarbejdere</li>
                <li><strong>Ejer/administrator:</strong> fuld adgang til administration, løn, drift og systemkonfiguration</li>
              </ul>
              <p>Adgang må aldrig være bredere end nødvendigt for den pågældende rolle.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="opbevaring" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Clock className="h-4 w-4" /> Hvor længe vi opbevarer oplysningerne</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Vi opbevarer medarbejderoplysninger i henhold til følgende retningslinjer:</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-border rounded">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left p-2 border-b border-border font-medium">Datatype</th>
                      <th className="text-left p-2 border-b border-border font-medium">Opbevaringstid</th>
                      <th className="text-left p-2 border-b border-border font-medium">Grundlag</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="p-2 border-b border-border">Løn- og økonomidata</td><td className="p-2 border-b border-border">5 år</td><td className="p-2 border-b border-border">Bogføringsloven §10</td></tr>
                    <tr><td className="p-2 border-b border-border">Salgs- og provisionsdata</td><td className="p-2 border-b border-border">5 år</td><td className="p-2 border-b border-border">Bogføringsloven §10</td></tr>
                    <tr><td className="p-2 border-b border-border">Øvrig medarbejderdata</td><td className="p-2 border-b border-border">Senest 5 år efter fratrædelse</td><td className="p-2 border-b border-border">Legitim interesse</td></tr>
                    <tr><td className="p-2">Ansøgerdata</td><td className="p-2">6 måneder efter afslag</td><td className="p-2">Samtykke / legitim interesse</td></tr>
                  </tbody>
                </table>
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="rettigheder" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              <span className="flex items-center gap-2"><Scale className="h-4 w-4" /> Dine rettigheder</span>
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Du kan have rettigheder efter databeskyttelsesreglerne, herunder:</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>ret til indsigt</li>
                <li>ret til rettelse</li>
                <li>ret til sletning i relevante tilfælde</li>
                <li>ret til begrænsning af behandling i relevante tilfælde</li>
                <li>ret til indsigelse i relevante tilfælde</li>
              </ul>
              <p>
                Hvis du har spørgsmål til, hvordan dine oplysninger behandles, eller ønsker at gøre brug af dine rettigheder, kan du kontakte{" "}
                virksomhedens ejer via <OwnerEmail />.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </MainLayout>
  );
}
