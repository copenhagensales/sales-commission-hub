

# Plan: Sikker backfill med budget-awareness og dedup-garanti

## Problem
~2.044 salg fra 16.-20. februar mangler `sale_items`. Backfill skal ske uden at:
1. Overskride API-grænser (Adversus: 60/min, 1000/hr; Enreach: 240/min, 10.000/hr)
2. Skabe duplikerede salg (sikret via `onConflict: "adversus_external_id"`)
3. Blokere for den løbende synkronisering (cron-jobs kører hvert 5.-15. minut)

## Berørte integrationer

| Integration | Provider | Missing items | Limit/hr | Nuv. forbrug/hr | Ledig kapacitet |
|---|---|---|---|---|---|
| Tryg | Enreach | ~1.984 | 10.000 | ~144 | ~9.800 |
| Lovablecph | Adversus | ~58 | 1.000 | ~601 | ~400 |
| Relatel | Adversus | ~1 | 1.000 | ~48 | delt med Lovablecph |

## Strategi

### 1. Ny action: `safe-backfill` i integration-engine

En ny action der kombinerer `repair-history`-logikken med `smart-backfill`-budgetteringen:

**Inden hentning:**
- Tjek aktuelt API-forbrug fra `integration_sync_runs` (seneste 10 min)
- Beregn ledig kapacitet per provider (ikke per integration, da de deler credentials)
- Reserver 30% af budgettet til løbende cron-sync (aldrig bruge mere end 70%)
- Beregn `maxRecords` baseret på tilgængelig kapacitet

**Under hentning:**
- Kør dag-for-dag (en dag ad gangen) for kontrolleret forbrug
- Brug `fetchSalesRange` med eksplicitte date ranges i stedet for `days`-parameter
- Stop automatisk hvis budget er opbrugt
- Log API-forbrug per dag til `integration_sync_runs`

**Dedup-garanti:**
- Eksisterende `onConflict: "adversus_external_id"` i `processSalesBatch` sikrer allerede at salg ikke duplikeres
- Idempotent `generate_sales_internal_reference` trigger bevarer eksisterende MG-numre
- Items slettes og genindsættes atomisk (allerede implementeret)

### 2. Provider-level budget tracking

Tilføj en hjælpefunktion der aggregerer API-forbrug per **provider** (ikke per integration), fordi:
- Lovablecph og Relatel deler Adversus' 60/min + 1000/hr budget
- Tryg, Eesy og ASE deler Enreach' 240/min + 10.000/hr budget

```text
Provider Budget Beregning:
  ledig = provider_limit - sum(api_calls seneste 10 min) - reserve(30%)
  max_records = floor(ledig / api_calls_per_record)
```

### 3. Kald-sekvens (automatisk)

Backfill skal køres i baggrunden (`background: true`) for at undgå edge function timeout:

**Tryg (Enreach - rigeligt budget):**
- 5 dage (16.-20. feb), ~400 salg/dag
- Enreach har ~9.800 ledig kapacitet/hr -- ingen risiko
- Kan køre alle 5 dage i et kald med `maxRecords: 600` per dag

**Lovablecph (Adversus - stramt budget):**
- 2 dage (19.-20. feb), ~58 salg total
- Adversus har ~400 ledig kapacitet -- OK men skal koordineres med cron
- Kør med `maxRecords: 60` og `background: true`

## Tekniske ændringer

### Fil: `supabase/functions/integration-engine/actions/safe-backfill.ts` (ny)

Ny action med:
- `getProviderBudget(supabase, provider)` -- aggregerer forbrug across alle integrationer der bruger samme provider
- `calculateSafeMaxRecords(budget, reservePct)` -- beregner sikker grænse
- Dag-for-dag loop med budget-check inden hver dag
- Brug af eksisterende `syncIntegration()` med `from`/`to` date ranges
- Logging af forbrug per kald til `integration_sync_runs`

### Fil: `supabase/functions/integration-engine/index.ts` (opdatering)

Tilføj ny `action === "safe-backfill"` route der:
- Accepterer `integration_id` og `date_range` (from/to)
- Kalder `safe-backfill` action
- Understøtter `background: true`

### Provider budget-konstanter

```text
PROVIDER_LIMITS = {
  adversus: { perMin: 60, perHour: 1000 },
  enreach:  { perMin: 240, perHour: 10000 }
}

RESERVE_PCT = 0.30  // 30% reserveret til cron-sync
BUDGET_WINDOW = 10  // minutter
```

### Dedup-sikring (allerede implementeret, ingen ændringer)

- `sales.adversus_external_id` UNIQUE constraint + `onConflict` upsert
- `generate_sales_internal_reference` trigger: idempotent (bevarer eksisterende ref)
- `processSalesBatch`: sletter items atomisk og genindsætter

## Forventet resultat

- Tryg: ~1.984 salg får items genindlæst inden for 1-2 timer (ingen budget-risiko)
- Lovablecph: ~58 salg genindlæst inden for 30 minutter (budget-aware)
- Ingen dobbelt-salg, ingen overskredne API-grænser
- Cron-jobs kører uforstyrret med 30% reserveret kapacitet

