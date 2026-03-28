import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, CheckCircle2, BookOpen, ArrowLeft, FileCheck, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const awarenessActivities = [
  {
    title: "GDPR-samtykke ved første login",
    description: "Alle medarbejdere præsenteres for en GDPR-samtykkedialog ved deres første login. Dialogen beskriver hvilke data vi behandler, formålet, og medarbejderens rettigheder. Medarbejderen skal aktivt acceptere før de kan bruge systemet.",
    mechanism: "Automatisk — GdprConsentDialog vises ved login hvis samtykke mangler",
    frequency: "Engangshændelse ved oprettelse + ved ændring af samtykketekst",
    evidence: "Samtykke logges i gdpr_consents med tidsstempel, samtykketekst, IP og user agent",
    icon: Shield,
    status: "Aktiv",
  },
  {
    title: "Code of Conduct quiz",
    description: "Medarbejdere gennemfører en Code of Conduct-quiz der dækker interne retningslinjer for datahåndtering, fortrolighed, og adfærd. Quizzen skal bestås med minimum godkendt score.",
    mechanism: "Code of Conduct-modul med spørgsmål og scoring",
    frequency: "Ved onboarding + kan genåbnes af admin",
    evidence: "Quiz-besvarelse og resultat logges i databasen med tidsstempel",
    icon: FileCheck,
    status: "Aktiv",
  },
  {
    title: "Onboarding-gennemgang af datahåndtering",
    description: "Under onboarding-forløbet informeres nye medarbejdere om virksomhedens databehandlingspraksis, herunder hvem der har adgang til hvad, og hvordan man rapporterer sikkerhedshændelser.",
    mechanism: "Onboarding-coaching modul med opgaver og checkliste",
    frequency: "Ved ansættelsesstart",
    evidence: "Coaching-opgaver trackes i onboarding_coaching_tasks med status og completion",
    icon: BookOpen,
    status: "Aktiv",
  },
  {
    title: "Compliance-sektion med intern dokumentation",
    description: "Alle medarbejdere har adgang til compliance-sektionen med privacy-dokumentation, rettigheder og processer. Sektionen er tilgængelig via sidebar og indeholder opdateret information om GDPR.",
    mechanism: "Compliance & Privatliv-sektion i systemet",
    frequency: "Løbende tilgængelig",
    evidence: "Dokumentation vedligeholdt og tilgængelig for alle roller",
    icon: MessageSquare,
    status: "Aktiv",
  },
];

export default function GdprAwareness() {
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
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">Medarbejder-awareness</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Dokumentation af GDPR-oplysning og træning af medarbejdere
          </p>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-foreground space-y-1">
              <p>
                GDPR kræver at medarbejdere der behandler persondata er informeret om reglerne og virksomhedens praksis. 
                Denne side dokumenterer de mekanismer vi bruger til at sikre awareness.
              </p>
              <p className="text-muted-foreground text-xs">
                GDPR-ansvarlig: Kasper Mikkelsen · Sidst opdateret: juni 2025
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {awarenessActivities.map((activity, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <activity.icon className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{activity.title}</CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                    {activity.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <CardDescription className="text-sm leading-relaxed">
                  {activity.description}
                </CardDescription>

                <div className="grid md:grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <h4 className="font-semibold text-xs text-muted-foreground mb-1">Mekanisme</h4>
                    <p className="text-sm">{activity.mechanism}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <h4 className="font-semibold text-xs text-muted-foreground mb-1">Frekvens</h4>
                    <p className="text-sm">{activity.frequency}</p>
                  </div>
                  <div className="rounded-lg border p-3 bg-muted/30">
                    <h4 className="font-semibold text-xs text-muted-foreground mb-1">Dokumentation</h4>
                    <p className="text-sm">{activity.evidence}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div className="text-sm text-foreground space-y-1">
              <p className="font-semibold">Samlet vurdering</p>
              <p className="text-muted-foreground">
                Medarbejdere informeres systematisk om GDPR via samtykke ved login, Code of Conduct-quiz ved onboarding, 
                og løbende adgang til intern compliance-dokumentation. Alle aktiviteter logges elektronisk og kan 
                dokumenteres over for Datatilsynet.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
