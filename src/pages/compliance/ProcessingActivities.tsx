import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const activities = [
  {
    id: "lon-provision",
    title: "Løn og provision",
    purpose: "Beregning og udbetaling af løn, provision og bonus til medarbejdere.",
    legalBasis: "Art. 6(1)(b) – Nødvendig for kontraktopfyldelse",
    dataSubjects: "Ansatte medarbejdere",
    dataTypes: "Navn, CPR-nr., bankoplysninger, løndata, provisionsberegninger, skatteoplysninger",
    recipients: "Lønbureau, SKAT, pensionsselskab",
    retention: "5 år efter ansættelsesophør (bogføringslovens krav)",
    security: "Krypteret lagring, adgangskontrol baseret på roller, audit logging",
  },
  {
    id: "rekruttering",
    title: "Rekruttering",
    purpose: "Behandling af ansøgninger, interviews og ansættelse af nye medarbejdere.",
    legalBasis: "Art. 6(1)(b) – Foranstaltninger forud for kontraktindgåelse; Art. 6(1)(a) – Samtykke (ved længere opbevaring)",
    dataSubjects: "Ansøgere/kandidater",
    dataTypes: "Navn, email, telefon, CV, ansøgning, interviewnoter, vurdering",
    recipients: "Relevante ledere og rekrutteringsansvarlige",
    retention: "6 måneder efter afslag (automatisk anonymisering). Ved samtykke op til 12 måneder.",
    security: "Rollebaseret adgang, kun rekrutteringsteam har adgang til kandidatdata",
  },
  {
    id: "vagtplan",
    title: "Vagtplanlægning og booking",
    purpose: "Planlægning af vagter, booking af lokationer, tildeling af medarbejdere til opgaver.",
    legalBasis: "Art. 6(1)(b) – Nødvendig for kontraktopfyldelse",
    dataSubjects: "Ansatte medarbejdere",
    dataTypes: "Navn, arbejdstider, lokation, transportbehov",
    recipients: "Teamledere, vagtplanlæggere",
    retention: "2 år efter vagtens afslutning",
    security: "Adgangskontrol via teamtilknytning og rollerettigheder",
  },
  {
    id: "salg",
    title: "Salgsregistrering og tracking",
    purpose: "Registrering og opfølgning på salg, beregning af provision og KPI'er.",
    legalBasis: "Art. 6(1)(b) – Kontraktopfyldelse; Art. 6(1)(f) – Legitim interesse (performance tracking)",
    dataSubjects: "Ansatte sælgere, kunder",
    dataTypes: "Sælgernavn, email, salgsdata, kundetelefon, kundefirma, produktvalg",
    recipients: "Ledere, backoffice, klienter (aggregeret)",
    retention: "Salgsdata: 5 år (bogføringsloven). Kundedata: ifølge datafelters retentionspolitik.",
    security: "RLS-politikker, rollebaseret adgang, PII-markering af felter",
  },
  {
    id: "coaching",
    title: "Onboarding og coaching",
    purpose: "Struktureret onboarding og løbende coaching af medarbejdere.",
    legalBasis: "Art. 6(1)(f) – Legitim interesse (medarbejderudvikling)",
    dataSubjects: "Nye og eksisterende medarbejdere",
    dataTypes: "Navn, opgavestatus, feedback, udviklingsfokus",
    recipients: "Teamledere, HR",
    retention: "Aktiv ansættelsesperiode + 1 år",
    security: "Kun leder og medarbejder selv har adgang til coachingdata",
  },
  {
    id: "amo",
    title: "Arbejdsmiljøorganisation (AMO)",
    purpose: "Dokumentation af arbejdsmiljøarbejde, APV, møder og uddannelse iht. arbejdsmiljøloven.",
    legalBasis: "Art. 6(1)(c) – Retlig forpligtelse (arbejdsmiljøloven)",
    dataSubjects: "AMO-medlemmer, medarbejdere",
    dataTypes: "Navn, rolle, uddannelse, mødedeltagelse, APV-resultater",
    recipients: "AMO-udvalg, Arbejdstilsynet (ved tilsyn)",
    retention: "5 år efter AMO-periodens udløb",
    security: "Adgangskontrol via AMO-roller, audit logging",
  },
  {
    id: "tidsstempling",
    title: "Tidsregistrering",
    purpose: "Registrering af arbejdstid for lønberegning og overholdelse af arbejdstidsdirektivet.",
    legalBasis: "Art. 6(1)(c) – Retlig forpligtelse (arbejdstidsdirektivet); Art. 6(1)(b) – Kontraktopfyldelse",
    dataSubjects: "Ansatte medarbejdere",
    dataTypes: "Medarbejder-ID, check-in/ud-tidspunkter, GPS-lokation (ved samtykke)",
    recipients: "Lønbureau, ledere",
    retention: "5 år (bogføringsloven)",
    security: "Kun medarbejderen selv og ledere kan se tidsregistreringer",
  },
  {
    id: "fravær",
    title: "Fraværshåndtering",
    purpose: "Registrering og administration af sygdom, ferie og andet fravær.",
    legalBasis: "Art. 6(1)(b) – Kontraktopfyldelse; Art. 9(2)(b) – Nødvendig for arbejdsretlige forpligtelser (helbredsdata)",
    dataSubjects: "Ansatte medarbejdere",
    dataTypes: "Fraværstype, datoer, evt. lægeattester",
    recipients: "Leder, HR, lønbureau",
    retention: "Aktiv ansættelse + 2 år",
    security: "Følsomme data kun tilgængelige for HR og nærmeste leder",
  },
  {
    id: "kontrakter",
    title: "Kontrakthåndtering",
    purpose: "Oprettelse, udsendelse og digital signering af ansættelseskontrakter.",
    legalBasis: "Art. 6(1)(b) – Kontraktopfyldelse",
    dataSubjects: "Ansatte og kommende medarbejdere",
    dataTypes: "Navn, CPR, adresse, løn, ansættelsesvilkår, digital signatur",
    recipients: "HR, lønbureau",
    retention: "5 år efter ansættelsesophør",
    security: "Krypteret lagring, tokenbaseret adgang til signering",
  },
];

export default function ProcessingActivities() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/compliance")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Shield className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Fortegnelse over behandlingsaktiviteter</h1>
            <p className="text-sm text-muted-foreground">GDPR Artikel 30 – Stork Copenhagen Sales ApS</p>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 text-sm text-foreground">
            <p><strong>Dataansvarlig:</strong> Stork Copenhagen Sales ApS</p>
            <p><strong>Sidst opdateret:</strong> {new Date().toLocaleDateString("da-DK")}</p>
            <p className="mt-2">
              Denne fortegnelse dokumenterer alle behandlingsaktiviteter i henhold til GDPR Artikel 30. 
              Fortegnelsen vedligeholdes løbende og gennemgås minimum årligt.
            </p>
          </CardContent>
        </Card>

        <Accordion type="multiple" className="space-y-3">
          {activities.map((activity, index) => (
            <AccordionItem key={activity.id} value={activity.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">{index + 1}</Badge>
                  <span className="font-semibold text-left">{activity.title}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 pt-2">
                  <Row label="Formål" value={activity.purpose} />
                  <Row label="Retsgrundlag" value={activity.legalBasis} />
                  <Row label="Kategorier af registrerede" value={activity.dataSubjects} />
                  <Row label="Kategorier af persondata" value={activity.dataTypes} />
                  <Row label="Modtagere" value={activity.recipients} />
                  <Row label="Slettefrist" value={activity.retention} />
                  <Row label="Sikkerhedsforanstaltninger" value={activity.security} />
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </MainLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-2 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
