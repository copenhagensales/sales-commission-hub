

## Plan: Ensret lokationsberegning i Udgiftsrapport

### Problem
Udgiftsrapportens lokationsberegning afviger fra Oversigt-fanen pga.:
- Manglende `status = "confirmed"` filter
- Ingen brug af `total_price`-feltet
- Overlap-query vs. start_date-query

### Rettelse i `src/components/billing/ExpenseReportTab.tsx`

1. **Tilføj `status = "confirmed"` filter** på booking-queryen (linje 87–91)
2. **Brug `total_price`** hvis det findes, ellers fald tilbage til `daily_rate × dage` (match Oversigt-logikken)
3. **Brug samme dato-filtrering** som Oversigt: `start_date >= periodStart AND start_date <= periodEnd` i stedet for overlap-logik

### Ændringer

**Booking-query** (linje 87–91):
```typescript
.from("booking")
.select("id, booked_days, daily_rate_override, total_price, start_date, end_date, location:location_id(daily_rate)")
.eq("status", "confirmed")
.gte("start_date", periodStart)
.lte("start_date", periodEnd)
```

**Beregning** (linje 111–117):
```typescript
return bookings.reduce((sum, b) => {
  if (b.total_price != null) return sum + b.total_price;
  const rate = b.daily_rate_override ?? b.location?.daily_rate ?? 0;
  const days = b.booked_days?.length || 0;
  return sum + rate * days;
}, 0);
```

### Fil

| Fil | Handling |
|-----|---------|
| `src/components/billing/ExpenseReportTab.tsx` | Ensret query og beregning med Oversigt-fanen |

