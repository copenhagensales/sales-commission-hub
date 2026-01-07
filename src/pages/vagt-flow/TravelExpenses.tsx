import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Train, 
  Building2, 
  Ban, 
  Utensils, 
  Calculator, 
  HelpCircle,
  AlertTriangle,
  Calendar
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";

const TravelExpenses = () => {
  const { t } = useTranslation();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rejsekort og diæter</h1>
          <p className="text-muted-foreground mt-2">
            Regler for brug af firmabetalt rejsekort/transport og udbetaling af diæter i forbindelse med arbejdsrejser.
          </p>
        </div>

        {/* Purpose */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Train className="h-5 w-5 text-primary" />
              Formål
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Denne sektion beskriver reglerne for brug af firmabetalt rejsekort/transport og udbetaling af diæter 
              i forbindelse med arbejdsrejser. Reglerne skal sikre korrekt afregning og ens behandling af alle medarbejdere.
            </p>
          </CardContent>
        </Card>

        {/* Section A: Transport Rules */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">A. Regler for rejsekort og transport</h2>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Train className="h-5 w-5 text-primary" />
                Hvad dækker virksomheden?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Virksomheden dækker kun <strong>arbejdsrelateret transport</strong>:
              </p>
              <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                <li>Til lokation (kundelokation/arbejdssted) og retur, i forbindelse med planlagt arbejde.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Når du starter på kontoret
              </CardTitle>
              <CardDescription>Mandag, onsdag og fredag</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                På de dage, hvor vi mødes på kontoret (mandag, onsdag og fredag), gælder:
              </p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-muted-foreground">
                  Hvis du tager på kontoret først, så dækker virksomheden <strong>ikke</strong> din transport hjemmefra til kontoret.
                </p>
              </div>
              <p className="text-muted-foreground font-medium">Virksomheden dækker i stedet kun:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>kontor → lokation</li>
                <li>lokation → kontor (eller anden aftalt retur i forbindelse med arbejdet)</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-destructive">
                <Ban className="h-5 w-5" />
                Forbud mod privat brug
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-muted-foreground">
                Rejsekort/transport betalt af virksomheden må <strong>ikke</strong> bruges:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>privat</li>
                <li>uden for arbejdstid</li>
                <li>til formål, der ikke er direkte arbejdsrelaterede</li>
              </ul>
              <div className="bg-destructive/10 p-4 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">
                  <strong>Overtrædelse:</strong> Hvis rejsekort/transport bruges i strid med reglerne, 
                  bliver beløbet trukket i løn, og det betragtes som et generelt forbud at bruge det privat.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section B: Per Diem Rules */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">B. Regler for diæter</h2>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" />
                Hvad er diæter hos os?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Diæter er et fast, <strong>skattefrit beløb</strong>, der gives i forbindelse med arbejdsrejser med overnatning.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Utensils className="h-5 w-5 text-primary" />
                Kost dækkes ikke
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Virksomheden dækker <strong>ikke</strong> udgifter til kost undervejs (mad/drikke), herunder eksempelvis:
              </p>
              <ul className="list-disc list-inside mt-2 text-muted-foreground space-y-1">
                <li>morgenmad</li>
                <li>frokost</li>
                <li>aftensmad</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calculator className="h-5 w-5 text-primary" />
                Hvornår får du diæter – og hvor meget?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  • Du får <strong>ikke</strong> diæt for rejsens første dag.
                </p>
                <p className="text-muted-foreground">
                  • Du får <strong>300 kr. pr. dag</strong> fra og med dag 2, så længe rejsen/opholdet varer.
                </p>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg space-y-3">
                <p className="font-medium">Eksempel:</p>
                <p className="text-sm text-muted-foreground">
                  Du rejser torsdag for at komme til en lokation og arbejder/overnatter ude:
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-background p-2 rounded">Torsdag:</div>
                  <div className="bg-background p-2 rounded font-medium">0 kr. (dag 1)</div>
                  <div className="bg-background p-2 rounded">Fredag:</div>
                  <div className="bg-background p-2 rounded font-medium text-primary">300 kr.</div>
                  <div className="bg-background p-2 rounded">Lørdag:</div>
                  <div className="bg-background p-2 rounded font-medium text-primary">300 kr.</div>
                  <div className="bg-background p-2 rounded">Søndag:</div>
                  <div className="bg-background p-2 rounded font-medium text-primary">300 kr. (hvis du først rejser hjem søndag)</div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Diæterne er skattefri, og derfor udbetales de som et fast beløb — og det betyder også, 
                at virksomheden ikke betaler kost undervejs.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Questions Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              Spørgsmål og afklaring
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Hvis du er i tvivl om, hvad der er en "lokation", hvordan en rejse skal afregnes, 
              eller om en konkret tur er dækningsberettiget, skal du <strong>altid afklare det med din leder inden rejsen</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default TravelExpenses;
