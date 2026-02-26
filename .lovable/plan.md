

# Shared Enreach Budget Tracker + Rate-Limit Diagnostik

## Problem
De 3 Enreach-integrationer (Eesy, Tryg, ASE) deler en faelles daglig API-kvote pa kontoniveau, men systemet behandler dem som uafhaengige. En integration kan opbruge hele kvoten uden at de andre ved det.

## Loesning: 3 dele

### 1. Rate-limit header logging i Enreach-adapteren
I `get()` metoden (linje ~190 i `enreach.ts`), log de 3 response headers efter hvert svar:
- `X-Rate-Limit-Limit` (daglig graense)
- `X-Rate-Limit-Remaining` (resterende)
- `X-Rate-Limit-Reset` (sekunder til reset)

Dette giver os konkret synlighed i kvoteforbrug pr. API-kald. Headerdata gemmes ogsa i `_metrics` objektet sa det kan returneres til sync-run loggen.

### 2. Shared provider-level budget tracker
Erstat `getIntegrationBudgetUsage()` i `provider-sync.ts` med en ny `getProviderBudgetUsage()` der summerer `api_calls_made` pa tvaers af ALLE integrationer for samme provider (ikke kun den enkelte integration).

```text
Foer (fejlagtigt):
  Eesy: 15 calls/hr  -> OK (under 1000)
  Tryg: 15 calls/hr  -> OK (under 1000)
  ASE:  15 calls/hr   -> OK (under 1000)
  Total: 45 calls/hr  -> Men delt kvote er maaske kun 500!

Efter (korrekt):
  Enreach total: 45 calls/hr -> Tjek mod faelles graense
  Gating: Hvis total > threshold, skip resterende integrationer
```

Aendringer i `provider-sync.ts`:
- Ny funktion `getProviderBudgetUsage()` der henter alle aktive integration IDs for provideren og summerer deres `api_calls_made`
- Budget-gate i hovedloopet bruger den samlede sum i stedet for individuelle tal
- Kommentaren "Each integration has its own independent budget" opdateres

### 3. Diagnostik-endpoint: `check-rate-limits`
Nyt action i `index.ts` der kalder Enreach API'ets egne endpoints:
- `/api/myaccount/request/limits` — viser daglige graenser pr. service
- `/api/myaccount/request/counts` — viser nuvaerende forbrug

Returnerer resultatet direkte sa vi kan se praecis hvad kontoen har tilbage.

## Tekniske detaljer

### Fil: `supabase/functions/integration-engine/adapters/enreach.ts`
- I `get()` metoden (linje ~190-216): efter response modtages, laes og log `X-Rate-Limit-Limit`, `X-Rate-Limit-Remaining`, `X-Rate-Limit-Reset`
- Tilfoej `rateLimitInfo` til `_metrics` interfacet sa det kan udlaeses af sync-integration.ts og gemmes i run-loggen
- Ny metode `async fetchRateLimits(): Promise<{limits: unknown; counts: unknown}>` der kalder `/api/myaccount/request/limits` og `/api/myaccount/request/counts`

### Fil: `supabase/functions/integration-engine/adapters/interface.ts`
- Udvid `ApiMetrics` med optional `rateLimitRemaining?: number` og `rateLimitDailyLimit?: number` felter

### Fil: `supabase/functions/integration-engine/actions/provider-sync.ts`
- Erstat `getIntegrationBudgetUsage()` med `getProviderBudgetUsage()` der henter alle integration IDs for provideren og summerer API-forbrug
- Budget-gate bruger den samlede sum mod en faelles provider-graense

### Fil: `supabase/functions/integration-engine/index.ts`
- Ny action handler `check-rate-limits` der henter credentials for en given integration, opretter EnreachAdapter, kalder `fetchRateLimits()`, og returnerer resultatet

## Forventet resultat
- Fuld synlighed i Enreach-kontoens kvoter og faktisk forbrug
- Korrekt budget-gating der tager hoejde for den delte kvote
- Mulighed for at koere `check-rate-limits` manuelt for at se praecis forbrug og graenser

