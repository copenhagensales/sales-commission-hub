# Fibersalg vises ikke i Dagsrapporten

## Årsag (bekræftet i kode og data)
- Salget ligger korrekt: Olivers lukkede salg (625 kr.) og Williams lead (625 kr.) er gemt i dag 18:18 med hans arbejdsmail og agentkobling.
- Dagsrapporten (`src/pages/reports/DailyReports.tsx:1010-1013`) springer en dag over, når der er 0 timer **og** 0 salg og hverken sygdom eller ferie.
- Fibersalg er bisalg (`counts_as_sale=false`), så de giver 0 i salgsantal. I dag er søndag, så Oliver har ingen vagttimer → dagen (og dermed Oliver) skjules, selvom der er 625 kr. provision.
- Dashboards viser det, fordi de tæller fibre separat.

## Rettelse
1. I dagsreglen beholdes dagen også, når der er provision, omsætning eller produktlinjer (`commission !== 0 || revenue !== 0 || dayProductDetails.length > 0`). Salgsantallet forbliver 0 for fibersalg (de er stadig bisalg), men provisionen og produktlinjen »Lukket salg VOK« vises.
2. Søsterfejl: Dagsrapporten filtrerer ikke salg med status afvist fra. Det betyder, at fibersalg slettet med den nye »Slet«-knap (og afviste leaddele ved rettelser) stadig ville give provision i rapporten. Tilføj filter, så kun salg med `validation_status` tom eller ikke `rejected` hentes (samme regel som leaderboard/boards). Dette påvirker også andre kunders afviste salg i denne rapport – de forsvinder fra rapporten, som de allerede gør på boards og i lønnen.

Kun `DailyReports.tsx` ændres. Ingen database-, løn- eller rettighedsændringer.

## Kontrol
- Åbn Dagsrapport for i dag i preview som admin og se Oliver med 625 kr. og William med lead.
- Typecheck/build.
