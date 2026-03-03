

## Plan: Ret dagsberegning til at bruge `booked_days`-arrayet

**Problem:** `calcBookingTotal` (linje 199-207) beregner dage som `differenceInDays(end, start) + 1` (kalenderdage) i stedet for at tælle faktiske bookede dage fra `booked_days`-arrayet. Det giver forkerte dagantal for alle lokationer — ikke kun Vestsjællandscenteret.

**Ændring i `src/components/billing/SupplierReportTab.tsx`:**

Tilføj en hjælpefunktion der tæller faktiske bookede dage:

```typescript
const countBookedDays = (booking: any): number => {
  const bookedDays = booking.booked_days as number[] | null;
  if (!bookedDays || bookedDays.length === 0) {
    return differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1;
  }
  let count = 0;
  const start = new Date(booking.start_date);
  const end = new Date(booking.end_date);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (bookedDays.includes(d.getDay())) count++;
  }
  return count || 1;
};
```

Opdater `calcBookingTotal` til at bruge `countBookedDays(booking)` i stedet for `differenceInDays(...)` på begge linjer (201 og 205). Dette retter dagantal, beløb, dagspris og rabatberegning for **alle** lokationer.

