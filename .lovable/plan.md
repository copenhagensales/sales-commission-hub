

# Fix: 3 resterende NULL-usikre filtre i calculate-kpi-values

## Hvad vi fandt

### Allerede rettet (bekraeftet)
- Backfill koerte korrekt: **0 NULL raekker** i databasen lige nu
- Kolonnen har `DEFAULT 'pending'` -- nye salg faar altid en vaerdi
- Alle **frontend-filer** er korrekt rettet (0 usikre filtre)
- 5 ud af 8 steder i edge functions er rettet

### Stadig saarbare: 3 steder i `calculate-kpi-values/index.ts`
Disse 3 funktioner bruger stadig `.not("sales.validation_status", "eq", "rejected")` som ekskluderer NULL-raekker:

| Linje | Funktion | Effekt |
|-------|----------|--------|
| 1435 | `calculateSalesCount()` | Antal salg mangler |
| 1483 | `calculateTotalCommission()` | Provision mangler |
| 1511 | `calculateTotalRevenue()` | Omsaetning mangler |

Disse bruges af den **timelige full-refresh cron** (`calculate-kpi-values`), som er safety-net for alle KPI-caches. Hvis NULL-raekker vender tilbage, vil disse 3 steder igen skjule salg.

### Kan NULL vende tilbage?
- **Integration engine** (`core/sales.ts`): Saetter IKKE eksplicit `validation_status` ved upsert. Nye inserts faar DEFAULT, men det er sikrere at saette det eksplicit.
- **Dialer webhooks**: Saetter eksplicit `'pending'` -- OK
- **Risiko**: Lav men reel. Enhver fremtidig insert-sti der glemmer feltet, kan genintroducere NULL.

## Plan

### Trin 1: Fix de 3 resterende filtre i `calculate-kpi-values/index.ts`
Erstat paa linje 1435, 1483 og 1511:
```
.not("sales.validation_status", "eq", "rejected")
```
med:
```
.or("sales.validation_status.neq.rejected,sales.validation_status.is.null")
```

### Trin 2: Tilfoej eksplicit `validation_status: 'pending'` i integration engine
I `supabase/functions/integration-engine/core/sales.ts` (ca. linje 456), tilfoej default-vaerdi i saleData-objektet saa det altid er sat, uanset om det er insert eller update:
```typescript
validation_status: 'pending',  // Eksplicit default for at undgaa NULL
```

### Trin 3: Deploy og genberegn
- Deploy `calculate-kpi-values` og `integration-engine`
- Kald `calculate-kpi-incremental` for at opdatere cache

### Effekt
- Alle kampagner er beskyttet mod NULL validation_status
- Baade minutlig (incremental) og timelig (full-refresh) KPI-beregning haandterer NULL korrekt
- Fremtidige salg fra integration engine faar altid eksplicit status

