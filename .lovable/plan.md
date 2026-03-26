

## Fix: Hotel-pris beregnes forkert i økonomi-fanen

### Problem
`price_per_night` er i virkeligheden **samlet pris** for hele opholdet (ikke pris per nat). Men i `LocationProfitabilityContent.tsx` linje 187 ganges den med `rooms`:

```typescript
const cost = (h.price_per_night || 0) * (h.rooms || 1);
```

For Kolding Storcenter: 3.777 kr × 2 værelser = 7.554 kr → fordelt på 4 dage = 1.889 kr/dag.
Det korrekte er: 3.777 kr / 4 dage = **944 kr/dag**.

### Ændring

**Fil: `src/pages/vagt-flow/LocationProfitabilityContent.tsx`** — linje 187

Fjern multiplikation med `rooms`:
```typescript
// Før:
const cost = (h.price_per_night || 0) * (h.rooms || 1);
// Efter:
const cost = h.price_per_night || 0;
```

Samlet pris er allerede det fulde beløb. `rooms` er metadata, ikke en multiplier.

### Resultat
- Kolding: 3.777 kr / 4 dage = **944 kr/dag** ✓
- Total hotel i uge-oversigten: 3.777 kr (halveret fra nuværende 7.554 kr)

