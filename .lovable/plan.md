
## Daglig DB-søjlediagram med trendlinje

Tilfoej et soejlediagram i bunden af "DB per Klient"-siden der viser den samlede Final DB pr. dag for alle klienter, med en lineaer trendlinje.

### Ny komponent: `src/components/salary/ClientDBDailyChart.tsx`

- Modtager `clientDBData` (allerede beregnet i `ClientDBTab`) samt `periodStart` og `effectivePeriodEnd` som props.
- Henter salgsdata pr. dag via `useSalesAggregatesExtended` med `groupBy: ['date']` (ingen klient-filter, saa det er alle teams).
- For hver dag beregnes en forenklet DB: `revenue - commission * 1.125` (provision + 12.5% feriepenge).
- Viser et `BarChart` fra recharts med:
  - Soejler farvekodet (groen for positiv DB, roed for negativ).
  - En `Line` (trendlinje) beregnet som lineaer regression over alle dagspunkter.
  - X-akse med datoer (format "d/M"), Y-akse med DKK-vaerdier.
  - Tooltip med dato, DB-vaerdi og antal salg.
- Wrapped i et `Card` med titel "DB pr. dag" og et `TrendingUp`-ikon.

### AEndring i `src/components/salary/ClientDBTab.tsx`

- Importer `ClientDBDailyChart`.
- Indsaet komponenten lige foer det afsluttende `</div>` (efter "Samlet Oversigt"-kortet, foer edit-modal og daily-breakdown-modal), ca. linje 1098.
- Videregiv `periodStart`, `effectivePeriodEnd` og evt. `clientId` filter.

### Trendlinje-beregning

Lineaer regression (y = ax + b) beregnes i en `useMemo` over dagsdataen:
- x = dagindex (0, 1, 2, ...)
- y = DB-vaerdi
- Beregn haeldning (a) og skaering (b) med standard formel.
- Tegn som en `Line` i et `ComposedChart`.

### Visuelt design

- Moerkt kort-design (matcher eksisterende UI).
- Groenne soejler for positiv DB, roede for negativ.
- Stiplet trendlinje i hvid/lysegraa.
- Responsiv hoejde (~300px).
