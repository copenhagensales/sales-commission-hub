

## Ret faktureringsberegning til at bruge faktiske bookede dage

### Problem

Faktureringstabellen bruger `differenceInDays` (kalenderdage mellem start- og slutdato) til at beregne antal dage. Men hver booking har et `booked_days`-felt der angiver praecist hvilke ugedage der er booket. Det giver forkerte tal -- fx Frederiksberg Centeret viser 27 dage / 54.000 kr i stedet for de faktiske 22 bookede dage / 44.000 kr.

### Teknisk plan (1 fil)

**`src/pages/vagt-flow/Billing.tsx`** -- 2 steder i `bookingsByLocation`-reduceren (ca. linje 95 og 102):

Erstat:
```typescript
days = differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1;
```

Med:
```typescript
const bookedDays = booking.booked_days as number[] | null;
days = bookedDays && bookedDays.length > 0
  ? bookedDays.length
  : differenceInDays(new Date(booking.end_date), new Date(booking.start_date)) + 1;
```

Begge steder -- baade for bookinger med `total_price` og uden. Fallback til `differenceInDays` bevares for gamle bookinger uden `booked_days`.

Ingen andre filer aendres.

