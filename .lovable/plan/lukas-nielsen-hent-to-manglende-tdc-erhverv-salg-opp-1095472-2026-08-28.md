# Lukas Nielsen – hent to manglende TDC Erhverv-salg (OPP-1095472 & OPP-1095401)

## Bekræftet i data

- Lukas Nielsen (`luni@copenhagensales.dk`) er aktiv agent i Adversus (`agents.external_adversus_id = 329270`).
- Han har 160 salg i Stork, alle på Eesy TM-klienten, senest **24/8 2026**. Ingen salg efter 24/8, og **nul salg nogensinde på TDC Erhverv-klienten**.
- De to OPP-numre findes ikke i `sales` (heller ikke i `raw_payload`).
- TDC Erhverv-pipelinen kører normalt: 163 salg i august via integrationen `Lovablecph`, kampagne 99496, senest i dag 11:45. Nabo-OPP-numre (OPP-1095410, OPP-1095457, OPP-1095464) er hentet ind.
- Importlogikken (`integration-engine/core/sales.ts` + `adapters/adversus.ts`) filtrerer **ikke** på medarbejderens Stork-team. Årsagen til at netop hans to salg mangler er derfor endnu ikke fastslået – den skal verificeres direkte i Adversus (typisk `state`, `lastModifiedTime` uden for de 7 dages lookback, eller manglende kampagne-mapping på det tidspunkt).
- Du har allerede rettet Lukas til TDC Erhverv i Stork, og salgene blev lavet mens han sad på TDC Erhverv i Adversus.

## Plan

### Trin 1 – Verificér de to salg i Adversus (kun læsning)
Brug den eksisterende read-only funktion `adversus-sales-diagnostic` (integration `Lovablecph`, kampagne 99496 / telefonnummer / leadId) og evt. `adversus-lead-check` til at finde de to salg og læse: `saleId`, `leadId`, `campaignId`, `state`, `ownedBy`, `createdTime`, `closedTime`, `lastModifiedTime`, produktlinjer og OPP-nr.

Jeg rapporterer fundet – inkl. den konkrete grund til at de ikke blev importeret – **før** der skrives noget.

### Trin 2 – Hent kun de to salg
Engangs-edge-funktion `adversus-import-single-sale`:
- Input: eksplicit liste af Adversus `sale_id` (netop de to). Ingen datointerval, ingen kampagne-scan.
- Henter kun de angivne sale/lead-poster fra Adversus.
- Kører dem gennem den **eksisterende** `processSales` fra `integration-engine/core/sales.ts`, så klient-mapping, produkt-mapping, pricing, `sale_items`, provision og omsætning dannes præcis som ved normal sync.
- Hårde guards:
  - **Insert-only**: hvis et `adversus_external_id` allerede findes i `sales`, springes det over og rapporteres – **ingen** update af eksisterende rækker.
  - Skriver kun rækker hvis `adversus_external_id` er i den medsendte liste.
  - Ingen delete, ingen rematch/genberegning af andre salg, ingen ændring af watermarks eller `integration_sync_runs`, så den normale sync ikke rykkes.
- Returnerer rapport: hvad blev indsat, klient, sælger, produktlinjer, provision og omsætning.

Konsekvens af insert-only, som du bad om: fremtidige rettelser i Adversus på de to salg vil **ikke** blive skrevet ind i Stork af denne funktion. Hvis en almindelig sync senere rammer dem, gælder den normale sync-logik – funktionen her ændrer ikke på det.

### Trin 3 – Verifikation
- `select` på de to salg + deres `sale_items` (produkt, `mapped_commission`, `mapped_revenue`).
- Kontrol af at TDC Erhverv-antallet i perioden kun er steget med 2, og at ingen andre rækkers `updated_at` er ændret.

### Ikke i scope
- Ændring af Eesy TM-state-filteret eller de 7 dages lookback i importen.
- Rematch eller genberegning af eksisterende salg.

## Zone-note
Trin 1 er ren læsning. Trin 2 rører provisions-/pricing-området (rød zone) via en ny, isoleret funktion – uden ændringer i `pricing-service.ts`, `core/sales.ts` eller andre delte filer. Jeg beder om din bekræftelse efter trin 1, før der skrives data.
