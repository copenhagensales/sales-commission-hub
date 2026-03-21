

# Fix: Undtagelse kun for faktura 940

## Problem
Den nuværende logik trækker altid 1 måned fra alle fakturadatoer. Faktura 940 (ASE, 395.900 DKK, dato 2026-01-31) skal **ikke** have trukket en måned fra — den tilhører januar.

## Løsning
Tilføj en simpel undtagelse: hvis `faktura_nr` er `"940"`, spring -1 måned over.

## Ændring

| Fil | Hvad |
|-----|------|
| `src/pages/economic/EconomicRevenueMatch.tsx` (linje ~89-93) | Tilføj check: kun -1 måned hvis faktura_nr !== "940" |

**Logik:**
```typescript
const d = new Date(r.dato + "T00:00:00");
if (String(r.faktura_nr) !== "940") {
  d.setMonth(d.getMonth() - 1);
}
const adjustedMonth = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
```

## Resultat
- Faktura 940 → **januar 2026** ✓
- Alle andre fakturaer → forrige måned som hidtil ✓

