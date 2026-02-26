

## Fix: Biler og diaeter vises ikke pa markeder

### Problem
Vehicle-queryen i `BookingsContent.tsx` (linje 262) henter kun `booking_vehicle` data for normale bookinger (`bookings`), men inkluderer IKKE market-bookinger (`marketBookings`). Derfor vises bil-tags aldrig i "Markeder denne uge" sektionen.

Diaet-queryen er korrekt implementeret (linje 275-281) - den bruger `allBookingIds` som kombinerer begge. Vehicle-queryen skal opdateres til at goere det samme.

### Aendring i `src/pages/vagt-flow/BookingsContent.tsx`

**1. Opdater vehicle-queryen til at bruge `allBookingIds` i stedet for kun `bookings`:**

Linje 258-272 aendres:
- Flyt `allBookingIds` memo OVER vehicle-queryen (flyttes fra linje 275 til foer linje 258)
- Aendr vehicle-queryen til at bruge `allBookingIds` i stedet for `bookings?.map(b => b.id)`
- Opdater `enabled`-betingelsen til `allBookingIds.length > 0`
- Opdater queryKey til at inkludere `allBookingIds` for korrekt cache-invalidering

### Specifik kode-aendring

```text
// FOER (linje 258-272):
const { data: bookingVehicles = [] } = useQuery({
  queryKey: ["vagt-booking-vehicles", selectedWeek, selectedYear],
  queryFn: async () => {
    const bookingIds = bookings?.map((b: any) => b.id) || [];
    if (bookingIds.length === 0) return [];
    // ...
    .in("booking_id", bookingIds);
  },
  enabled: !!bookings && bookings.length > 0,
});

// EFTER:
// allBookingIds memo flyttes op FOER denne query
const { data: bookingVehicles = [] } = useQuery({
  queryKey: ["vagt-booking-vehicles", selectedWeek, selectedYear, allBookingIds],
  queryFn: async () => {
    if (allBookingIds.length === 0) return [];
    // ...
    .in("booking_id", allBookingIds);
  },
  enabled: allBookingIds.length > 0,
});
```

### Resultat
- Bil-tags vises nu korrekt i BAADE normale bookinger OG markeder-sektionen
- Diaet-tags virker allerede korrekt (ingen aendring noedvendig)
- Ingen database-aendringer - kun en kode-fix i een fil

