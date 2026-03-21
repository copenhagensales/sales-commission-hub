

# Fix: Find og heal de 1.012 salg uden telefonnummer

## Problem
1.012 Tryg-salg i februar har `enrichment_status = 'complete'` men `customer_phone = NULL`. Enrichment-healeren springer dem over fordi den kun kigger efter `pending` eller `failed` status.

## Årsag
Integration-engine markerer salg som `complete` ved import — uanset om telefonnummeret blev hentet. Healeren filtrerer med `.in("enrichment_status", ["pending", "failed"])` og ser aldrig disse salg.

## Løsning

### 1. Udvid healerens query (`supabase/functions/enrichment-healer/index.ts`, linje 304-307)

Tilføj en ekstra betingelse: hent også salg med `enrichment_status = 'complete'` hvor `customer_phone IS NULL` (eller tom). 

Ændring i query-logikken:
- Nuværende: `.in("enrichment_status", ["pending", "failed"])`
- Ny: Brug en `.or()` filter der inkluderer:
  - `enrichment_status.in.(pending,failed)` (eksisterende)
  - `and(enrichment_status.eq.complete,customer_phone.is.null)` (nyt)

### 2. Backfill via migration

Kør en SQL-migration der sætter `enrichment_status = 'pending'` for alle salg med `complete` status men uden telefonnummer. Så vil det eksisterende cron-job automatisk heale dem over de næste kørsler.

```sql
UPDATE sales 
SET enrichment_status = 'pending'
WHERE enrichment_status = 'complete' 
  AND (customer_phone IS NULL OR customer_phone = '')
  AND raw_payload->>'leadId' IS NOT NULL;
```

Dette rammer de 1.004+ salg og lader healeren behandle dem i batches.

### Resultat
- Healerens cron-job vil automatisk hente telefonnumre fra Adversus API for de 1.012 salg
- Fremtidige salg importeret uden telefonnummer vil også blive fanget
- Salgsvalideringen vil herefter kunne matche langt flere salg

| Fil | Ændring |
|-----|---------|
| `supabase/functions/enrichment-healer/index.ts` | Udvid query til også at fange `complete` salg uden telefonnummer |
| SQL migration | Backfill: sæt `pending` på salg uden telefon |

