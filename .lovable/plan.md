

## Tilføj mulighed for at ændre datoer på hotel-bookinger

### Hvad
I `HotelTabContent` (inden i EditBookingDialog) kan man i dag kun redigere pris, status, bekræftelsesnummer og bemærkninger. Check-in og check-out datoer kan ikke ændres uden at åbne "Rediger alle felter"-dialogen. Brugeren vil gerne kunne ændre datoerne direkte — ligesom bil-fanen har en dag-vælger.

### Ændringer

**Fil: `src/components/vagt-flow/EditBookingDialog.tsx` — `HotelTabContent`**

1. Tilføj `checkIn` og `checkOut` som redigerbare state-felter (ligesom `price`, `status` osv.)
2. Pre-fill fra `hotelEntry.check_in` / `hotelEntry.check_out`
3. Tilføj to datoinputs (type="date") i formularen mellem hotel-header og pris-feltet
4. Inkluder `check_in` og `check_out` i `handleSave` kaldet til `updateBookingHotel.mutateAsync`

**Fil: `src/hooks/useBookingHotels.ts` — `useUpdateBookingHotel`**

5. Udvid mutation-typingen til at acceptere `check_in` og `check_out` som valgfrie felter

### UI-layout
Datofelterne placeres i et 2-kolonne grid (ligesom pris/status):
- **Check-in** (date input) | **Check-out** (date input)
- Samlet pris | Status
- Bekræftelsesnummer
- Bemærkninger

### Ingen databaseændringer
`booking_hotel`-tabellen har allerede `check_in` og `check_out` kolonner — det handler kun om at eksponere dem i quick-edit UI'et.

