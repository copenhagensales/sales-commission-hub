

# Fix: Skift Adversus filter fra `created` til `closedTime` + nulstil backfill

## Problem
Adversus API-filteret bruger `created` (hvornaar leadet blev oprettet), men TDC-leads oprettes uger/maaneder foer de lukkes som salg. Salg lukket i dag fanges derfor ikke af `created.$gt` med et 2-dages vindue.

## Lovablecph's to cron jobs

Integrationen har to aktive jobs:

| Job | Schedule | Formaal |
|---|---|---|
| `dialer-26fac751-sync` | Hvert 5. min (minut 3,8,13...) | Synkroniserer salg (days=2, maxRecords=60) |
| `dialer-26fac751-backfill` | Hver time (minut 35) | Indhenter historisk data dag-for-dag fra startdato |

Begge jobs bruger `adversus.ts` adapteren og er derfor begge ramt af `created`-filteret. Begge skal bruge `closedTime` i stedet.

## Aendringer

### 1. Skift API-filter i `adversus.ts` (3 steder)

**Fil:** `supabase/functions/integration-engine/adapters/adversus.ts`

- **Linje 156** (`fetchSalesRaw`): `created` -> `closedTime`
- **Linje 175** (`fetchSales`): `created` -> `closedTime`  
- **Linje 346** (`fetchSalesRange` - brugt af backfill): `created` -> `closedTime`

### 2. Opdater sortering til `closedTime`

- **Linje 192** (`fetchSales` sort): Brug `closedTime` med fallback til `created`
- **Linje 358** (`fetchSalesRange` sort): Samme aendring

### 3. Nulstil backfill-cursor i databasen

Backfill-cursoren staar pt. paa `2026-02-20` (faerdig). For at starte forfra og hente al historisk data med det nye `closedTime`-filter, nulstilles cursoren til startdatoen `2026-01-15`:

```text
UPDATE dialer_sync_state 
SET cursor = '2026-01-15', updated_at = now()
WHERE integration_id = '26fac751-c2d8-4b5b-a6df-e33a32e3c6e7' 
AND dataset = 'backfill';
```

Dette goer at det time-baserede backfill-job automatisk starter forfra naeste gang det koerer (minut 35) og gennemgaar alle dage fra 15. januar med det korrekte filter.

### 4. Deploy og verificer

- Deploy `integration-engine` med det opdaterede filter
- Backfill-jobbet starter automatisk forfra ved naeste koersel
- Sales-sync jobbet fanger nye salg fra i dag med det samme

## Risiko

- Lav: `closedTime` er standard-feltet i Adversus for hvornaar et salg afsluttes. Alle lukkede salg har dette felt.
- Backfill starter forfra, men koerer kun 5-7 dage per time -- det tager ca. 5-6 timer at gennemloebe alle 36 dage igen.
- Andre integrationer (Relatel, ASE, Tryg) bruger samme adapter og faar ogsaa det forbedrede filter.

## Filer der aendres

1. `supabase/functions/integration-engine/adapters/adversus.ts` -- filter + sortering (5 linjer)
2. Database: nulstil backfill-cursor til `2026-01-15`
