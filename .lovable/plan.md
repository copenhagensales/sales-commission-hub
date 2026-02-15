

# Fix: Erstat ALLE raa fetch-kald med pagineret SDK i DailyReports

## Problem
`DailyReports.tsx` har **3 raa `fetch()`-kald** med `Range: "0-9999"` som alle rammer serverens 1000-raekkers graense. Ingen af dem bruger den paginerede `fetchAllRows`-utility.

## Alle 3 steder der skal opdateres

### 1. FM-data fetch (linje 44-48)
Henter FM sales for at finde FM-saelgere tilknyttet en klient. Kan returnere over 1000 FM-salg.

**Nu:** raa `fetch()` med `Range: "0-9999"`
**Fix:** `fetchAllRows("sales", "raw_payload", (q) => q.eq("source", "fieldmarketing"))`

### 2. Klient-filter agent fetch (linje 323-327)
Henter salg for at finde unikke agent-emails naar en specifik klient er valgt.

**Nu:** raa `fetch()` med `Range: "0-9999"`
**Fix:** `fetchAllRows` med samme select og filtre

### 3. Hoved-salgshentning (linje 568-587)
Den primaere datahentning for hele rapporten. Her mistes flest data - fx United-teamet viser 1.000 i stedet for 3.075+ salg.

**Nu:** raa `fetch()` med `Range: "0-9999"`
**Fix:** `fetchAllRows("sales", selectClause, filterFn)` med bevarede filtre (agent emails, dato-range, klient)

## Implementering

### Fil: `src/pages/reports/DailyReports.tsx`

1. Tilfoej import af `fetchAllRows` fra `@/utils/supabasePagination`
2. Erstat alle 3 raa `fetch()`-blokke med `fetchAllRows`-kald
3. Fjern ubrugte variabler (`supabaseUrl`, `supabaseKey`, `headers`) hvis de ikke laengere bruges andre steder
4. Bevar al eksisterende beregningslogik (provision, omsaetning, counts_as_sale) uaendret

## Forventet resultat
- Komplet data for alle teams og perioder (ingen 1000-raekkers afskæring)
- Samuel Juul: 18 salg bliver til ca. 57 (reelt antal)
- Provision og omsaetning stiger til de korrekte vaerdier

