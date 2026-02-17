

# Tilfoej integration_id til calls-sync

## Hvad mangler

Naar nye calls synkroniseres, gemmes de i `dialer_calls` **uden** `integration_id`. Det betyder man ikke kan skelne mellem fx Lovablecph og Relatel for nye data. Kolonnen findes allerede i tabellen, og 12.350 gamle rows er backfilled -- men ny kode saetter den ikke.

## Aendringer

### 1. `core/calls.ts` -- tilfoej `integrationId` parameter

- `processCalls()` faar en ny parameter: `integrationId: string`
- Den sendes videre til `processCallsBatch()`
- I `callData`-objektet (linje 51-66) tilfojes: `integration_id: integrationId`

### 2. `core.ts` (IngestionEngine) -- videresend parameteren

- `processCalls(calls, batchSize)` udvides til `processCalls(calls, integrationId, batchSize)`
- Kaldet til `coreProcessCalls` faar `integrationId` med

### 3. `actions/sync-integration.ts` -- send integration.id med

- Linje 135 og 140: `engine.processCalls(calls)` aendres til `engine.processCalls(calls, integration.id)`
- `integration.id` er allerede tilgaengelig i scopet (bruges til sessions paa samme maade)

## Ingen database-aendringer

Kolonnen `integration_id` eksisterer allerede i `dialer_calls`. Ingen migration noedvendig.

## Risiko

Ingen. Aendringen er rent additiv -- den saetter et felt der i dag er NULL. Upsert-constrainten (`external_id, integration_type, dialer_name`) aendres ikke.

