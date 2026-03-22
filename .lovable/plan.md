

# Vis netto-forecast (efter churn-fradrag) som hovedtal

## Problem
`totalSalesExpected` viser brutto-kapacitet (1.337) uden at fratrække churn-tab (192). Det giver et for optimistisk hovedtal.

## Løsning
Fratræk churn fra totalen så hovedtallet viser det realistiske netto-forecast.

### `src/lib/calculations/forecast.ts` (linje 388-404)

Ændre beregningen af `totalSalesExpected`:

```ts
// Nuværende (brutto):
totalSalesExpected: totalExpected,

// Nyt (netto):
totalSalesExpected: totalExpected - Math.round(cohortChurnLoss) - Math.round(totalEstablishedChurnLoss),
```

Tilføj `totalSalesGross` til returværdien så brutto-kapaciteten stadig er tilgængelig:
```ts
totalSalesGross: totalExpected,
```

Opdater `Low` og `High` til også at fratrække churn:
```ts
totalSalesLow: Math.round(totalExpected * LOW_FACTOR) - Math.round(cohortChurnLoss) - Math.round(totalEstablishedChurnLoss),
totalSalesHigh: Math.round(totalExpected * HIGH_FACTOR) - Math.round(cohortChurnLoss) - Math.round(totalEstablishedChurnLoss),
```

### `src/types/forecast.ts`
Tilføj `totalSalesGross?: number` til `ForecastResult`.

### Effekt
- Hovedtal ændres fra ~1.337 til ~1.145 (netto efter churn)
- Alle KPI-kort, summary og rapporter viser automatisk netto-tal
- Brutto-kapacitet er stadig tilgængelig via `totalSalesGross` til drivers/detaljer

| Fil | Ændring |
|-----|---------|
| `src/lib/calculations/forecast.ts` | Fratræk churn fra totalSalesExpected, tilføj totalSalesGross |
| `src/types/forecast.ts` | Tilføj `totalSalesGross` felt |

