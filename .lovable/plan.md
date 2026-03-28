

## Plan: Ret hotelberegning i HotelExpensesTab

### Problem
Feltet `price_per_night` i `booking_hotel` er reelt **totalpris for hele opholdet** (ex moms), ikke en pris per nat. Koden ganger fejlagtigt med antal nætter og antal værelser, hvilket giver alt for høje beløb.

### Rettelse i `src/components/billing/HotelExpensesTab.tsx`

1. **Linje-total**: Brug `bh.price_per_night` direkte som total (ikke ganget med nætter/rooms)
2. **KPI "Samlet udgift"**: Samme rettelse -- sum af `price_per_night` uden multiplikation
3. **Kolonne "Pris/nat"**: Omdøb til "Pris (total)" eller beregn den faktiske pris/nat som `price_per_night / nights` til visning
4. **Nætter-beregning**: Brug `booked_days.length` i stedet for check-in/check-out differens (det er mere præcist jf. jeres booking-model)

### Teknisk detalje

Nuværende (forkert):
```typescript
const lineTotal = bh.price_per_night * nights * rooms;
```

Rettet:
```typescript
const lineTotal = bh.price_per_night || 0; // allerede totalpris
const pricePerNight = nights > 0 ? lineTotal / nights : 0; // til visning
```

Kolonne "Pris/nat" viser den beregnede pris per nat, og "Total" viser `price_per_night` direkte.

### Fil

| Fil | Handling |
|-----|---------|
| `src/components/billing/HotelExpensesTab.tsx` | Ret beregning + kolonnenavne |

