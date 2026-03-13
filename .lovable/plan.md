

## Tilføj "Tilbage til kladde" for bekræftede bookinger

**Fil**: `src/pages/vagt-flow/BookingsContent.tsx`

### Ændringer

1. **Import** — tilføj `Undo2` fra lucide-react

2. **Ny mutation** (efter `confirmSingleMutation`, ~linje 789) — `revertToDraftMutation`:
   - Opdaterer booking status til `'draft'` via `supabase.from('booking').update({ status: 'draft' }).eq('id', bookingId)`
   - Invaliderer `vagt-bookings-list` queries
   - Toast: "Booking sat tilbage til kladde"

3. **Regulære bookinger** (~linje 1002, efter den lukkende `)}` for draft-blokken) — tilføj knap for confirmed bookings:
   ```
   {booking.status === 'confirmed' && canEditFmBookings && (
     <Button variant="outline" size="sm" onClick → revertToDraftMutation.mutate(booking.id)>
       <Undo2 /> Til kladde
     </Button>
   )}
   ```
   Styling: gul/orange outline for at signalere "nedgradering" (`border-yellow-300 text-yellow-700`)

4. **Markedsbookinger** (~linje 1282, samme mønster) — tilføj identisk knap efter draft-blokken

### Konsekvens
- Booking forsvinder fra medarbejderes "Min uge" (kun confirmed vises)
- Booking forsvinder fra leverandørrapport (filtrerer på `status = 'confirmed'`)
- Draft-styling aktiveres automatisk via eksisterende conditional classes

