

# Fix manglende TDC Erhverv salg (Feb 16-21)

## Problem
Den oprindelige smart-backfill (cron jobs 89/94) processerede kun **calls** -- 0 salg for alle dage. Normal sync med `maxRecords: 60` fanger kun 2-6 TDC Erhverv salg/dag i stedet for de forventede 17-26.

| Dato | Forventet (ca.) | Faktisk | Mangler |
|------|-----------------|---------|---------|
| Feb 16 | ~17 | 5 | ~12 |
| Feb 17 | ~17 | 4 | ~13 |
| Feb 18 | ~17 | 5 | ~12 |
| Feb 19 | ~17 | 6 | ~11 |
| Feb 20 | ~17 | 6 | ~11 |

## Plan

### Trin 1: Vent på API-budget (5-10 min)
Adversus API rammer 429 rate limits. Vi skal vente til budgettet genopbygges.

### Trin 2: Kor safe-backfill dag-for-dag
Kor safe-backfill for hver manglende dag individuelt for at undga timeouts:
- Feb 16-17
- Feb 17-18
- Feb 18-19
- Feb 19-20
- Feb 20-21

### Trin 3: Verificer data
Tjaek at TDC Erhverv salgstal per dag nu matcher forventede niveauer (~17-26/dag).

### Trin 4: Genberegn KPIs
Trigger `calculate-kpi-incremental` og `calculate-kpi-values` for at opdatere cached vaerdier.

### Trin 5: Forebyg fremtidigt datatab
Overvej at oge `sales_max_records` fra 60 til 150 i Lovablecph integration config, sa normal sync kan folge med volumen.

## Teknisk detalje
- Safe-backfill bruger `fetchSalesRange` som henter ALLE salg for en given dag (ikke begranset af maxRecords)
- Adversus rate limit er ~60 kald/minut -- vi skal holde os under dette
- Hvert salg kraver et ekstra API-kald for produkt-detaljer (lead enrichment)

