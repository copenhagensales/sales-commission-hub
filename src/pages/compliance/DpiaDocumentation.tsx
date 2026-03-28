import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertTriangle, CheckCircle2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const dpias = [
  {
    id: "cpr",
    title: "Behandling af CPR-numre",
    category: "Følsomme personoplysninger",
    riskLevel: "Høj",
    description: "CPR-numre opbevares for at sikre korrekt lønudbetaling og indberetning til SKAT. Behandlingen er nødvendig for at opfylde lovkrav i henhold til skattelovgivningen.",
    dataTypes: ["CPR-nummer", "Navn", "Ansættelsesforhold"],
    legalBasis: "Retlig forpligtelse (GDPR Art. 6(1)(c)) og Databeskyttelseslovens § 11",
    risks: [
      "Uautoriseret adgang til CPR-numre",
      "Datalæk ved eksport eller visning",
      "Misbrug af CPR-numre ved identitetstyveri",
    ],
    mitigations: [
      "CPR-numre er kun synlige for brugere med specifik rolleadgang (ejer/admin/HR)",
      "Row Level Security (RLS) på databaseniveau sikrer at kun autoriserede kan tilgå data",
      "CPR-felter er maskeret i UI — kun de sidste 4 cifre vises som standard",
      "Al redigering af følsomme felter (CPR, bank) logges automatisk i audit-loggen (Compliance → Audit-log)",
      "Data krypteres i transit (TLS) og at rest (AES-256)",
    ],
    conclusion: "Risikoen er acceptabel med de implementerede foranstaltninger. Behandlingen er nødvendig og proportional.",
    reviewDate: "2025-06-15",
    reviewer: "Kasper Mikkelsen",
  },
  {
    id: "salary",
    title: "Lønberegning og provisionsdata",
    category: "Økonomiske personoplysninger",
    riskLevel: "Høj",
    description: "Systemet behandler løndata, provisioner, bankoplysninger og ansættelsesvilkår for at beregne og udbetale løn korrekt.",
    dataTypes: ["Bankkontonummer", "Lønsats", "Provisionsbeløb", "Ansættelsestype", "Skatteoplysninger"],
    legalBasis: "Kontraktopfyldelse (GDPR Art. 6(1)(b)) og retlig forpligtelse (Art. 6(1)(c))",
    risks: [
      "Uautoriseret adgang til løn- og bankdata",
      "Fejl i provisionsberegning kan medføre forkert udbetaling",
      "Datalæk af økonomiske oplysninger",
    ],
    mitigations: [
      "Streng rollebaseret adgang — kun økonomi-/HR-roller kan se løndata",
      "RLS-politikker sikrer at medarbejdere kun kan se egne lønoplysninger",
      "Bankoplysninger krypteres og vises kun maskeret",
      "Provisionsberegninger auditeres og kan valideres manuelt",
      "Automatisk sletning af løndata efter lovpligtig opbevaringsperiode (5 år jf. bogføringsloven)",
    ],
    conclusion: "Behandlingen er nødvendig og proportional. De tekniske og organisatoriske foranstaltninger reducerer risikoen til et acceptabelt niveau.",
    reviewDate: "2025-06-15",
    reviewer: "Kasper Mikkelsen",
  },
  {
    id: "recruitment",
    title: "Rekrutteringsdata og ansøgeroplysninger",
    category: "Almindelige personoplysninger",
    riskLevel: "Medium",
    description: "Systemet behandler ansøgerdata i forbindelse med rekruttering, herunder CV, kontaktoplysninger, interviewnoter og vurderinger.",
    dataTypes: ["Navn", "Email", "Telefon", "CV/resumé", "Interviewnoter", "Vurdering/rating"],
    legalBasis: "Interesseafvejning (GDPR Art. 6(1)(f)) og samtykke ved opbevaring ud over rekrutteringsperioden",
    risks: [
      "Opbevaring af ansøgerdata ud over nødvendig periode",
      "Uberettiget deling af interviewnoter",
      "Manglende sletning efter afslag",
    ],
    mitigations: [
      "Automatisk sletning af afviste ansøgere efter konfigureret retention-periode",
      "Adgang til ansøgerdata begrænset til rekrutteringsteamet via RLS",
      "Interviewnoter er kun synlige for den ansvarlige rekruttør og ledere",
      "Ansøgere informeres om databehandling ved ansøgning",
      "Mulighed for manuel sletning via GDPR-datahåndtering",
    ],
    conclusion: "Risikoen er moderat og håndteres med eksisterende foranstaltninger. Retention-politikker sikrer rettidig sletning.",
    reviewDate: "2025-06-15",
    reviewer: "Kasper Mikkelsen",
  },
];

export default function DpiaDocumentation() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-8 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/compliance")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Tilbage
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Konsekvensanalyse (DPIA)</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Artikel 35 — Vurdering af konsekvenser for databeskyttelse ved højrisiko-behandlinger
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-foreground space-y-1">
              <p>
                Denne side dokumenterer de konsekvensanalyser (DPIA) der er gennemført for behandlingsaktiviteter med høj risiko for de registreredes rettigheder og frihedsrettigheder.
              </p>
              <p className="text-muted-foreground text-xs">
                Senest gennemgået: 15. juni 2025 · Ansvarlig: Kasper Mikkelsen
              </p>
            </div>
          </CardContent>
        </Card>

        <Accordion type="multiple" className="space-y-4">
          {dpias.map((dpia) => (
            <AccordionItem key={dpia.id} value={dpia.id} className="border rounded-lg overflow-hidden">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <AlertTriangle className={`h-5 w-5 shrink-0 ${dpia.riskLevel === "Høj" ? "text-destructive" : "text-yellow-500"}`} />
                  <div>
                    <div className="font-semibold">{dpia.title}</div>
                    <div className="text-sm text-muted-foreground">{dpia.category}</div>
                  </div>
                  <Badge variant="outline" className={
                    dpia.riskLevel === "Høj"
                      ? "bg-red-500/10 text-red-700 border-red-500/30 ml-auto"
                      : "bg-yellow-500/10 text-yellow-700 border-yellow-500/30 ml-auto"
                  }>
                    Risiko: {dpia.riskLevel}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">Beskrivelse</h4>
                  <p className="text-sm text-muted-foreground">{dpia.description}</p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <h4 className="font-semibold text-sm mb-2">Datatyper</h4>
                    <div className="flex flex-wrap gap-1">
                      {dpia.dataTypes.map((dt) => (
                        <Badge key={dt} variant="secondary" className="text-xs">{dt}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <h4 className="font-semibold text-sm mb-2">Retsgrundlag</h4>
                    <p className="text-sm text-muted-foreground">{dpia.legalBasis}</p>
                  </div>
                </div>

                <div className="rounded-lg border p-3 bg-destructive/5">
                  <h4 className="font-semibold text-sm mb-2 text-destructive">Identificerede risici</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {dpia.risks.map((r, i) => <li key={i}>{r}</li>)}
                  </ul>
                </div>

                <div className="rounded-lg border p-3 bg-green-500/5">
                  <h4 className="font-semibold text-sm mb-2 text-green-700">Foranstaltninger</h4>
                  <ul className="space-y-1">
                    {dpia.mitigations.map((m, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                        {m}
                      </li>
                    ))}
                  </ul>
                </div>

                <Card className="bg-muted/30">
                  <CardContent className="p-3">
                    <h4 className="font-semibold text-sm mb-1">Konklusion</h4>
                    <p className="text-sm text-muted-foreground">{dpia.conclusion}</p>
                    <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Gennemgået: {dpia.reviewDate}</span>
                      <span>Af: {dpia.reviewer}</span>
                    </div>
                  </CardContent>
                </Card>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </MainLayout>
  );
}
