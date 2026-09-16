# Excel: antal solgte enheder pr. produkt — Tryg og Finansforbundet, august 2026

Ren dataudtræk. Ingen kodeændringer, ingen migrationer, ingen ændringer i salgs-, løn- eller provisionsdata.

## Indhold i filen
Ét ark med tre kolonner:

| Kunde | Produkt | Antal enheder |
|---|---|---|

- Kunder: Tryg og Finansforbundet (begge ligger under team United).
- Periode: salg med salgstidspunkt i august 2026 (dansk tid).
- Antal = sum af solgte enheder pr. produkt, inkl. annullerede salg.
- Sorteret efter kunde og derefter faldende antal.

## Teknisk
- Kilde: `sales` → `client_campaigns` → `clients` for kundefilter, `sale_items` → `products` for produktnavn og `quantity`.
- Periodefilter på `sale_datetime` i tidszonen Europe/Copenhagen for at undgå UTC-forskydning ved månedsskifte.
- Ingen filtrering på `is_cancelled` eller `status` (alle salg med).
- Linjer uden produktmapping vises med produktnavnet fra `adversus_product_title`/`display_name` og markeres som "(ikke mappet)", så tallene ikke forsvinder.
- Filen bygges med openpyxl og lægges i Files som `antal-salg-pr-produkt-tryg-finansforbundet-august-2026.xlsx`.
