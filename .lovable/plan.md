
## Fix: NETTO pr. dag grafen blander to perioder

### Problem
Grafen viser salgsdata for de seneste 30 dage (13. jan - 12. feb), men bruger overhead-tal fra den valgte periode (februar). Det giver et helt forkert NETTO-tal fordi:
- Soejlernes DB er beregnet fra 30 dages omsaetning/provision
- Overhead er kun fra februar
- Resultatet matcher ingen af de to perioder

### Loesning
Grafen skal bruge den valgte periodes data konsekvent -- baade for salgsdata OG for overhead/totaler. Naar man vaelger februar, viser grafen februars dage med februars overhead.

### Teknisk aendring

**Fil: `src/components/salary/ClientDBTab.tsx`**

1. Fjern den separate `chartPeriodStart`/`chartPeriodEnd` (seneste 30 dage) og `dailyAggregates` query
2. Tilfoej `date` til den eksisterende `useSalesAggregatesExtended` query's `groupBy` array, saa vi faar `byDate` data for den valgte periode
3. Brug `aggregates.byDate` i stedet for `dailyAggregates.byDate` naar vi sender data til `ClientDBDailyChart`

Dette sikrer at:
- Grafens datointerval matcher den valgte periode (fx februar)
- Overhead-tallene hoerer til samme periode
- NETTO-totalet i grafen matcher praecis med Samlet Oversigt
- Summen af de daglige soejler giver det korrekte NETTO-tal
