

## Hent alle Loensikring-salg fra 1. januar 2026

### Status nu
- Der er **370 ASE-salg** i systemet fra 1. januar 2026 til i dag
- Kun **3 salg** er klassificeret som "Loensikring" (alle fra februar, efter reglen blev tilfojet)
- Januar-salg der opfylder Loensikring-betingelserne blev sandsynligvis klassificeret som noget andet (eller slet ikke fanget), fordi reglen ikke fandtes dengang

### Plan

**Koer en catch-up sync for ASE fra 1. januar til i dag**

Kald integration-engine med foelgende parametre:
- `integrationId`: ASE (`a76cf63a-4b02-4d99-b6b5-20a8e4552ba5`)
- `from`: `2026-01-01`
- `to`: `2026-02-12` (i dag + 1 dag buffer)
- `actions`: `["sales"]`
- `maxRecords`: `5000` (hoejt nok til at fange alle)

Synkroniseringsmotoren vil:
1. Hente alle leads fra HeroBase API for perioden
2. Anvende den nye Loensikring-regel (A-kasse salg=Nej OG Forening=Fagforening med loensikring)
3. Opdatere eksisterende salg via upsert (baseret paa external_id), saa produktet aendres fra f.eks. "Salg" til "Loensikring"
4. Pricing rules rematches automatisk

### Ingen kodeaendringer
Dette kraever kun at koere et API-kald til den eksisterende integration-engine. Ingen filaendringer er noedvendige.

### Forventet resultat
Alle salg fra januar der matcher Loensikring-betingelserne vil blive omkategoriseret med det korrekte produkt, og provision/omsaetning opdateres automatisk.

