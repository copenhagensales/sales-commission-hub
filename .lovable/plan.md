

## NETTO pr. dag: Fast 31-dages vindue med faste maanedlige omkostninger

### Koncept
Grafen viser de seneste 31 dages daglige DB-indtjening (fra DB per Klient) med et fast maanedligt overhead-budget fordelt paa hverdage. Det giver et realistisk billede af den daglige netto-indtjening uafhaengigt af den valgte rapportperiode.

### Aendringer

**1. ClientDBTab.tsx -- Genindfoer 31-dages vindue og fast overhead**

- Genindfoer `chartPeriodStart` (31 dage tilbage) og `chartPeriodEnd` (i dag) med `useMemo`
- Brug disse til `useSalesAggregatesExtended` queryen for grafen (separat fra rapportens periode)
- Saet `totalOverhead` til den faste vaerdi: `932000 + 56876 = 988876`
- Header-tallene (NETTO, Team DB) forbliver fra den valgte periode (Samlet Oversigt) -- kun soejlerne bruger 31-dages data

**2. ClientDBDailyChart.tsx -- Ingen aendringer i logik**

Komponenten virker allerede korrekt:
- Modtager `byDate` og `totalOverhead` som props
- Fordeler overhead kun paa hverdage med salg
- Beregner daglig NETTO = dagDB - dailyOverhead (kun hverdage)

### Regnestykke-eksempel

```text
Fast maanedlig overhead: 932.000 + 56.876 = 988.876 kr
Hverdage med salg i 31-dages vinduet: ~22 dage
Daglig overhead: 988.876 / 22 = ~44.949 kr

Per hverdag:
  dagDB (sum af alle klienters DB den dag)
  dagNetto = dagDB - 44.949 kr

Weekender:
  dagNetto = dagDB (ingen overhead-fradrag)
```

### Teknisk detalje

I `ClientDBTab.tsx`:
```text
chartPeriodStart = today - 31 dage (useMemo, stabil)
chartPeriodEnd = today (useMemo, stabil)

dailyAggregates = useSalesAggregatesExtended({
  periodStart: chartPeriodStart,
  periodEnd: chartPeriodEnd,
  groupBy: ["date"],
})

FIXED_MONTHLY_OVERHEAD = 988876

ClientDBDailyChart props:
  byDate = dailyAggregates.byDate
  totalOverhead = FIXED_MONTHLY_OVERHEAD
  nettoTotal, teamDB, totalRevenue = fortsat fra totals (valgt periode)
```
