

## Korte SMS-links via `job.cphsales.dk`

### Problem
SMS-links er lange og uoverskuelige:
- `https://sales-sync-pay.lovable.app/book/550e8400-e29b-41d4-a716-446655440000`
- `https://jwlimmeijpfmaksvmuru.supabase.co/functions/v1/unsubscribe-candidate?id=...`

### Løsning
Oprette en `short_links` tabel + redirect edge function, og bruge domænet `job.cphsales.dk`.

**Resultat:** `job.cphsales.dk/r/aB3kx9` (ca. 27 tegn vs. 80+ i dag)

### Forudsætning
Du skal pege domænet `job.cphsales.dk` til dette projekt (via Project Settings → Domains). Uden det vil links ikke virke.

### Trin

| # | Handling |
|---|---------|
| 1 | **Opret `short_links` tabel** – `code` (unik 6-tegn), `target_url`, `candidate_id`, `link_type`, `created_at`. Ingen RLS. |
| 2 | **Opret `r` edge function** – slår `code` op, returnerer 302 redirect til `target_url` |
| 3 | **Opdater `process-booking-flow`** – generér kort kode for booking + afmeld links, gem i `short_links`, brug `job.cphsales.dk/r/{code}` i SMS/email |
| 4 | **Opdater `auto-segment-candidate`** – samme for dag-0 SMS |
| 5 | **Tilføj `/r/:code` route i React** – client-side fallback der redirecter via opslag |

### Filer

| Fil | Ændring |
|-----|---------|
| Migration SQL | Ny `short_links` tabel + index |
| `supabase/functions/r/index.ts` | Ny redirect function |
| `supabase/functions/process-booking-flow/index.ts` | Generér korte links |
| `supabase/functions/auto-segment-candidate/index.ts` | Generér korte links |
| `src/routes/pages.ts` + `src/routes/config.tsx` | `/r/:code` redirect page |

