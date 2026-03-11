

# Hotelindikator på bookingkort

## Hvad
Tilføj en lille hotel-badge på booking-kortet i Bookinger-fanen, så lederen kan se med det samme om der er booket hotel til en given booking. Vises ved siden af "Kladde"-badge i headeren.

## Tilgang

**Data:** Genbruge `useBookingHotels` hooket med de viste bookings' ID'er til at hente hotel-tildelinger. Byg et simpelt map `bookingId → hotelNavn + status`.

**UI:** I booking-kortets header (linje ~694-709 i `BookingsContent.tsx`), efter den eksisterende "Kladde"-badge, vis en badge:
- **Grøn** med hotel-ikon + hotelnavn hvis status er "confirmed"
- **Blå** med hotel-ikon + hotelnavn hvis status er "pending"

```text
┌─────────────────────────────────────────┐
│ Herning Centeret          [Kladde] [🏨 Hotel Herning ✓]  │
│ Herning • Danske Shoppingcentre                          │
└─────────────────────────────────────────┘
```

## Ændringer

**`src/pages/vagt-flow/BookingsContent.tsx`:**
1. Import `useBookingHotels` og `Hotel` icon fra lucide
2. Kald `useBookingHotels(bookingIds)` med alle synlige booking-ID'er
3. Byg `hotelMap: Record<bookingId, { name, status }>` via `useMemo`
4. I booking-kortets header, efter Kladde-badge, tilføj hotel-badge hvis booket

Ingen nye filer, ingen DB-ændringer. Kun en lille visuel indikator.

