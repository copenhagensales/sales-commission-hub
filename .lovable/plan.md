

# Fix Enreach Rate-Limiting: 4 problemer

## Baggrund

Enreach/HeroBase taller API-kald **4-8x dyrere** uden `X-Rate-Limit-Fair-Use-Policy: Minute rated` headeren. Hovedadapteren (`integration-engine/adapters/enreach.ts`) sender headeren korrekt, men to andre funktioner gor det ikke:

1. **`client-sales-overview`** -- ingen fair-use header
2. **`enrichment-healer`** -- ingen fair-use header
3. **Rate-limit data logges ikke** i `integration_sync_runs` (adapteren samler det, men det gemmes ikke)
4. **Scheduling** kan strammes for at reducere unodvendige kald

---

## Fix 1: Fair-use header i `client-sales-overview`

**Fil:** `supabase/functions/client-sales-overview/index.ts`

Linje 128 -- tilfoj headeren:

```typescript
const headers: Record<string, string> = { 
  Accept: "application/json",
  "X-Rate-Limit-Fair-Use-Policy": "Minute rated",  // <-- NY
};
```

Effekt: Hvert kald taller 1 i stedet for 4-8.

---

## Fix 2: Fair-use header i `enrichment-healer`

**Fil:** `supabase/functions/enrichment-healer/index.ts`

I `healEnreach`-funktionen (linje 205-206) -- tilfoj headeren:

```typescript
const response = await fetch(url, {
  headers: { 
    Authorization: `Bearer ${apiKey}`,
    "X-Rate-Limit-Fair-Use-Policy": "Minute rated",  // <-- NY
  },
});
```

Effekt: Healing-kald koster 1/4-1/8 af hvad de gor nu.

---

## Fix 3: Log rate-limit data i sync_runs

Adapteren samler allerede `rateLimitDailyLimit`, `rateLimitRemaining` og `rateLimitReset` i `_metrics`, men `sync-integration.ts` gemmer dem ikke i databasen.

**Trin 1 -- Migration:** Tilfoj 3 kolonner til `integration_sync_runs`:

```sql
ALTER TABLE integration_sync_runs 
  ADD COLUMN IF NOT EXISTS rate_limit_daily_limit integer,
  ADD COLUMN IF NOT EXISTS rate_limit_remaining integer,
  ADD COLUMN IF NOT EXISTS rate_limit_reset integer;
```

**Trin 2 -- Fil:** `supabase/functions/integration-engine/actions/sync-integration.ts`

Hvor sync-run insertes (ca. linje 450-470), tilfoj de 3 felter fra `adapter.getMetrics()`:

```typescript
rate_limit_daily_limit: metrics?.rateLimitDailyLimit ?? null,
rate_limit_remaining: metrics?.rateLimitRemaining ?? null,
rate_limit_reset: metrics?.rateLimitReset ?? null,
```

Effekt: System Stability-dashboardet kan vise faktisk daglig quota og remaining i realtid.

---

## Fix 4: Optimer scheduling -- reducer 429s

Enreach-integrationerne (Eesy, Tryg, ASE) korer sales-sync hvert 15. minut med stagger. Men meta-sync (campaigns/users/sessions) korer hvert 60. minut. Problemet er at meta-sync rammer API'et lige efter sales-sync, sa de kolliderer.

**Handling:** Opdater meta-sync schedules sa de ikke overlapper med sales-sync. Konkret: forskyd meta-jobs med +7 minutter fra narmeste sales-job:

| Job | Nuvarende | Ny |
|-----|----------|-----|
| Eesy Meta | :00 (kolliderer med sales) | :07 |
| Tryg Meta | :02 (kolliderer med sales) | :22 |
| ASE Meta | :04 (kolliderer med sales) | :37 |

Dette gores via `update-cron-schedule` edge function eller direkte database-update af `config.meta_sync_schedule` + re-scheduling af cron jobs.

---

## Raekkefolge

1. Migration (3 nye kolonner)
2. Opdater `client-sales-overview` (1 linje)
3. Opdater `enrichment-healer` (1 linje)
4. Opdater `sync-integration.ts` (3 linjer)
5. Deploy edge functions
6. Opdater meta-sync schedules i databasen

