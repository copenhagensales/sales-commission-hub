

# Fix: Adversus sales-filter med `lastModifiedTime` og 7-dages cap

## Overblik over aktive jobs der er ramt

| Job | Integration | Frekvens | Bruger |
|-----|------------|----------|--------|
| `dialer-26fac751-sync` | Lovablecph | Hvert 5. min | `fetchSales(days=2)` |
| `dialer-26fac751-backfill` | Lovablecph | Hver time | `fetchSalesRange(from, to)` |
| `dialer-657c2050-sync` | Relatel | Hvert 10. min | `fetchSales(days=1)` |

Alle 3 jobs bruger `closedTime`-filteret som giver HTTP 500. Fixet loeser dem alle uden at aendre cron-konfigurationen.

## Aendringer i `adversus.ts`

### 1. `fetchSalesRaw` (linje 155-156)
Aendr filter fra `closedTime` til `lastModifiedTime`. Beholder 7-dages vindue (allerede hardcoded).

### 2. `fetchSales` (linje 171-175)
- Aendr filter fra `closedTime` til `lastModifiedTime`
- Tilfoej 7-dages cap: hvis `days > 7`, begraens `startDate` til 7 dage tilbage
- Sortering paa linje 192 beholdes som `closedTime` (klient-side)

### 3. `fetchSalesRange` (linje 346)
- Aendr filter fra `closedTime` til `lastModifiedTime`
- Ret `$gte` til `$gt` og `$lte` til `$lt` (kun understottede operatorer)
- Tilfoej 7-dages cap: hvis `fromDate` er mere end 7 dage tilbage, flyt den frem
- Sortering paa linje 358 beholdes som `closedTime` (klient-side)

## Hvorfor cron-jobs ikke skal aendres

- Lovablecph sync sender `days: 2` -- under 7-dages cap, fungerer uaendret
- Relatel sync sender `days: 1` -- under 7-dages cap, fungerer uaendret
- Backfill sender dag-for-dag ranges via cursor -- hver range er 1 dag, under 7-dages cap

## Fil der aendres

1. `supabase/functions/integration-engine/adapters/adversus.ts` -- 3 filter-aendringer + 7-dages cap

## Deploy

Edge function `integration-engine` deployes automatisk. Naeste sync-run (inden for 5 minutter) vil bruge det korrekte filter og hente salg igen.

