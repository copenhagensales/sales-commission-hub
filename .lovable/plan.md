

## Tilføj dag til eksisterende booking

### Hvad
En "+" knap vises ved hover over ikke-bookede dage i dag-griddet, som modstykke til den eksisterende "X" slet-knap på bookede dage. Klik tilføjer dagen til bookingen uden bekræftelsesdialog (da det ikke er destruktivt).

### Ændringer i `BookingsContent.tsx`

1. **Ny `addDayMutation`** — opdaterer `booked_days`-arrayet på bookingen med den nye dag-index:
   ```ts
   addDayMutation = useMutation({
     mutationFn: async ({ bookingId, dayIndex, currentBookedDays }) => {
       const newBookedDays = [...currentBookedDays, dayIndex].sort();
       await supabase.from("booking").update({ booked_days: newBookedDays }).eq("id", bookingId);
     },
     onSuccess: () => invalidate caches + toast
   })
   ```

2. **"+" knap på ikke-bookede dage** — i begge dag-grids (almindelige og FM-bookinger), vis en `+` knap ved hover når `canEditFmBookings && !isBooked`:
   ```tsx
   {canEditFmBookings && !isBooked && (
     <button onClick={() => addDayMutation.mutate({...})} className="...opacity-0 group-hover/day:opacity-100...">
       <Plus className="h-3 w-3" />
     </button>
   )}
   ```

3. Samme mønster tilføjes i **MarketsContent.tsx** hvis den har tilsvarende dag-grid.

### Omfang
- Kun `BookingsContent.tsx` (+ evt. `MarketsContent.tsx`)
- Ingen nye komponenter, dialoger eller database-ændringer
- Importér `Plus` fra lucide-react

