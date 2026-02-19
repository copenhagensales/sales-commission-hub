

## Fix: Build-fejl i sync-integration.ts + Deploy update-cron-schedule

### Problem
`adapter` er defineret inde i `try`-blokken (linje 49), men bruges i `catch`-blokken (linje 279), hvor den er uden for scope. Det giver TS2304-fejlen.

### Rettelse

**Fil: `supabase/functions/integration-engine/actions/sync-integration.ts`**

1. Flyt `adapter`-variablen ud foran `try`-blokken som `let adapter: any = null;` (linje ~38).
2. I `catch`-blokken (linje 278-293): Brug optional chaining for at hente metrics sikkert, med fallback til `{ apiCalls: 0, retries: 0, rateLimitHits: 0 }` hvis adapter ikke blev oprettet.

### Tekniske detaljer

```text
Linje 38 (efter syncRunStartedAt):
  + let adapter: any = null;

Linje 49 (inde i try):
  - const adapter = getAdapter(...)
  + adapter = getAdapter(...)

Linje 279 (i catch):
  - const errorMetrics = adapter.getMetrics();
  + const errorMetrics = adapter?.getMetrics?.() ?? { apiCalls: 0, retries: 0, rateLimitHits: 0 };
```

### Deploy
Efter rettelsen deployes begge edge functions:
- `integration-engine` (fix build-fejl)
- `update-cron-schedule` (uændret, men skal deployes som requested)

