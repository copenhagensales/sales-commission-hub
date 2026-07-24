## Problem
Forrige Excel (`relatel-omstilling-produkter.xlsx`) sagde "ingen aktive Tilskud=0-regler". Det er forkert. Min filtrering fangede ikke `Omstillingsbruger*`-produkterne, som netop har mange tilskudsregler — inkl. de nye satser fra 15/6-2026 (`Uden tilskud`).

## Plan (kun ny Excel — ingen kodeændringer)

1. Bredere produkt-udvælgelse: alle aktive Relatel-produkter hvis navn matcher `%omstilling%` ELLER `%omstillingsbruger%` (case-insensitive), inkl. varianter #1–#N og trin-varianter.
2. For hvert produkt hentes:
   - Basis: `commission_dkk` / `revenue_dkk` fra `products`
   - Alle aktive prisregler fra `product_pricing_rules` (også dem med `effective_to` i fremtiden), sorteret på `effective_from DESC`
   - Særskilt kolonne for aktuelt gældende "Tilskud=0%"-regel pr. i dag (`effective_from <= today AND (effective_to IS NULL OR effective_to >= today)`)
   - Kolonne for kommende/historiske "Tilskud=0%"-regler med gyldighedsperiode
3. Genererer `relatel-omstilling-produkter-v2.xlsx` med to ark:
   - **Oversigt**: én række pr. produkt — basis prov/oms + aktuel Tilskud=0-sats + `effective_from`/`effective_to`
   - **Alle regler**: alle regler pr. produkt (rule name, betingelser, prov, oms, gyldighedsperiode, prioritet) så du kan se historikken
4. QA: åbn filen, tjek at fx `Omstillingsbruger ATL`s regel "Uden tilskud" (405/734,45) og `Omstillingsbruger #1`s (410/746,55) er med.

Ingen kode eller DB røres — kun ny artefakt i `/mnt/documents/`.
