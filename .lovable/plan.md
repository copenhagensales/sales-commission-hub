

# Fix: Eesy (Enreach) salg mangler - ModifiedTo dato-bug

## Problem
HeroBase API'et behandler `ModifiedTo` parameteren som **eksklusiv** (op til, men ikke inklusiv den dato). Den inkrementelle sync truncerer baade `from` og `to` til dato-delen (`YYYY-MM-DD`), saa naar begge falder paa samme dag, bliver API-kaldet:

```
/simpleleads?ModifiedFrom=2026-02-27&ModifiedTo=2026-02-27
```

Denne range er tom og returnerer altid 0 resultater. Manuelt test med `ModifiedTo=2026-02-28` returnerede **5 salg** - saa dataen eksisterer.

## Bevis
- `ModifiedFrom=2026-02-27&ModifiedTo=2026-02-27` -> 0 leads
- `ModifiedFrom=2026-02-27&ModifiedTo=2026-02-28` -> 5 leads (bekraeftet via curl)
- Alle Eesy-syncs siden 08:30 har returneret 0 records pga denne bug

## Fix
**Fil:** `supabase/functions/integration-engine/adapters/enreach.ts`

I baade `fetchSalesRange()` (linje 567-568) og `fetchSessions()` (tilsvarende logik), bump `toStr` med en dag saa API'et inkluderer hele den oenskede dag:

```text
// FØR (linje 567-568):
const fromStr = range.from.split("T")[0];
const toStr = range.to.split("T")[0];

// EFTER:
const fromStr = range.from.split("T")[0];
const toDate = new Date(range.to);
toDate.setUTCDate(toDate.getUTCDate() + 1);
const toStr = toDate.toISOString().split("T")[0];
```

Samme fix skal ogsaa anvendes i `buildLeadsEndpoint` eller alle steder der bruger `ModifiedTo` med dato-only.

## Paavirkede integrationer
Alle Enreach-integrationer der bruger inkrementel sync (Eesy, ASE, Tryg via integration-engine). Tryg er ikke pavirket i praksis fordi den primaert bruger webhooks, men ASE og Eesy er direkte pavirket.

## Risiko
Lav. Aendringen goer blot at `ModifiedTo` altid er dagen EFTER den oenskede slutdato, hvilket sikrer at hele den sidste dag inkluderes. Der er ingen risiko for duplikater da systemet allerede haandterer deduplicering via `adversus_external_id`.

