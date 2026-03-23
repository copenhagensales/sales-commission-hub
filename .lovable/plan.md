
# Tilføj placeringsvalg i Lokationsøkonomi-fanen

## Problem
I Økonomi-fanen (LocationProfitabilityContent) vises lokationsomkostningen som 0 kr for lokationer der bruger placeringer (K1, K2 osv.) i stedet for en fast dagspris. Det sker fordi `daily_rate_override` er null på bookingen og lokationens base `daily_rate` kan være 0.

## Ændringer

### 1. `src/pages/vagt-flow/LocationProfitabilityContent.tsx`
- Hent `placement_id` med i booking-queryen samt join `location_placements` for at få placeringens dagspris
- I beregningen: brug `booking.daily_rate_override ?? placement.daily_rate ?? location.daily_rate` som fallback-kæde
- Vis placeringsnavn i tabellen (fx "RO's Torv — K1") så man kan se hvilken placering der er valgt
- Tilføj mulighed for at ændre placering direkte fra tabellen via en Select-dropdown, der opdaterer bookingen med den valgte placerings `placement_id` og `daily_rate_override`

### 2. Booking-opdatering ved placeringsskift
- Når bruger vælger en ny placering i Økonomi-tabellen, opdater bookingen med:
  - `placement_id` = den valgte placerings id
  - `daily_rate_override` = placeringens dagspris
- Invalidér queries så tallene genberegnes med det samme

## Teknisk detalje
- Hent `location_placements` for alle lokationer i ugen (1 samlet query)
- Match placements til bookinger via `booking.location_id` → `location_placements.location_id`
- Vis Select-dropdown kun for lokationer der har definerede placeringer

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/LocationProfitabilityContent.tsx` | Hent placement-data, vis placering, tilføj placeringsvalg-dropdown, opdatér booking |
