

## Tilføj standardpris og postnummer til hotelregistret

### Database-ændring
Tilføj to nye kolonner til `hotel`-tabellen:

```sql
ALTER TABLE hotel ADD COLUMN postal_code text;
ALTER TABLE hotel ADD COLUMN default_price_per_night numeric;
```

### Kode-ændringer

**1. `src/hooks/useBookingHotels.ts`** — Udvid `Hotel` interface:
- Tilføj `postal_code: string | null` og `default_price_per_night: number | null`

**2. `src/components/vagt-flow/HotelRegistry.tsx`** — Opdater formular:
- Split "Adresse" i to felter: "Adresse" + "Postnummer" (grid cols)
- Tilføj felt for "Standardpris pr. nat (DKK)" (number input)
- Opdater `onSubmit` type og kald til at inkludere `postal_code` og `default_price_per_night`
- Vis postnummer ved siden af by i hotel-listen
- Vis standardpris i hotel-listen hvis sat

**3. `src/components/vagt-flow/AssignHotelDialog.tsx`** — Auto-udfyld pris:
- Tilføj felter til "Nyt hotel"-formularen (postnummer + standardpris)
- Når et hotel vælges, auto-udfyld `pricePerNight` med hotellets `default_price_per_night` hvis feltet er tomt

**4. `src/pages/vagt-flow/HotelsContent.tsx`** — Vis postnummer i booking-listen ved siden af hotelnavnet (valgfrit).

