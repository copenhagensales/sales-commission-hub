

## NETTO pr. dag: Header-tal fra 31-dages vinduet

### Problem
Header-tallene (NETTO, Team DB, Oms) kommer i dag fra den valgte rapportperiode, men soejlerne viser de seneste 31 dage. Tallene skal matche hinanden.

### Loesning
Beregn NETTO, Team DB og Oms direkte fra `dailyAggregates` (31-dages data) i `ClientDBTab.tsx` og send dem til grafen i stedet for `totals.*` fra den valgte periode.

### Teknisk aendring

**Fil: `src/components/salary/ClientDBTab.tsx`**

Beregn 31-dages totaler fra `dailyAggregates.byDate` med `useMemo`:

```text
chartTotals = useMemo(() => {
  byDate = dailyAggregates?.byDate
  
  totalRevenue = sum af alle dages revenue
  totalCommission = sum af alle dages commission
  teamDB = totalRevenue - totalCommission * 1.125
  nettoTotal = teamDB - FIXED_MONTHLY_OVERHEAD
  
  return { nettoTotal, teamDB, totalRevenue }
}, [dailyAggregates])
```

Opdater props til `ClientDBDailyChart`:
```text
nettoTotal = chartTotals.nettoTotal   (var: totals.netEarnings)
teamDB     = chartTotals.teamDB       (var: totals.finalDB)
totalRevenue = chartTotals.totalRevenue (var: totals.revenue)
```

Ingen aendringer i `ClientDBDailyChart.tsx` -- komponenten viser blot hvad den faar.

