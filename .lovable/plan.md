

## Problem: "Fejl i match" tæller viser ikke (43)

### Analyse

Koden for tælleren er faktisk stadig til stede (linje 1203 i ApprovalQueueTab.tsx). Problemet er at `match-errors-count` queryen ikke invalideres efter upload. I UploadCancellationsTab.tsx invalideres kun `match-errors` men **ikke** `match-errors-count` (linje 1472).

Derudover har `match-errors-count` queryen et potentielt stale-data problem — den caches og opdateres kun ved invalidation.

### Plan

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**
- Tilføj `queryClient.invalidateQueries({ queryKey: ["match-errors-count"] })` efter linje 1472, så tælleren opdateres efter upload-matching

**Fil: `src/components/cancellations/ApprovalQueueTab.tsx`**
- Tilføj `refetchInterval: 5000` eller `staleTime: 0` til `match-errors-count` queryen, så den holder sig opdateret mens brugeren arbejder i godkendelseskøen

Berørte filer: 2

