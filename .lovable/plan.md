

## Fix: Head-to-Head viser forkerte/forskellige tal

### Problem
Der er flere bugs i H2H-systemet som gør at tallene ikke stemmer og kan variere mellem brugere:

### Bug 1: Custom-periode bruger forkert startdato
Koden bruger `accepted_at` som startdato for custom-perioder i stedet for `custom_start_at`. Eksempel: en duel med `custom_start_at: 2026-04-12 22:00` bruger i stedet `accepted_at: 2026-04-13 06:47` — dermed mangler salg fra aftenen før.

### Bug 2: Sync-effekten sætter ikke `custom_start_at`
I sync-effekten (linje 298) sættes `matchStartTime = accepted_at` — men for custom-perioder burde den bruge `custom_start_at`.

### Bug 3: Target-periode har ingen meningsfuld slutdato
"Target"-perioder (først til X kr) falder igennem til `endOfWeek(startTime)`, hvilket er forkert. De burde køre til "nu".

### Bug 4: Manuel salgsberegning i stedet for central RPC
H2H bruger sin egen manuelle salgs-aggregering (henter alle sales, filtrerer klient-side) i stedet for `get_sales_aggregates_v2` RPC'en. Det kan give afvigelser fra resten af systemet.

### Bug 5: localStorage kan desync mellem brugere
Challenger og opponent kan have stale localStorage-værdier der overskriver DB-data, fx med gammel `matchStartTime`.

### Løsning

**`src/components/home/HeadToHeadComparison.tsx`**:

1. **dateRange beregning** — For custom-perioder: brug `custom_start_at` (ikke `accepted_at`) som start. For target-perioder: brug `accepted_at` som start og "nu" som slut.

2. **Sync-effekt** — Sæt `matchStartTime` til `custom_start_at || accepted_at` i stedet for altid `accepted_at`.

3. **Stats query** — Erstat den manuelle salgs-aggregering med `get_sales_aggregates_v2` RPC, scoped til de relevante employee IDs. Samme datakilde som resten af systemet = konsistente tal.

4. **DB som single source of truth** — Når en aktiv challenge findes i DB, brug altid dens værdier (start/slut/periode) direkte, og ignorer localStorage for dato-relaterede felter.

### Filer
- `src/components/home/HeadToHeadComparison.tsx` — alle rettelser i dateRange, sync-effekt, og stats query

