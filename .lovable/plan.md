

## Ret NETTO pr. dag til fulde DB-beregninger for 31-dages vinduet

### Problem
Header-tallene (NETTO, Team DB, Oms) i grafen bruger en forenklet beregning: `teamDB = revenue - commission * 1.125`. Den ignorerer annulleringsprocenter, sygeloen, lokationsomkostninger, lederloen, assistentloen og ATP/Barsel -- og viser derfor et for hoejt tal.

### Loesning
Beregn chart-totaler ved at koere den fulde "DB per Klient"-logik paa 31-dages salgsdata. Vi genbruger allerede hentede strukturelle data (annulleringsprocenter, team-opsaetning, lederloenninger, assistentloenninger) og henter kun ny salgsdata pr. klient for 31-dages vinduet.

### Teknisk aendring

**Fil: `src/components/salary/ClientDBTab.tsx`**

**1. Ny data-fetch: salg pr. klient for 31-dages vinduet**

Tilfoej en `useQuery` der henter salgsdata grupperet pr. klient for `chartPeriodStart` til `chartPeriodEnd` (31 dage). Samme logik som den eksisterende `salesByClientDirect` query, men med 31-dages datoer.

**2. Ny `chartTotals` beregning med fuld DB-logik**

Erstat den simple `chartTotals` useMemo med en fuld beregning der:

```text
For hver klient:
  1. Hent cancellationPercent og sickPayPercent fra adjustmentPercents
  2. commission = salgsdata.commission
  3. sellerVacationPay = commission * 12.5%
  4. sellerSalaryCost = commission + sellerVacationPay
  5. cancellationFactor = 1 - cancellationPercent/100
  6. adjustedRevenue = revenue * cancellationFactor
  7. adjustedSellerCost = sellerSalaryCost * cancellationFactor
  8. sickPayAmount = sellerSalaryCost * sickPayPercent/100
  9. locationCosts (FM-klienter, beregnet fra bookings for 31-dages vinduet)
  10. basisDB = adjustedRevenue - adjustedSellerCost - sickPayAmount - locationCosts

Derefter pr. team:
  11. Fordel assistentloen via revenueShare
  12. Fordel ATP/Barsel via revenueShare
  13. Beregn dbBeforeLeader
  14. Fordel lederloen via dbShare (MAX af procent vs. minimum)

Sum alle klienters finalDB = chartTeamDB
chartNetto = chartTeamDB - FIXED_MONTHLY_OVERHEAD
```

Assistentloen og lederloen genbruges fra de eksisterende queries (allerede hentet for den valgte periode). Da 31 dage svarer til ca. 1 maaned, er de eksisterende vaerdier en rimelig approksimation. Alternativt kan vi proratere baseret paa arbejdsdage.

**3. Lokationsomkostninger for 31-dages vinduet**

Beregn FM-lokationsomkostninger ved at iterere over bookings med `chartPeriodStart`/`chartPeriodEnd` i stedet for rapportperioden.

**4. Ingen aendringer i ClientDBDailyChart.tsx**

Grafen viser fortsat daglige soejler baseret paa `dailyAggregates.byDate`. Kun header-tallene aendres.

### Resultat

- NETTO-tallet i grafen afspejler den reelle netto-indtjening efter alle fradrag
- Daglige soejler viser fortsat daglig DB med fast overhead fordelt paa hverdage
- Strukturelle data (cancellation%, teams, loenninger) genbruges -- ingen ekstra queries ud over salg pr. klient

