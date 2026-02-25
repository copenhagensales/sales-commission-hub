

## Vis bil-tags per dag i booking-gitteret

### Problem
Bil-tags vises kun samlet under lokationsnavnet. Brugeren vil se hvilken bil der er tildelt på hver enkelt dag i ugeoversigten.

### Loesning
Aendre vehicle-lookup fra booking-niveau til booking+dato-niveau, og vise bil-badges inde i hver dags celle i gitteret.

### Teknisk plan

**Fil:** `src/pages/vagt-flow/BookingsContent.tsx`

**Aendring 1** -- Udvid `vehiclesByBooking` til at vaere dato-baseret (linje 229-241):

Erstat det nuvaerende lookup med et der bruger `booking_id + date` som noegle:

```typescript
const vehiclesByBookingDate = useMemo(() => {
  const map = new Map<string, { name: string; plate: string }[]>();
  for (const bv of bookingVehicles as any[]) {
    if (!bv.vehicle || !bv.date) continue;
    const key = `${bv.booking_id}_${bv.date}`;
    const existing = map.get(key) || [];
    const alreadyAdded = existing.some(v => v.name === bv.vehicle.name);
    if (!alreadyAdded) {
      existing.push({ name: bv.vehicle.name, plate: bv.vehicle.license_plate });
    }
    map.set(key, existing);
  }
  return map;
}, [bookingVehicles]);
```

**Aendring 2** -- Vis bil-badge i hver dags celle (efter medarbejder-assignments, ca. linje 678):

Inde i hver dag-celle, efter assignments-listen, tilfoej:

```tsx
{(() => {
  const dateStr = format(dayDate, "yyyy-MM-dd");
  const dayVehicles = vehiclesByBookingDate.get(`${booking.id}_${dateStr}`);
  if (!dayVehicles?.length) return null;
  return (
    <div className="mt-1 flex flex-col items-center gap-0.5">
      {dayVehicles.map((v, i) => (
        <Badge key={i} variant="secondary" className="text-[9px] px-1 py-0 gap-0.5 bg-primary/10 text-primary">
          <Car className="h-2 w-2" />
          {v.name}
        </Badge>
      ))}
    </div>
  );
})()}
```

**Aendring 3** -- Fjern bil-tags fra lokationsnavnet (linje 561-570):

Fjern den eksisterende `vehiclesByBooking.get(booking.id)` sektion under lokationsnavnet, da bilerne nu vises per dag i stedet.

### Filer der aendres

| Fil | Aendring |
|---|---|
| `src/pages/vagt-flow/BookingsContent.tsx` | Aendr vehicle-lookup til dato-baseret, vis bil-badges per dag, fjern samlet bil-sektion |

### Resultat
- Hver dag i ugegitteret viser hvilke biler der er tildelt den specifikke dag
- Kompakte badges med bil-ikon og navn
- Kun synlige paa dage hvor der faktisk er tildelt en bil
