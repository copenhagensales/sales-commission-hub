import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Globe, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const transfers = [
  {
    recipient: "Twilio",
    categories: "Telefonnumre, SMS-indhold",
    location: "EU",
    legalBasis: "GDPR Art. 28",
    dpaType: "Standard DPA",
    dpaUrl: "https://www.twilio.com/legal/data-protection-addendum",
    purpose: "SMS-kommunikation med kandidater og medarbejdere",
  },
  {
    recipient: "Meta (Facebook)",
    categories: "Email, telefon, navn (hashet)",
    location: "EU",
    legalBasis: "GDPR Art. 28",
    dpaType: "Standard vilkår",
    dpaUrl: "https://www.facebook.com/legal/terms/dataprocessing",
    purpose: "Konversionssporing for rekrutteringskampagner (CAPI)",
  },
  {
    recipient: "Microsoft 365",
    categories: "Email-adresser, navne",
    location: "EU",
    legalBasis: "GDPR Art. 28",
    dpaType: "Standard DPA",
    dpaUrl: "https://learn.microsoft.com/legal/cognitive-services/openai/data-privacy",
    purpose: "Afsendelse af systemgenererede emails (invitationer, password reset)",
  },
  {
    recipient: "e-conomic",
    categories: "Faktureringsdata",
    location: "EU (DK)",
    legalBasis: "GDPR Art. 28",
    dpaType: "Standard DPA",
    dpaUrl: "https://www.visma.com/trust-centre/dpa",
    purpose: "Bogføring og økonomi-integration",
  },
  {
    recipient: "Adversus",
    categories: "Agent-emails, kampagnedata, salgsdata",
    location: "EU",
    legalBasis: "GDPR Art. 28",
    dpaType: "Standard DPA",
    dpaUrl: "https://www.adversus.io/legal/dpa",
    purpose: "Dialer-integration og salgsregistrering",
  },
];

export default function DataTransferRegistry() {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="max-w-5xl mx-auto space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/compliance")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <Globe className="h-7 w-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dataoverførsler til tredjeparter</h1>
              <p className="text-muted-foreground text-sm">
                Oversigt over alle tredjeparter der modtager persondata fra systemet
              </p>
            </div>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div className="text-sm text-foreground space-y-1">
              <p>
                Alle tredjepartsleverandører er EU-hostede og har en aktiv databehandleraftale (DPA).
                Ingen persondata overføres til lande uden for EU/EØS.
              </p>
              <p className="text-muted-foreground">
                DPA-links henviser til leverandørernes offentligt tilgængelige databehandleraftaler, som accepteres ved brug af tjenesten.
              </p>
              <p className="text-muted-foreground">
                Sidst gennemgået: marts 2026
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Registrerede datamodtagere</CardTitle>
            <CardDescription>
              Jf. GDPR Art. 28 – oversigt over databehandlere og kategorier af overført data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modtager</TableHead>
                  <TableHead>Datakategorier</TableHead>
                  <TableHead>Lokation</TableHead>
                  <TableHead>Retsgrundlag</TableHead>
                  <TableHead>DPA-type</TableHead>
                  <TableHead>Formål</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.recipient}>
                    <TableCell className="font-medium">{t.recipient}</TableCell>
                    <TableCell className="text-sm">{t.categories}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/30">
                        {t.location}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.legalBasis}</TableCell>
                    <TableCell>
                      <a
                        href={t.dpaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        {t.dpaType}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                      {t.purpose}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sikkerhedsforanstaltninger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-foreground">
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p>Alle API-nøgler og credentials opbevares krypteret og er kun tilgængelige for backend-funktioner.</p>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p>Data til Meta sendes som SHA-256 hashes – aldrig i klartekst.</p>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p>Al kommunikation sker over TLS 1.2+ (HTTPS).</p>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p>PII maskeres i alle serverside-logfiler for at forhindre utilsigtet eksponering.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
