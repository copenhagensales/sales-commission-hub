

# Fix: Faktiske salg mangler FM-salg i forecast

## Problem
Forecast-sidens "faktiske salg" (1.000) er lavere end det reelle tal (1.161) fordi:

1. **FM-salg via `fm_seller_id` tælles ikke med** i "actual sales to date" (sektion 8 i `useClientForecast.ts`, linje 772-800). Den henter kun salg matchet via `agent_email`, men FM-salg registreres via `raw_payload.fm_seller_id` -- precis som EWMA-sektionen gør (linje 213-229), men det er glemt i actual-sektionen.

2. **Samme problem i `useForecastVsActual.ts`** -- den tæller kun via `agent_email`, ikke `fm_seller_id`.

3. **`.limit(10000)`** kan potentielt afskære data hvis der er mange salg.

## Løsning

### 1. `useClientForecast.ts` -- Sektion 8 (actual sales, linje 772-812)
- Tilføj en **FM-specifik query** (ligesom linje 213-229) der henter salg med `source = "fieldmarketing"` og matcher via `raw_payload.fm_seller_id`
- Brug samme dedup-logik (track sale IDs) så salg ikke tælles dobbelt
- Fjern eller hæv `.limit(10000)`

### 2. `useForecastVsActual.ts`
- Tilføj FM-salg via `fm_seller_id`-logik, eller brug en samlet query der tæller alle salg for kampagnens campaigns uanset attribution-metode (da denne hook ikke behøver per-employee breakdown)

### 3. Øg limit
- Brug pagination eller fjern `.limit()` for actual-queries der skal tælle alle salg i en måned

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj FM actual sales query med `fm_seller_id` dedup i sektion 8 |
| `src/hooks/useForecastVsActual.ts` | Inkluder FM-salg i historisk actual-optælling |

