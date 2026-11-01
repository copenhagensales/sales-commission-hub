# Fiberlead mangler på dagsrapporten

## Årsag (bekræftet i koden)
`src/pages/reports/DailyReports.tsx:1010-1013` springer en dag over, når timer = 0 og salg = 0 (og ikke syg/ferie):

```text
if (hours === 0 && salesCount === 0 && !isSick && !isVacation) continue;
```

Fiberleads er bisalg (`counts_as_sale=false`), så salgsantal er 0. Seans lead er oprettet søndag, hvor han ikke har timer, så dagen – og dermed provisionen (625 kr.) – forsvinder fra rapporten, selvom salget findes. Det samme gælder alle bisalg på dage uden timer (også Oliver).

Sekundært: rapporten filtrerer ikke afviste/slettede salg fra (fx fibersalg slettet med "Slet"), så de kunne tælle med 0 kr. men stadig vise produktlinjer.

## Ændring (kun visning i dagsrapporten)
1. Behold en dag, hvis den har provision, omsætning eller produktlinjer – også når timer og salg er 0.
2. Udelad afviste salgslinjer, så slettede fibersalg ikke vises.

Ingen ændring af salg, provision, priser, løn-beregning, rettigheder eller database. Totaler bliver ikke ændret for dage, der allerede vises; kun manglende provision kommer med.

## Bemærk
- Hvis rapporten filtreres på kunden Relatel, vil Seans lead stadig ikke vises, fordi salget ligger på TDC Erhverv-kampagnen. Det er uændret adfærd.
- Lønsiden (sælgerløn) bruger en anden beregning; denne ændring rører den ikke.

## Kontrol
- Åbn dagsrapporten for lønperioden og bekræft, at Sean og Oliver vises med 625 kr. søndag.
- Tjek at totaler for øvrige sælgere er uændrede.
