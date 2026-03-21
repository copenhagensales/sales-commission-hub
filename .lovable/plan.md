

# Tilføj forecast for indeværende måned

## Overblik
Tilføj en periode-vælger så brugeren kan skifte mellem "indeværende måned" og "næste måned". Hooket `useClientForecast` udvides til at acceptere en periode-parameter.

## Ændringer

### 1. `src/hooks/useClientForecast.ts`
- Tilføj en `period` parameter: `"current" | "next"` (default `"next"`)
- Når `period === "current"`: `forecastStart = startOfMonth(now)`, `forecastEnd = endOfMonth(now)`
- Når `period === "next"`: nuværende logik (næste måned)
- Tilføj `period` til `queryKey` så data caches separat

### 2. `src/pages/Forecast.tsx`
- Tilføj state: `const [period, setPeriod] = useState<"current" | "next">("next")`
- Send `period` til `useClientForecast(selectedClient, period)`
- Tilføj en knap-gruppe (toggle) i headeren: "Denne måned" / "Næste måned"
- Opdater `periodLabel` til at vise den valgte periode

### UI
Simpel toggle med to knapper ved siden af kunde-dropdown:
```
[Denne måned] [Næste måned]  |  [Alle kunder ▾]  [↻]
```

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Ny `period` parameter, juster forecastStart/End |
| `src/pages/Forecast.tsx` | Periode-toggle state + UI |

