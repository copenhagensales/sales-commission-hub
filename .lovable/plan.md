# Tryg - Ret salg: se afviste og godkendte salg over en periode

## Status i dag (bekræftet)
Markeringen gemmes allerede i databasen. Tabellen `tryg_sale_reviews` findes med `sale_item_id`, `status`, `reviewed_by`, `reviewed_by_name`, `reviewed_at` og har RLS-politikker for læsning, oprettelse, opdatering og sletning, alle betinget af `can_edit_report_templates(auth.uid())` — dvs. samme adgang som siden selv. Tabellen har 0 rækker, fordi der endnu ikke er trykket Afvis/Godkend.

Begrænsningen er alene visningen: alle tre faner henter kun salg for én valgt dag (`useTrygKanvasSales(day)`).

## Det der bygges
Fanerne **Afviste salg** og **Godkendte salg** får en periodevælger, så man kan se status for fx en hel uge eller måned bagud.

- Øverst på de to status-faner: en fra–til datovælger. Standard er den dag der er valgt i den nuværende dagsvælger (så adfærden er uændret indtil man ændrer perioden).
- Hurtigvalg: I dag, Sidste 7 dage, Denne måned, Sidste måned.
- Når perioden dækker mere end én dag, vises en ekstra kolonne **Dato** i de to status-tabeller, så man kan se hvilken dag salget er lavet.
- Fanen **Gennemgang** er uændret: den følger fortsat den valgte dag, så gennemgangen sker dag for dag.
- Telefon-søgningen virker fortsat på alle faner, nu inden for den valgte periode.
- Antallet i fane-overskrifterne følger perioden.

## Teknisk
- `src/hooks/useTrygKanvasSales.ts`: `useTrygKanvasSales` får en valgfri slut-dato (`useTrygKanvasSales(from, to?, enabled)`), så samme forespørgsel kan hente et interval. Uændret adfærd når `to` udelades. Query-key udvides med begge datoer.
- `src/pages/reports/TrygEditSales.tsx`: ny state for periode (`rangeFrom`, `rangeTo`) brugt af de to status-faner; dagsforespørgslen bevares til Gennemgang. Status hentes med `useTrygSaleReviews` for periodens `sale_item_id`'er.
- `src/components/reports/TrygSalesTable.tsx`: ny valgfri prop `showDate` der tilføjer Dato-kolonnen i `mode="status"`.
- Ingen ændringer i databasen, pricing, provision eller rapport-RPC'er. Afvis/Godkend skriver fortsat kun til `tryg_sale_reviews` — salgene røres ikke.

## Risiko
Kun læsning og UI. Perioder over lange intervaller henter flere rækker, men forespørgslen er begrænset til Kanvas-produktet, så volumen er lav.
