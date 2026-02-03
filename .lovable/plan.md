
# Plan: Løsning af Integration Engine WORKER_LIMIT Timeout

## Problem
Integration-engine funktionen rammer CPU/wall-clock timeout (WORKER_LIMIT) under synkronisering. Hovedårsagen er den intensive `buildLeadDataMap()` proces der:

1. Henter leads bulk per kampagne (kan rate-limites)
2. Fallback-henter individuelle leads der mangler (mange API-kald)
3. Retries med delays ved 429-fejl forbruger wall-clock tid

## Løsning

Implementerer **3-lags optimering** for at reducere CPU-brug og undgå timeout:

### 1. Reducér maksimum records yderligere
- Sænk `effectiveMaxRecords` fra 100 til **50** i `index.ts`
- Sænk `MAX_RECORDS` fra 100 til **50** i `repair-history.ts`
- Sænk `BATCH_SIZE` fra 50 til **25** i `repair-history.ts`

### 2. Begræns fallback lead-lookups i Adversus adapter
- Tilføj `maxFallbackLeads` parameter (default 20)
- Skip fallback lead-lookups helt hvis antallet overstiger grænsen
- Prioritér de nyeste leads først hvis begrænset

### 3. Reducér retry delays
- Sænk retry delays fra 1-4 sekunder til 500ms-1.5s
- Begræns max retries fra 3 til 2 for lead-lookups
- Tilføj tidlig timeout-check efter hver batch

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/integration-engine/index.ts` | `effectiveMaxRecords` 100 → 50 |
| `supabase/functions/integration-engine/actions/repair-history.ts` | `MAX_RECORDS` 100 → 50, `BATCH_SIZE` 50 → 25 |
| `supabase/functions/integration-engine/adapters/adversus.ts` | Begræns fallback lookups, reducér delays |

## Tekniske detaljer

### index.ts
```typescript
// Linje ~32
const effectiveMaxRecords = maxRecords ?? 50;
```

### repair-history.ts
```typescript
// Linje 4-5
const MAX_RECORDS = 50
const BATCH_SIZE = 25
```

### adversus.ts - buildLeadDataMap()
```typescript
// I fallback-sektionen (~linje 467-530):
// - Begræns missingLeadIds til max 20
// - Reducér delays mellem batches
// - Reducér batch size fra 10 til 5
```

## Forventede resultater
- Synkronisering gennemføres på under 30 sekunder
- 50 salg per kørsel (kør flere gange for mere data)
- Færre rate-limit fejl fra Adversus API

## Alternativ: Frontend batching (fremtidig forbedring)
Hvis problemet fortsætter, kan vi implementere:
- Frontend sender datointervaller i stedet for antal dage
- Edge function returnerer hurtigt med job-ID
- Frontend poller for status
