

# Samlet plan: Hent ALLE manglende Lovablecph salg (Feb 16-22) + oprydning

## Oversigt
Recover alle manglende salg fra Lovablecph-integrationen (ikke kun TDC Erhverv) for uge 7 (Feb 16-22) og ryd op i redundante cron jobs.

## Trin 1: Stop redundant cron job
Slet job ID 75 (`dialer-657c2050-meta`) som koerer campaigns/users/sessions hvert 35. minut. Sync-jobbet (ID 73) daekker allerede disse actions, saa meta-jobbet spilder API-budget.

**SQL:**
```text
SELECT cron.unschedule(75);
```

## Trin 2: Tilfoej sales-only backfill support
Minimal kodeaendring i 2 filer for at tillade backfill af kun salg uden calls.

**safe-backfill.ts:**
- Tilfoej `datasets?: ("sales" | "calls")[]` til `SafeBackfillParams`
- Default til `["sales", "calls"]` for backward-kompatibilitet
- Wrap sales-fetch i `if (datasets.includes("sales"))`
- Wrap calls-fetch i `if (datasets.includes("calls"))`

**index.ts:**
- Destructure `datasets` fra request body
- Tilfoej `datasets` til params-objektet der sendes til `safeBackfill()`

## Trin 3: Deploy og koer sales-only backfill
Koer background safe-backfill for **hele Lovablecph** (alle kampagner, ikke kun TDC) fra Feb 16 til Feb 22 med kun salg:

```text
POST integration-engine
{
  "action": "safe-backfill",
  "integrationId": "26fac751-c2d8-4b5b-a6df-e33a32e3c6e7",
  "from": "2026-02-16",
  "to": "2026-02-22",
  "datasets": ["sales"],
  "maxRecords": 600,
  "background": true
}
```

Safe-backfill henter alle salg paa tvaers af alle kampagner for den givne integration -- ikke filtreret paa specifik klient. Alle Lovablecph-salg (TDC Erhverv, Norlys, osv.) vil blive hentet.

## Trin 4: Verificer data
Tjaek alle Lovablecph salgstal i databasen for Feb 16-22 -- paa tvaers af alle kampagner.

## Trin 5: Genberegn KPIs
Trigger KPI-genberegning saa dashboards afspejler de nye salg for alle klienter.

## Teknisk detalje
- Safe-backfill henter fra Adversus API med `lastModifiedTime` filter -- den henter **alle** salg for integrationen, ikke kun en specifik kampagne
- `datasets: ["sales"]` springer calls over og sparer ~90% API-budget
- Backward-kompatibel: uden `datasets` koerer alt som foer
- Adversus budget: ~323/1000 brugt per time, rigeligt til 6 dages salg

