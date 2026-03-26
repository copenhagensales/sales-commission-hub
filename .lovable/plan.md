

## Dag-vælger til hotel-bookinger (som biler)

### Hvad
Erstat check-in/check-out dato-felter med en dagvælger (checkboxes for ugedage), ligesom bil-fanen. Samlet pris fordeles ligeligt over de valgte dage. Økonomi-fanen bruger hotellets egne valgte dage til prisfordeling.

### Database
Ny kolonne på `booking_hotel`:
```sql
ALTER TABLE booking_hotel ADD COLUMN booked_days integer[] DEFAULT '{}';
```
Migrer eksisterende data: udled dage fra `check_in`/`check_out` intervaller.

### Fil 1: `src/components/vagt-flow/EditBookingDialog.tsx` — `HotelTabContent`

- Fjern check-in/check-out dato-inputs
- Tilføj dagvælger med checkboxes (Man–Søn) — identisk pattern som vehicle-fanen
- Kun dage inden for booking's `start_date`–`end_date` kan vælges
- Vis beregning: "Samlet pris / antal valgte dage = X kr/dag"
- `handleSave` sender `booked_days` (integer array) i stedet for `check_in`/`check_out`

### Fil 2: `src/components/vagt-flow/AssignHotelDialog.tsx`

- Tilføj dagvælger i stedet for check-in/check-out
- Ved oprettelse: send `booked_days` array med hotel-assignment

### Fil 3: `src/hooks/useBookingHotels.ts`

- Udvid `BookingHotel` interface med `booked_days: number[]`
- Opdater `useUpdateBookingHotel` og `useAssignHotel` til at acceptere `booked_days`

### Fil 4: `src/pages/vagt-flow/LocationProfitabilityContent.tsx`

- Hent `booked_days` fra `booking_hotel` query (linje ~141)
- Brug hotellets egne `booked_days.length` til at fordele prisen per dag i stedet for bookings `booked_days.length`
- I daglig nedbrydning (linje ~531): tjek om datoen er i hotellets `booked_days` for at tildele hotelomkostning

### Fil 5: `src/pages/vagt-flow/HotelsContent.tsx`

- Vis antal valgte hoteldage i booking-kortet (f.eks. "4 dage")

### Resultat
- Pris 5.000 kr, 5 dage = 1.000 kr/dag
- Fjern en dag → 4 dage = 1.250 kr/dag
- Synkroniseret mellem hotel-fanen og økonomi-fanen

