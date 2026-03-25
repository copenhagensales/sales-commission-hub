

# Produktopdeling for Eesy FM: 5G Internet vs. Abonnementer

## Oversigt
Når kunden "Eesy FM" er valgt, vises forecast opdelt i to produktkategorier:
- **Abonnementer** (alle produkter undtagen "5G Internet")
- **5G Internet** (kun dette produkt)
- **Samlet total** (begge kombineret)

Opdelingen vises i breakdown-tabellen, KPI-kort og summary.

## Teknisk plan

### 1. `src/types/forecast.ts` — Tilføj produkt-split felter
Udvid `EmployeeForecastResult` med optional felter:
```typescript
forecastSalesSubs?: number;    // abonnementer
forecastSales5G?: number;      // 5G Internet
actualSalesSubs?: number;
actualSales5G?: number;
```
Udvid `ForecastResult` med:
```typescript
totalSalesSubs?: number;
totalSales5G?: number;
actualSalesSubs?: number;
actualSales5G?: number;
```

### 2. `src/hooks/useClientForecast.ts` — Track produktsplit i salgsattribuering
Når `clientId === EESY_FM_ID`:
- Udvid sales-queries til at inkludere `products(name, counts_as_sale)` (name er allerede delvist til rådighed)
- I `attributeSaleItems()`: Opret et parallelt map `salesByEmployeeByWeek5G` der tracker 5G Internet separat
- Beregn separat SPH/forecast for 5G vs. abonnementer baseret på ratio fra historisk data
- **Simpel approach**: Beregn 5G-ratio fra historik (andelen af salg der er 5G) og anvend på det samlede forecast per medarbejder
- Samme logik for aktuelle salg: track `actualSales5G` og `actualSalesSubs` separat

### 3. `src/components/forecast/ForecastBreakdownTable.tsx` — Vis split i tabellen
Når split-data er til stede:
- Tilføj kolonner "Abon." og "5G" (eller vis som sub-rows/badges under forecast-tallet)
- Footer-rækken viser totaler for begge kategorier + samlet
- Hold den simple: vis som `forecast (Abon: X | 5G: Y)` under hovedtallet

### 4. `src/components/forecast/ForecastKpiCards.tsx` + `ForecastSummary.tsx`
- Vis produktsplit som sub-tekst under hovedtallet: "heraf X abon. + Y 5G Internet"
- Kun når Eesy FM er valgt

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/types/forecast.ts` | Tilføj optional split-felter |
| `src/hooks/useClientForecast.ts` | Track 5G vs. abonnement separat i sales attribution |
| `src/components/forecast/ForecastBreakdownTable.tsx` | Vis split per medarbejder + i footer |
| `src/components/forecast/ForecastKpiCards.tsx` | Vis split under hovedtal |
| `src/components/forecast/ForecastSummary.tsx` | Vis split i narrativ |

## Tilgang
Produktsplittet beregnes som en **ratio** fra de seneste 8 ugers historik per medarbejder. Hvis en medarbejder har 80% abonnementer og 20% 5G, fordeles forecast-tallet tilsvarende. For aktuelle salg tælles direkte fra produktnavnet (case-insensitive match på "5g internet").

