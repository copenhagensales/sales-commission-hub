

# Fix: Dobbelt-tælling af FM-salg i KPI-cache

## Problem
FM-salg (fieldmarketing) tælles **to gange** i `calculate-kpi-values` funktionen, som producerer `this_month` KPI-cachen. ClientDBTab bruger denne cache og viser derfor dobbelte tal.

### Rodårsag
Da FM-salg fik `sale_items` via en database-trigger (og blev knyttet til `client_campaigns`), begyndte de at blive talt via `fetchAllSaleIds` + `sale_items`-logikken. Men den **gamle FM-tæller** (`raw_payload->>fm_client_id`) blev aldrig fjernet. Resultatet er:

```text
sales_count = telesalesCount (inkl. FM via sale_items) + fmCount (FM igen via raw_payload)
            = 1.551 + 1.562 = 3.113  (for Eesy FM)
```

Det korrekte tal er ca. 1.551.

Samme problem rammer `total_commission` og `total_revenue` - begge adderer TM + FM separat, selvom FM allerede indgår i TM-beregningen via `sale_items`.

### Berørte perioder
Kun `this_month` er fejlagtig (beregnet af `calculate-kpi-values`). Perioderne `today`, `this_week` og `payroll_period` beregnes af `calculate-kpi-incremental`, som korrekt behandler alle salg ensartet uden FM-dobbelt-tælling.

## Rettelse

### Fil: `supabase/functions/calculate-kpi-values/index.ts`

I `calculateClientKpiValue`-funktionen skal de tre FM-additioner fjernes for `sales_count`, `total_commission` og `total_revenue`:

**sales_count / antal_salg** (linje ~2232-2241):
- Fjern den separate FM-count query (`raw_payload->>fm_client_id`)
- Returner kun `telesalesCount` (som allerede inkluderer FM via sale_items)

**total_commission / total_provision** (linje ~2261-2277):
- Fjern den separate FM-commission beregning via `raw_payload` + `fmCommissionMap`
- Returner kun `telesalesCommission`

**total_revenue** (linje ~2297+):
- Fjern den separate FM-revenue beregning via `raw_payload` + `fmCommissionMap`
- Returner kun `telesalesRevenue`

### Verifikation
Efter deploy: Trigger `calculate-kpi-values` og bekraft at Eesy FM viser ~1.551 og Yousee ~286.

## Forventet resultat
- Eesy FM: 3.113 --> ~1.551 salg
- Yousee: 572 --> ~286 salg
- Omsætning og provision korrigeres tilsvarende for alle FM-klienter
- Ingen ændring for rene TM-klienter (Tryg, Relatel, TDC Erhverv, etc.)
