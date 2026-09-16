# Excel: antal solgte enheder pr. produkt — alle kunder under United, august 2026

Ren dataudtræk. Ingen kodeændringer, ingen migrationer, ingen ændringer i salgs-, løn- eller provisionsdata.

## Indhold i filen
Ét ark med tre kolonner:

| Kunde | Produkt | Antal enheder |
|---|---|---|

- Kunder: alle kunder tilknyttet team United (i dag: A&Til, AKA, ALKA, Ase, Business DK, Codan, Finansforbundet, Tryg).
- Periode: salg med salgstidspunkt i august 2026 (dansk tid).
- Antal = sum af solgte enheder pr. produkt, inkl. annullerede salg.
- Sorteret efter kunde og derefter faldende antal.

## Teknisk
- Kundeafgrænsning hentes dynamisk fra `team_clients` for team United (`ed095592-cc72-4dc5-b4d7-cc4a65250cac`), så listen ikke hardkodes.
- Kilde: `sales` → `client_campaigns` → `clients`, og `sale_items` → `products` for produktnavn og `quantity`.
- Periodefilter på `sale_datetime` i tidszonen Europe/Copenhagen for at undgå UTC-forskydning ved månedsskifte.
- Ingen filtrering på `is_cancelled` eller `status` (alle salg med).
- Linjer uden produktmapping vises med navnet fra `display_name`/`adversus_product_title` og markeres "(ikke mappet)", så tallene ikke forsvinder.
- Filen bygges med openpyxl og lægges i Files som `antal-salg-pr-produkt-united-august-2026.xlsx`.
