

# Fix: Liga viser forkerte tal for FM vs. dagsrapporter

## Problem
`league-calculate-standings` edge-funktionen bruger sin egen aggregeringslogik der afviger fra `get_sales_aggregates_v2` RPC'en (som dagsrapporter bruger) på 3 kritiske punkter:

### 1. Ingen `validation_status`-filtrering
Liga-funktionen inkluderer **afviste salg** — den har ingen `validation_status != 'rejected'` check. Dagsrapporter ekskluderer afviste salg via RPC'en.

### 2. Ingen `counts_as_sale`-produktfiltrering
Liga tæller deals som `+1` per salgsrække, uden at checke om produktet faktisk tæller som et salg (`counts_as_sale` flag på products-tabellen). RPC'en bruger `CASE WHEN p.counts_as_sale IS NOT FALSE THEN si.quantity ELSE 0 END`.

### 3. Deals tæller rækker, ikke quantity
For FM-salg gør liga `dealsCount += 1` per sale-row, mens RPC'en summerer `si.quantity` fra sale_items (korrekt for multi-quantity transaktioner).

## Løsning
Opdater `league-calculate-standings` til at bruge samme datalogik som RPC'en.

### `supabase/functions/league-calculate-standings/index.ts`

**A. Tilføj `validation_status`-filter på begge salgs-queries (TM + FM):**
```
.neq("validation_status", "rejected")
```
(Linje ~173 for TM og ~206 for FM)

**B. Hent `quantity` og `counts_as_sale` fra sale_items:**
- Ændr sale_items query til også at hente `product_id`
- Join med products for at checke `counts_as_sale`
- Brug `quantity` til deals-tælling: `dealsCount += item.counts_as_sale ? item.quantity : 0`

**C. Tilsvarende ændringer i `league-process-round/index.ts`:**
- Samme 3 fixes for konsistens i runde-beregninger

### Ingen ændringer i frontend
Standings-tabellen viser data fra `league_qualification_standings`, som populeres af edge-funktionen. Når funktionen beregner korrekt, viser UI automatisk de rigtige tal.

## Effekt
- FM-sælgeres provision og deals i ligaen matcher nu præcis med dagsrapporter
- Afviste salg tælles ikke længere med
- Multi-quantity salg tælles korrekt

| Fil | Ændring |
|-----|---------|
| `supabase/functions/league-calculate-standings/index.ts` | Tilføj validation_status filter, counts_as_sale check, quantity-baseret deals |
| `supabase/functions/league-process-round/index.ts` | Samme 3 fixes for runde-beregninger |

