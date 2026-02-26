
# Fix check-rate-limits og tilføj proaktiv gating i Enreach-adapteren

## 1. Fix forkert secret-navn i check-rate-limits

I `supabase/functions/integration-engine/index.ts` (linje 70-74) bruges `INTEGRATION_ENCRYPTION_KEY`, men den faktiske secret hedder `DB_ENCRYPTION_KEY`. Alle andre steder i kodebasen bruger det korrekte navn. Rettes til `DB_ENCRYPTION_KEY`.

## 2. Proaktiv gating i Enreach-adapteren

I `supabase/functions/integration-engine/adapters/enreach.ts` i `get()` metoden (linje 195+):

- Tjek `_metrics.rateLimitRemaining` **inden** hvert API-kald
- Hvis remaining er under en threshold (50), kast en specifik `RateLimitExhaustionError` i stedet for at lave kaldet og vente på en 429
- Sync-integration kan fange denne fejl og returnere `partial_success` i stedet for at køre videre

Dette forhindrer at vi "brænder" kald af når vi allerede ved at kvoten er ved at løbe tør — og sparer de sidste kald til vigtigere ting.

### Teknisk detalje

```text
get() metoden:
  BEFORE fetch():
    if (this._metrics.rateLimitRemaining !== undefined
        && this._metrics.rateLimitRemaining < 50) {
      throw new Error("RATE_LIMIT_EXHAUSTED: Only X calls remaining");
    }
```

Threshold på 50 er konservativ nok til at stoppe tidligt, men tillader at kritiske kald (som sales-fetch) kan komme igennem hvis de kører først.

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/integration-engine/index.ts` | `INTEGRATION_ENCRYPTION_KEY` -> `DB_ENCRYPTION_KEY` (2 steder, linje 70+72) |
| `supabase/functions/integration-engine/adapters/enreach.ts` | Tilføj proaktiv gating-check i `get()` metoden |
