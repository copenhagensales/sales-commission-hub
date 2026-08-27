# Udfyld kolonne J & K (Stork-tal) i Eesy_tm_salg.xlsx

Arket "Opgørelse" har to tomme kolonner pr. sælger: **MV Stork** (J) og **5G Stork** (K). De skal udfyldes med antal salg registreret i Stork for perioden 15-07-2026 til 14-08-2026, udelukkende på klienten Eesy TM.

## Regler

- Kun salg hvor klienten er Eesy TM (Hiper og øvrige klienter tælles ikke med).
- Periode: `sale_datetime` fra 15-07-2026 til og med 14-08-2026 (dansk tid).
- **5G** = internet-abonnementer (produkter i 5GI-familien, fx "5GI - 279 kr.").
- **MV** = alle øvrige produkter (Fri tale-varianter, ekstrasim m.m.).
- Kun **ikke-annullerede** linjer tælles (annullerede linjer og annulleret antal fratrækkes).
- Optælling sker pr. abonnement/linje inkl. antal, så det matcher arkets "Total Sales = 1"-logik.
- Sælgernavn matches mod arkets rækkefølge via Stork's identitetsopslag (agent-mapping → medarbejder-navn). Rækkefølgen af sælgere i arket bevares uændret.
- Sælgere i arket uden Stork-salg får 0.

## Levering

- Nyt ark leveres som `Eesy_tm_salg_udfyldt.xlsx` med J og K udfyldt; resten af arket (formler, formatering, faner) bevares.
- Diff-kolonnerne L og M udfyldes med Excel-formler (ark minus Stork), så afvigelserne er synlige med det samme.
- Sælgere, hvis navn ikke kunne matches entydigt i Stork, listes eksplicit i svaret, så de kan afklares manuelt frem for at blive vist som 0 uden forklaring.

## Teknisk

Optælling via `sales` + `sale_items` joinet til `client_campaigns` på Eesy TM's `client_id`, produktsplit på `products.name`, identitet via `agent_email`/`employee_agent_mapping` → `employee_master_data`. Ingen ændringer i kodebasen eller databasen — kun læsning og generering af regnearket.
