

# Fix: Enreach-adapter tæller ikke API-kald

## Problem

Enreach-adapteren (`enreach.ts`) initialiserer `_metrics.apiCalls = 0` men incrementerer den aldrig ved API-kald. Adversus-adapteren goer det korrekt med `this._metrics.apiCalls++` foer hvert `fetch()`.

Derfor viser Rate Limit Budget altid 0/240 og 0/10000 for alle Enreach-integrationer (Eesy, ASE, Tryg).

## Loesning

Tilfoej `this._metrics.apiCalls++` foer hvert `fetch()`-kald i Enreach-adapteren, og `this._metrics.rateLimitHits++` ved 429-responses samt `this._metrics.retries++` ved genforsog.

## Teknisk aendring

**Fil:** `supabase/functions/integration-engine/adapters/enreach.ts`

Find alle steder hvor adapteren laver HTTP-kald (typisk `fetch(...)`) og tilfoej metrics-tracking:

```typescript
// Foer hvert fetch-kald:
this._metrics.apiCalls++;

// Ved 429-response:
this._metrics.rateLimitHits++;

// Ved retry:
this._metrics.retries++;
```

Dette skal goeres i alle fetch-metoder i adapteren (fetchSales, fetchUsers, fetchCampaigns, fetchSessions, osv.).

## Filer der aendres

- `supabase/functions/integration-engine/adapters/enreach.ts` -- tilfoej metrics tracking
- Redeploy `integration-engine` edge function

## Ingen database-aendringer

