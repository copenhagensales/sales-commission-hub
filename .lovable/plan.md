

# Fordel hotelomkostning ud på dage

## Problem
I den daglige nedbrydning vises hotel altid som 0 kr, fordi hotelomkostningen kun beregnes samlet per booking. Brugeren vil se den fordelt jævnt over de bookede dage.

## Ændring

### `src/pages/vagt-flow/LocationProfitabilityContent.tsx` — linje 532-533
I stedet for `dayHotelCost = 0`, beregn:
```
dayHotelCost = isBooked ? (loc.hotelCost / loc.bookedDays.length) : 0
```

Så den samlede hotelomkostning for lokationen deles ligeligt ud på alle bookede dage. Ugen-totalen forbliver den samme.

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/LocationProfitabilityContent.tsx` | Linje 532-533: fordel hotelomkostning per booked dag |

