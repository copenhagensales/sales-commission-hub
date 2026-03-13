

## Skjul kladde-bookinger fra medarbejdernes vagtplan

### Problem
Queryen i `MyBookingSchedule.tsx` (linje 66-82) henter alle `booking_assignment` uden at filtrere på booking-status. Medarbejdere kan derfor se vagter der stadig er kladder.

### Løsning
Tilføj et filter i assignment-queryen, så den kun inkluderer assignments hvor den tilhørende booking har `status = 'confirmed'`.

**Ændring i `MyBookingSchedule.tsx`** — udvid `.select()` til at inkludere `booking.status` og filtrer resultatet:

```ts
// I queryen (linje 66-84):
// Tilføj status til booking select
booking:booking_id (
  id, status, week_number, year, start_date, end_date, ...
)

// Efter fetch, filtrer kladder fra:
const confirmed = (data ?? []).filter(
  (a: any) => a.booking?.status === 'confirmed'
);
return confirmed;
```

### Omfang
- Kun `MyBookingSchedule.tsx`
- Ingen database-ændringer
- Managers ser stadig kladder i BookingsContent (uændret)

