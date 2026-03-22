

# Fix: Liga ekskluderer salg med NULL validation_status

## Problem
PostgreSQL's `.neq("rejected")` ekskluderer rækker hvor `validation_status` er NULL — dette er en kendt fælde i Supabase/PostgREST. Dagsrapporter bruger korrekt `.or("validation_status.neq.rejected,validation_status.is.null")`, men liga-funktionen bruger `.neq("validation_status", "rejected")` som stille dropper NULL-rækker.

Frederik Forman: 18.480 kr i dagsrapporter vs 13.640 kr i liga = ~4.840 kr mangler pga. NULL-status salg.

## Ændring

### `supabase/functions/league-calculate-standings/index.ts`
- **Linje 177** (TM-query): Erstat `.neq("validation_status", "rejected")` med `.or("validation_status.neq.rejected,validation_status.is.null")`
- **Linje 211** (FM-query): Samme ændring

### `supabase/functions/league-process-round/index.ts`
- Tilsvarende ændring i alle salgs-queries der bruger validation_status filter

## Effekt
- Alle salg med `validation_status = NULL` inkluderes nu (som i dagsrapporter)
- Frederik Formans liga-tal matcher dagsrapportens 18.480 kr
- Gælder for alle sælgere med NULL-status salg

| Fil | Ændring |
|-----|---------|
| `supabase/functions/league-calculate-standings/index.ts` | `.neq` → `.or` for NULL-inkludering (2 steder) |
| `supabase/functions/league-process-round/index.ts` | Samme fix |

