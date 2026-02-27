

# Reparer 20 orphan-salg med forsigtig safe-backfill

## Problem
20 salg i loenperioden (15. feb - 14. mar) mangler `sale_items`. De ligger paa 3 specifikke dage: 19., 20. og 24. februar.

## Loesning
Koer `safe-backfill` for praecis de 3 dage, med minimalt API-forbrug. Systemet har allerede budgetkontrol (30% reservation til cron-sync), saa vi tilfoeger ekstra forsigtighed ovenpaa.

### Trin 1: Backfill Lovablecph (18 orphans paa feb 19-20)
Kald `integration-engine` med action `safe-backfill` for integration `26fac751-c2d8-4b5b-a6df-e33a32e3c6e7` (Lovablecph):
- from: `2026-02-19`, to: `2026-02-21`
- datasets: `["sales"]` (kun salg, ikke calls)
- maxRecordsPerDay: `50` (ekstra lavt for at undgaa belastning)

### Trin 2: Backfill Relatel_CPHSALES (2 orphans paa feb 19 og 24)
Kald `integration-engine` med action `safe-backfill` for integration `657c2050-1faa-4233-a964-900fb9e7b8c6` (Relatel_CPHSALES):
- from: `2026-02-19`, to: `2026-02-25`
- datasets: `["sales"]`
- maxRecordsPerDay: `50`

### Trin 3: Verificer resultatet
Koer orphan-check igen (ren database-query, ingen API) for at bekraefte at de 20 salg nu har sale_items.

## API-belastning
- Estimeret: ca. 10-15 API-kald total (3+6 dage, batch-endpoints)
- Normal cron-kørsel bruger 50-100 kald pr. 15 min, saa dette er under 10% af en enkelt kørsel
- safe-backfill tjekker budget foer hver dag og stopper automatisk hvis budget er lavt

## Teknisk detalje
Begge kald koeres via `supabase.functions.invoke("integration-engine", { body: { action: "safe-backfill", ... } })` direkte fra edge function curl. Ingen kodeaendringer noedvendige.

