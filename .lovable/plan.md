

# Individuel bekræftelse af bookinger + behold "Bekræft uge"

## Hvad
Tilføj en "Bekræft"-knap på hver enkelt booking-kort der har status `draft`, så man kan godkende lokationer løbende. Den eksisterende "Bekræft uge"-knap bevares til batch-godkendelse.

## Ændringer

**`src/pages/vagt-flow/BookingsContent.tsx`:**

1. **Ny mutation** `confirmSingleMutation` der opdaterer én booking fra `draft` → `confirmed`:
   ```ts
   const confirmSingleMutation = useMutation({
     mutationFn: async (bookingId: string) => {
       const { error } = await supabase
         .from("booking")
         .update({ status: 'confirmed' })
         .eq("id", bookingId);
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["vagt-bookings-list"] });
       toast({ title: "Booking bekræftet" });
     },
   });
   ```

2. **Knap på hvert draft-kort** — ved siden af "Kladde"-badge, tilføj en lille "Bekræft"-knap (CheckCircle2-ikon, grøn variant), kun synlig når `booking.status === 'draft'` og brugeren har redigeringsrettigheder (`canEditFmBookings`).

3. **"Bekræft uge"** bevares som den er — den bekræfter alle resterende drafts på én gang.

Ingen database-ændringer, ingen nye filer.

