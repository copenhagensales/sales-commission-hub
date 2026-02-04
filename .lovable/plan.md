
# Plan: Ret filtrering af Centre/Boder udgifter

## Problem identificeret

Bookinger hentes kun hvis `start_date` falder inden for den valgte periode. Men mange bookinger løber over flere dage (f.eks. 2.-6. februar), så hvis du vælger "I går" (3. februar), fanges de ikke fordi de startede den 2. februar.

**Eksempel:**
- Booking: Center Slotsarkaderne, 2.-6. februar 2026
- Valgt periode: "I går" (3. februar)
- Nuværende filter: `start_date >= '2026-02-03' AND start_date <= '2026-02-03'`
- Resultat: Booking fanges IKKE (start_date er 2. februar)

---

## Løsning

Ændr forespørgslen til at finde bookinger der **overlapper** med den valgte periode:
- En booking overlapper hvis: `start_date <= periodSlut OG end_date >= periodStart`

---

## Teknisk ændring

**Fil:** `src/pages/reports/RevenueByClient.tsx` (linje 351-352)

**Fra:**
```typescript
.gte("start_date", startDateStr)
.lte("start_date", endDateStr);
```

**Til:**
```typescript
.lte("start_date", endDateStr)  // Booking starter før eller på periodens slutdato
.gte("end_date", startDateStr); // Booking slutter efter eller på periodens startdato
```

---

## Resultat

| Periode valgt | Nuværende | Efter rettelse |
|---------------|-----------|----------------|
| I dag (4. feb) | 0 bookinger | Alle aktive bookinger |
| I går (3. feb) | 0 bookinger | Alle aktive bookinger |
| Denne uge | Kun nye bookinger | Alle overlappende |

---

## Fil der ændres
- `src/pages/reports/RevenueByClient.tsx`
