

## Fix: Hotelomkostning skal beregnes pr. nat og kun på de rigtige dage

### Problem
1. **Hotelomkostning pr. booking** beregnes som `price_per_night × rooms` (= 1 nat). Den mangler at gange med antal nætter (`check_out - check_in`).
2. **Daglig fordeling** spreder hotelomkostningen jævnt over ALLE bookede dage i stedet for kun de dage der falder inden for `check_in`–`check_out`.

Derfor vises 1.185 kr på lørdag 28/3 selvom hotellet nu slutter d. 27/3.

### Ændring: `src/pages/vagt-flow/LocationProfitabilityContent.tsx`

**1. Beregn total hotelkost korrekt (linje ~184-191)**
- Beregn antal nætter: `differenceInDays(check_out, check_in)`
- Total = `price_per_night × rooms × nætter`

**2. Byg et hotel-kost-per-dag map i stedet for jævn fordeling**
- Nyt `hotelCostByBookingDate` map: `Map<string, number>` med nøgle `bookingId|YYYY-MM-DD`
- For hver hotel-entry: loop fra `check_in` til `check_out - 1 dag`, sæt `price_per_night × rooms` på hver nat-dato
- Brug dette map i daglig breakdown (linje ~531) i stedet for `loc.hotelCost / loc.bookedDays.length`

**3. Opdater location-aggregering**
- `hotelCostByLocation` summerer nu alle nætters kost (allerede korrekt når booking-total er korrekt)
- Location-total hotel i header-cards vil nu vise korrekt beløb

### Resultat
- Hotel-kolonnen viser kun omkostning på de dage der faktisk har hotelovernatning
- Lørdag 28/3 viser 0 kr hotel efter din rettelse
- Totalen matcher `pris × værelser × nætter`

