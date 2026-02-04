
# Plan: Ret lokationsomkostningsberegning i ClientDBTab

## Problem

Nuværende beregning i `ClientDBTab.tsx` (linje 458-480):
```typescript
const dailyRate = booking.daily_rate_override || (booking.location as any)?.daily_rate || 0;
const bookedDays = (booking.booked_days as number[])?.length || 7;
const cost = dailyRate * bookedDays;
```

Denne kode multiplicerer dagsraten med **alle bookede dage** i ugen, uanset om de falder inden for den valgte periode. For korte perioder (f.eks. "I dag") viser den derfor omkostningerne for hele ugen i stedet for kun den ene dag.

## Korrekt logik (fra ClientDBDailyBreakdown)

`ClientDBDailyBreakdown` beregner korrekt ved at:
1. Iterere over **hver dag i perioden** (`eachDayOfInterval`)
2. For hver dag: tjekke om den falder inden for booking-intervallet **OG** matcher `booked_days` arrayet
3. Kun tilføje dagsraten for dage der opfylder begge betingelser

## Løsning

Udskift lokationsomkostningsberegningen i `ClientDBTab.tsx` (linje 458-480) med samme logik som `ClientDBDailyBreakdown`:

### Trin

1. **Tilføj `eachDayOfInterval` import** fra `date-fns` (hvis ikke allerede importeret)

2. **Tilføj helper-funktion** `getBookedDayIndex` til at konvertere JavaScript's `getDay()` (0=Søndag) til booking-format (0=Mandag):
```typescript
function getBookedDayIndex(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}
```

3. **Erstat lokationsomkostningsberegningen** med daglig iteration:
```typescript
const locationCostsMap = new Map<string, number>();
const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd });

for (const booking of bookings || []) {
  if (!booking.client_id) continue;
  
  const bookingStart = parseISO(booking.start_date);
  const bookingEnd = parseISO(booking.end_date);
  const bookedDays = (booking.booked_days as number[]) || [];
  const dailyRate = booking.daily_rate_override || (booking.location as any)?.daily_rate || 0;
  
  for (const day of daysInPeriod) {
    const dayIndex = getBookedDayIndex(day);
    
    // Kun tilføj omkostning hvis:
    // 1. Dagen falder inden for booking-intervallet
    // 2. Dagen matcher en af de bookede ugedage
    if (day >= bookingStart && day <= bookingEnd && bookedDays.includes(dayIndex)) {
      locationCostsMap.set(
        booking.client_id,
        (locationCostsMap.get(booking.client_id) || 0) + dailyRate
      );
    }
  }
}
```

## Påvirket fil

- `src/components/salary/ClientDBTab.tsx`

## Forventet resultat

| Periode   | Før rettelse          | Efter rettelse      |
|-----------|-----------------------|---------------------|
| I dag     | 5 dage x dagsrate     | 1 dag x dagsrate    |
| Uge       | 5 dage x dagsrate     | Faktiske dage i ugen |
| Måned     | 5 dage x antal uger   | Faktiske dage i måneden |
