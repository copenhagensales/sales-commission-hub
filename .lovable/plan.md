

## Fjern bil fra dag — knap på bil-badge

### Ændringer i `BookingsContent.tsx`

1. **Udvid `vehiclesByBookingDate`** — tilføj `vehicleId` til hvert entry så vi kan målrette sletningen:
   ```ts
   // Fra: { name, plate }
   // Til: { name, plate, vehicleId }
   ```

2. **Ny `removeVehicleFromDayMutation`** — sletter fra `booking_vehicle` med match på `booking_id`, `vehicle_id` og `date`. Invaliderer samme caches som add-mutationen.

3. **X-knap på bil-badges** i begge grids (regular + FM bookings). Vises kun ved hover og kun når `canEditFmBookings`. Lille X-ikon inline i badge'en:
   ```tsx
   <Badge ...>
     <Car /> {v.name}
     <button onClick={() => removeVehicleFromDayMutation.mutate({
       bookingId, vehicleId: v.vehicleId, date: dateStr
     })} className="ml-0.5 opacity-0 group-hover/day:opacity-100">
       <X className="h-2 w-2" />
     </button>
   </Badge>
   ```

### Omfang
- Kun `BookingsContent.tsx`
- Ingen nye filer, komponenter eller database-ændringer
- Ingen bekræftelsesdialog (kan tilføjes senere hvis ønsket)

