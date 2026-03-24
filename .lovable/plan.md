

# Fix: Slet igangværende uploads med manglende client_id

## Problem
3 uploads har `client_id = NULL` i databasen, hvilket gør at de aldrig vises i UI'et (som filtrerer på `client_id`). De kan derfor hverken ses eller slettes:

| Fil | Pending rækker |
|---|---|
| Mappe3.xlsx | 259 |
| Mappe5.xlsx | 15 |
| Ase Annu Marts Rå fil.xlsx | 62 |

## Løsning: To-trins fix

### 1. Oprydning nu — slet de 3 orphan imports via migration
Kør `rollback_cancellation_import` for alle 3 imports med NULL client_id. Dette ruller ændringer tilbage og fjerner import-posterne.

### 2. Forebyg fremadrettet — gør client_id NOT NULL
Tilføj `NOT NULL` constraint på `cancellation_imports.client_id` så dette ikke kan ske igen. Koden sætter allerede client_id ved insert, men constrainten sikrer at det altid sker.

### 3. UI fallback — vis orphan imports som advarsel
I `UploadCancellationsTab.tsx`: Tilføj en ekstra query der finder imports med pending queue items hvor `client_id IS NULL`. Vis dem med en slet-knap så de kan fjernes manuelt hvis det alligevel sker.

## Teknisk detalje
- Migration: `SELECT rollback_cancellation_import(id) FROM cancellation_imports WHERE client_id IS NULL`
- Derefter: `ALTER TABLE cancellation_imports ALTER COLUMN client_id SET NOT NULL`

