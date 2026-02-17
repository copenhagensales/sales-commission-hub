
# Fix: Rate Limit Haandtering i buildLeadDataMap

## Problem

`buildLeadDataMap` refaktoren virker korrekt logisk, men **alle lead-fetches fejler med 429 (Rate Limit)** fordi:

1. `fetchLeadById` har kun **1 retry med 500ms wait** - for lidt naar API'en er under pres
2. Batches af 5 parallelle requests med kun 200ms delay overvaelder Adversus API'en (60 req/min limit)
3. Sessions-sync koerer lige foer sales-sync og bruger API-slots, saa der er ingen kapacitet til lead-fetches
4. Resultat: Naesten alle leads returnerer `null`, og `leadResultData` forbliver `[]`

Logs viser massivt 429-problem:
```
Rate limited on lead 966680153, waiting...
Retry failed for lead 955350031: 429
Retry failed for lead 969490942: 429
... (hundredvis af fejl)
```

Kun 10 ud af mange hundrede leads blev hentet succesfuldt.

## Loesning: 2 aendringer i adversus.ts

### Aendring 1: `fetchLeadById` - Robust retry med exponential backoff

Erstat den nuvaerende 1-retry/500ms logik (linje 505-549) med:

- **3 retries** med exponential backoff: 2s, 4s, 8s
- Laes `Retry-After` header fra Adversus API hvis tilgaengelig
- Tilfoej random jitter (0-500ms) for at undgaa thundering herd
- Log kun ved endelig fejl (ikke ved hvert retry)

### Aendring 2: `buildLeadDataMap` - Reducer parallelitet og oeg delay

Aendr batch-parametrene (linje 442-443):

- `batchSize`: 5 -> **2** (kun 2 parallelle requests ad gangen)
- `delayMs`: 200ms -> **1200ms** (sikrer vi holder os under 60 req/min)

Med batchSize=2 og delayMs=1200ms faar vi max ~100 requests/min, men med retry-delays reelt ~50/min som er under Adversus' 60/min graense.

### Aendring 3: Brug RateLimiter fra utils

Integrer den allerede eksisterende `RateLimiter` klasse (utils/rate-limiter.ts) i `buildLeadDataMap` saa lead-fetches respekterer den globale rate limit paa tvaers af alle API-kald (sessions, sales, leads).

## Filer der aendres

| Fil | Aendring |
|---|---|
| `adapters/adversus.ts` linje 442-443 | batchSize=2, delayMs=1200 |
| `adapters/adversus.ts` linje 505-549 | fetchLeadById med 3 retries + backoff |

## Filer der IKKE roeres

Alt andet - core/sales.ts, core/calls.ts, sessions, enreach adapter, pricing rules.

## Forventet resultat

- Lead-fetches lykkes for alle unikke leads i sales-arrayet
- `leadResultData` fyldes korrekt ud i sales tabellen
- OPP-numre udtraekkes korrekt
- Pricing rules der afhaenger af leadResultData virker igen
- Ingen 429-storm i logs

## Risiko: Lav

- Laengere sync-tid (~2 min for 100 leads i stedet for ~10 sek), men korrekte data
- Ingen aendringer i output-format
- Fallback: Hvis et lead stadig fejler efter 3 retries, saettes det til null (same som nu)
