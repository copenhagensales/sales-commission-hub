

## Tilføj hotel-info på medarbejderens vagtplan

### Hvad ændres
Medarbejdere skal kunne se deres hotel-booking direkte i vagtplanen -- med hotelnavn, adresse, check-in/check-out tidspunkter og eventuelle noter. Hotelkortet vises som et pænt callout-kort (ligesom booking-noten) på de relevante dage.

### Teknisk plan

**Fil: `src/pages/vagt-flow/MyBookingSchedule.tsx`**

1. **Ny data-query: Hent booking_hotel data**
   - Tilføj en `useQuery` der henter `booking_hotel` + `hotel`-stamdata for ugens `bookingIds`
   - Felter: `booking_id`, `check_in`, `check_out`, `notes`, `status`, samt hotel: `name`, `address`, `city`, `phone`

2. **Udvid dayData med hotel-info**
   - I `useMemo` der grupperer data pr. dag: match hotel til assignment hvis dagens dato falder inden for `check_in`/`check_out` intervallet
   - Tilføj `isCheckInDay` og `isCheckOutDay` flag så vi kan vise specielle labels

3. **UI: Hotel-badge i badges-rækken**
   - Tilføj blå `Badge` med `Hotel`-ikon og hotelnavn i samme række som bil og diæt
   - Stil: `bg-blue-100 text-blue-800 border-blue-300` (matcher det eksisterende mønster fra BookingsContent)

4. **UI: Hotel-detalje callout på check-in og check-out dage**
   - På check-in dag: Vis et callout-kort (samme stil som booking-noten) med:
     - Hotel-ikon + hotelnavn som header
     - Adresse og by
     - "Indtjekning: [dato]" 
     - "Udtjekning: [dato]"
     - Eventuelle noter fra hotelreservationen
   - På check-out dag: Vis et kort reminder-callout med "Udtjekning i dag"
   - På mellemliggende dage: Kun badge (ingen detaljer)

5. **Import**
   - Tilføj `Hotel` fra `lucide-react`

### Omfang
En enkelt fil ændres (`MyBookingSchedule.tsx`), ingen database-ændringer.

