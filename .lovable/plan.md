
## Daglig DB-graf: Standard 30 dage + samlet oversigt

### Aendringer i `src/components/salary/ClientDBDailyChart.tsx`

**1. Hardcode periode til sidste 30 dage**
- Fjern `periodStart`/`periodEnd` props.
- Beregn internt med `useMemo`: `periodStart = startOfDay(subDays(new Date(), 30))`, `periodEnd = startOfDay(new Date())`.
- Hook'en henter altid de sidste 30 dages data uafhaengigt af den valgte loenperiode.

**2. Tilfoej samlet tal i header**
- Beregn `totalDB` og `totalRevenue` fra chartData med `useMemo`:
  - `totalDB = sum(chartData.db)`
  - `totalRevenue = sum(aggregates.byDate[*].revenue)`
- Vis i card-headeren som to badges/tal ved siden af titlen, fx:
  - "DB pr. dag (sidste 30 dage) -- DB: 245.320 kr | Oms: 892.100 kr"
- Formateret med `toLocaleString("da-DK")` og `kr` suffix.

**3. Opdater titel**
- AEndr titlen fra "DB pr. dag (alle klienter)" til "DB pr. dag (sidste 30 dage)".

### Tekniske detaljer

- Importerer `subDays` og `startOfDay` fra `date-fns`.
- Props-interfacet bliver tomt eller fjernes helt (ingen props nødvendige).
- Opdaterer ogsaa kaldet i `ClientDBTab.tsx` saa det ikke laengere sender `periodStart`/`periodEnd`.
