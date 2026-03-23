

# Fix: Dag-nummer konvertering i daglig nedbrydning

## Årsag
`booked_days` i DB: mandag=0, fredag=4.
`getDay()` i JS: mandag=1, fredag=5.
Koden matcher aldrig fredag (5 ≠ 4).

## Ændring

### `src/pages/vagt-flow/LocationProfitabilityContent.tsx` — linje 523
```typescript
// Fra:
const dayNum = date.getDay() === 0 ? 7 : date.getDay();

// Til:
const jsDay = date.getDay();
const dayNum = jsDay === 0 ? 6 : jsDay - 1;
```

Én linje. Total-beregningen er allerede korrekt (bruger `bookedDays.length`).

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/LocationProfitabilityContent.tsx` | Linje 523: fix dag-konvertering |

