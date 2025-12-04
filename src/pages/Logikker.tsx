import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListChecks, Info, RefreshCw, Layers3, UserX } from "lucide-react";

export default function Logikker() {
  return (
    <MainLayout>
      <main className="space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Forretningslogikker</h1>
          <p className="text-muted-foreground">
            Opsamling af de vigtigste regler for salg, provision og Adversus-data i systemet.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListChecks className="h-5 w-5" />
                Salg & mængder
              </CardTitle>
              <CardDescription>
                Hvordan vi tæller salg og produkter på alle dashboards.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                <li>Et "salg" er defineret som en <strong>sale_item</strong> (produktlinje), ikke en række i sales-tabellen.</li>
                <li>Alle KPI'er for antal salg (fx "Salg i dag", "Salg denne måned") bruger <strong>quantity</strong> fra Adversus.</li>
                <li>Det betyder, at hvis et produkt har quantity = 3, tælles det som 3 salg/enheder på dashboards.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Rettelser fra Adversus
              </CardTitle>
              <CardDescription>
                Håndtering af samme salg (samme result_id) der sendes flere gange.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                <li>Hvis Adversus sender <strong>flere events med samme result_id på samme kalenderdag</strong>, bruger vi <strong>kun den seneste</strong>.</li>
                <li>Ved en rettelse samme dag slettes de gamle sale/sale_items for det result_id, og der oprettes nye ud fra den nyeste event.</li>
                <li>Hvis der kommer en ny event med samme result_id <strong>efter dagen er skiftet</strong>, bliver den <strong>ignoreret til alle dashboards</strong> (kun gemt i Adversus data-oversigten).</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layers3 className="h-5 w-5" />
                Kunder, kampagner & produkter
              </CardTitle>
              <CardDescription>
                Mapping og provision.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                <li>Indkommende Adversus kampagner mappes til interne klient-kampagner via <strong>MG test</strong>-siden.</li>
                <li>Produkter mappes først via <strong>externalId</strong>, og ellers forsøges et match på <strong>titel/navn</strong>.</li>
                <li>Provision (commission_dkk) og omsætning (revenue_dkk) hentes fra produktet og multipliceres med <strong>quantity</strong>.</li>
                <li>Hvis et produkt ikke kan mappes, markeres det som <strong>needs_mapping</strong> og kan efterfølgende løses i mapping-UI'et.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                Dashboards & datoer
              </CardTitle>
              <CardDescription>
                Hvordan salget lander i de enkelte visninger.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                <li>Dashboard, Wallboard, Codan og TDC Erhverv bruger alle <strong>sale_items</strong> og <strong>quantity</strong> til at tælle salg.</li>
                <li>Salg vises kun på kundespecifikke dashboards, hvis <strong>client_campaign_id</strong> er sat korrekt via kampagnemapping.</li>
                <li>Seneste TDC Erhverv-salg viser produktnavn sammen med <strong>(x quantity)</strong> pr. linje.</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserX className="h-5 w-5" />
                Medarbejderdata & opbevaring
              </CardTitle>
              <CardDescription>
                Regler for opbevaring og sletning af medarbejderdata.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <ul className="list-disc space-y-1 pl-5">
                <li>Inaktive medarbejdere <strong>slettes automatisk efter 5 år</strong> fra slutdato.</li>
                <li>Ved inaktivering sættes <strong>slutdato</strong> automatisk til dags dato.</li>
                <li>Ved genaktivering sættes <strong>ansættelsesdato</strong> til dags dato og slutdato ryddes.</li>
                <li>Oprydning kører automatisk én gang dagligt via baggrundsjob.</li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>
    </MainLayout>
  );
}
