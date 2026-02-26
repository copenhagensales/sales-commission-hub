
## Tilføj hotel-tag på markedsbookinger i booking-oversigten

### Hvad ændres
Booking-oversigten for markeder viser i dag medarbejdere, køretøjer og diæt pr. dag -- men ikke hvilket hotel der er booket. Vi tilføjer et hotel-tag (ikon + hotelnavn) under hver markedbooking-header, så man hurtigt kan se om der er tildelt et hotel og hvilket.

### Teknisk plan

**Fil: `src/pages/vagt-flow/BookingsContent.tsx`**

1. **Import `useBookingHotels`** fra `@/hooks/useBookingHotels` samt `Hotel`-ikonet fra lucide-react.

2. **Hent hotel-data**: Brug `useBookingHotels` med alle synlige booking-IDs (fra `allBookings` eller tilsvarende) til at hente tilknyttede hoteller. Byg et `hotelMap` (booking_id -> booking_hotel record) med `useMemo`.

3. **Vis hotel-tag i markedsektionen**: Under booking-titlen (by/type/klient-linjen, ca. linje 832) tilføjes en `Badge` med hotelikonet og hotelnavnet, hvis der er et hotel tildelt til den pågældende booking. Stilen matcher de eksisterende tags (f.eks. køretøjs-badges) med en blå/lilla farve for at skille det visuelt fra medarbejdere og køretøjer.

```text
  Bolig & Livsstilsmessen Odense
  Odense C - Markeder - Eesy FM
  [Hotel-ikon] Hotel Odense          <-- nyt tag
```

Badgen vises kun når `hotelMap[booking.id]` eksisterer og har et hotel-navn. Farven bliver f.eks. `bg-blue-100 text-blue-800 border-blue-300` (eller tilsvarende i dark mode) for at adskille det fra de grønne/gule/orange tags.

### Omfang
En enkelt fil ændres (`BookingsContent.tsx`), ingen database-ændringer.
