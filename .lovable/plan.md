

## Tilfoej diaet-tag i booking-oversigten

### Problem
Naar der er tildelt diaeter pa en booking, kan man kun se det inde i EditBookingDialog. Der mangler et visuelt tag i selve booking-griddet (ligesom bil-tagget med gult tema).

### Losning
Tilfoej et orange-farvet tag med et Utensils-ikon (bestik) i dag-cellerne, der viser "Diaet" naar der findes diaet-poster for den paagaeldende booking og dato. Moenstreret foelger praecis det eksisterende vehicle-tag moenster.

### Aendringer i `src/pages/vagt-flow/BookingsContent.tsx`

1. **Ny query for booking_diet data** (efter vehicle-queryen, ca. linje 272):
   - Hent `booking_diet` raekkerne for alle synlige booking-id'er
   - Select: `id, booking_id, date` (vi behoever ikke amount/employee for tagget)

2. **Ny lookup-map** (efter vehiclesByBookingDate):
   - `dietByBookingDate`: `Map<string, boolean>` med key `bookingId_date`
   - Returnerer `true` hvis der findes mindst en diaet-post for den kombination

3. **Render tag i dag-cellen** (efter vehicle-tagget, ca. linje 731):
   - Samme moenster som bil-tagget
   - Orange tema: `bg-orange-100 text-orange-800 border-orange-300`
   - Utensils-ikon (bestik) fra lucide-react + teksten "Diaet"

4. **Render tag i market-sektionen** (i markedernes dagsgrid, ca. linje 817):
   - Samme orange diaet-tag i market-bookingernes dag-celler
   - Bruger den samme `dietByBookingDate` map (market-bookinger er inkluderet i queryen via `marketBookings`)

### Imports
- Tilfoej `Utensils` til den eksisterende lucide-react import

### Eksempel paa tagget
```text
[Utensils-ikon] Diaet
```
Farve: orange (bg-orange-100, text-orange-800, border-orange-300) - matcher den eksisterende diaet-farve brugt i EditBookingDialog.

### Ingen database-aendringer
`booking_diet`-tabellen eksisterer allerede og indeholder de noedvendige data.

