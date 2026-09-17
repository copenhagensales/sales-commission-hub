# Excel-udtræk: Switch-krydssalg (kampagne 105958), sidste 3 måneder

Rent læsetræk fra databasen. Ingen kode, data eller indstillinger ændres.

## Afgrænsning
- Kampagne: dialer-kampagne 105958 (CPH Sales – Switch Krydssalgs kampagne)
- Periode: 17-06-2026 til i dag (sidste 3 måneder) — 273 salg i alt i kampagnen
- Produkter der medtages (uanset hvad der står efter navnet, fx ATL, #1, #3):
  - Omstillingsbruger
  - Switch Contact Center
  - Switch Professionel
  - Switch Unlimited
- Alle salg medtages, også annullerede
- Kun de fire udvalgte produkter vises — øvrige produkter på samme salg udelades

## Sådan ser arket ud
Én række pr. produkt pr. salg:

| Sales ID (CVR) | Produkt | Antal |
|---|---|---|
| 45706052 | Omstillingsbruger ATL | 1 |
| 39064499 | Switch Contact Center #3 | 1 |

Sales ID hentes fra salgets Adversus-felt "Sales ID", som er CVR-nummeret. Er feltet tomt på et enkelt salg, bruges Stork-referencen i stedet, så ingen linjer forsvinder.

## Hvad vi ved på forhånd
Ud fra data i perioden findes: Omstillingsbruger (ATL, #3), Switch Contact Center (ATL, #1, #3) og Switch Professionel (ATL, #3). Der er ingen salg af "Switch Unlimited" i kampagnen i de sidste 3 måneder — den vil derfor stå tom i arket.

## Teknisk
- Læsning: `sales` (filter `dialer_campaign_id = '105958'`, `sale_datetime >= now() - interval '3 months'`) joinet til `sale_items` og `products`; produktnavn matches med `ilike` på de fire præfikser mod produktnavn med fallback til `adversus_product_title`.
- Sales ID læses fra `raw_payload -> 'leadResultFields' ->> 'Sales ID'`.
- Antal = `sale_items.quantity`.
- Filen bygges med openpyxl og gemmes i Files som `switch-krydssalg-105958-sidste-3-maaneder.xlsx`. Ingen formler, så ingen genberegning nødvendig.
