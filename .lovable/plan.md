

## Plan: Ret ugedags-konvertering i countBookedDays

**Problem:** `booked_days` i databasen bruger ISO-konvention (0=mandag, 4=fredag, 6=søndag), men JavaScript's `getDay()` returnerer 0=søndag, 1=mandag, 5=fredag. Det giver off-by-one: fredag tælles aldrig, søndag tælles forkert.

**Verifikation:** Med ISO-konvertering giver Herning 15 dage og Frederiksberg 19 dage — præcis som jeres manuelle optælling.

**Ændring i 2 filer:**

1. `src/pages/vagt-flow/Billing.tsx` (linje 101-102)
2. `src/components/billing/SupplierReportTab.tsx` (linje 207-208)

I begge filer ændres:
```typescript
// FRA:
if (bookedDays.includes(d.getDay())) count++;

// TIL:
const isoDay = d.getDay() === 0 ? 6 : d.getDay() - 1;
if (bookedDays.includes(isoDay)) count++;
```

Dette konverterer JS-ugedag (0=søn) til ISO (0=man) inden sammenligning med `booked_days`-arrayet.

