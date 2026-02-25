

## Vis biler som tags paa booking-oversigten

### Problem
Booking-oversigten (`/vagt-flow/booking`) viser ikke hvilke biler der er tildelt til de enkelte lokationer. Data findes i `booking_vehicle`-tabellen, men den hentes ikke paa denne side.

### Loesning
Hent `booking_vehicle`-data for den valgte uge og vis et kompakt bil-tag under hver lokations navn med bilens navn og nummerplade. Pænt, diskret design der ikke fylder for meget.

### Teknisk plan

**Fil:** `src/pages/vagt-flow/BookingsContent.tsx`

**Aendring 1** -- Tilfoej Car-ikon til import (linje 7):
Tilfoej `Car` fra lucide-react.

**Aendring 2** -- Hent booking_vehicle data (efter vehicles-query, ca. linje 210):
Tilfoej en ny `useQuery` der henter `booking_vehicle` med vehicle-join for alle bookinger i den valgte uge:

```typescript
const { data: bookingVehicles = [] } = useQuery({
  queryKey: ["vagt-booking-vehicles", selectedWeek, selectedYear],
  queryFn: async () => {
    const bookingIds = bookings?.map(b => b.id) || [];
    if (bookingIds.length === 0) return [];
    const { data, error } = await supabase
      .from("booking_vehicle")
      .select("id, booking_id, vehicle_id, date, vehicle:vehicle_id(name, license_plate)")
      .in("booking_id", bookingIds);
    if (error) throw error;
    return data || [];
  },
  enabled: !!bookings && bookings.length > 0,
});
```

**Aendring 3** -- Byg et helper-lookup (efter queryen):
```typescript
const vehiclesByBooking = useMemo(() => {
  const map = new Map<string, { name: string; plate: string }[]>();
  for (const bv of bookingVehicles) {
    if (!bv.vehicle) continue;
    const existing = map.get(bv.booking_id) || [];
    const alreadyAdded = existing.some(v => v.name === bv.vehicle.name);
    if (!alreadyAdded) {
      existing.push({ name: bv.vehicle.name, plate: bv.vehicle.license_plate });
    }
    map.set(bv.booking_id, existing);
  }
  return map;
}, [bookingVehicles]);
```

**Aendring 4** -- Vis bil-tags i booking-kortet (ca. linje 528-529, under lokationsnavn/by):
Under `{booking.location?.address_city} . {booking.location?.type}` linjen, tilfoej:

```tsx
{vehiclesByBooking.get(booking.id)?.length > 0 && (
  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
    {vehiclesByBooking.get(booking.id)!.map((v, i) => (
      <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-muted-foreground">
        <Car className="h-2.5 w-2.5" />
        {v.name}
      </Badge>
    ))}
  </div>
)}
```

### Resultat
- Hvert booking-kort viser sm diskrete tags med bil-ikon og bilnavn under lokationsinfo
- Tags er kompakte og passer ind i det eksisterende design
- Kun synlige naar der faktisk er tildelt en bil

### Filer der aendres

| Fil | Aendring |
|---|---|
| `src/pages/vagt-flow/BookingsContent.tsx` | Hent booking_vehicle data, byg lookup, vis bil-tags |
