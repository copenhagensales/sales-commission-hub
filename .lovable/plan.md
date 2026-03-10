

# Periode-sammenligning på KPI-kort

## Idé
Ja, det giver god mening. Tilføjer en automatisk sammenligning med den foregående tilsvarende periode for alle 5 KPI-kort. Hvis man vælger "Seneste 90 dage" sammenlignes med de 90 dage *før* det.

## Ændring

**Fil:** `src/pages/OnboardingAnalyse.tsx`

### 1. Beregn "forrige periode" data
Tilføj et `previousPeriodData` useMemo der filtrerer `data` på den foregående periode (fx 60-120 dage siden, hvis man kigger på 0-60 dage). Beregn de samme 5 KPI'er: churn%, starters, early leavers, retention%, post-60d retention%.

Periodelogikken: Hvis cutoff er `subDays(now, 90)`, så er forrige periode `subDays(now, 180)` til `subDays(now, 90)`.

### 2. Vis delta på hvert KPI-kort
Under hver KPI-værdi tilføjes en linje med:
- Pil op/ned ikon (TrendingUp/TrendingDown)
- Forskel i procentpoint eller antal
- Farve: grøn = forbedring, rød = forværring (inverteret for churn)
- Tekst: "ift. forrige periode"

### Eksempel UI
```text
┌──────────────────┐
│ 60-dages Churn   │
│ 46.7%            │
│ Rødt flag        │
│ ▼ -3.2pp ift.    │
│   forrige periode│
└──────────────────┘
```

Ingen nye API-kald — alle data er allerede hentet. Ca. 50 linjer ny beregningslogik + opdatering af de 5 Card-komponenter.

