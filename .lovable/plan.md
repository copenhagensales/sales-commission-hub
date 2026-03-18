

## Problem

Pointformlen er forkert. Nuværende: `(totalDivisions - division) * 20` giver 0 point til laveste division. Ifølge dit skema skal selv laveste division give point (f.eks. 5. division: #1 = 20pt).

**Korrekt formel:** `(totalDivisions - division + 1) * 20 - (rank - 1) * 5`

Eksempel med 5 divisioner:
- Superliga #1: (5-1+1)×20 = **100** ✓ (nuværende giver 80 ✗)
- 1. division #1: (5-2+1)×20 = **80** ✓
- 5. division #1: (5-5+1)×20 = **20** ✓ (nuværende giver 0 ✗)

## Ændringer

### 1. Backend: `league-process-round/index.ts`
Ret `calculatePoints`-formlen fra `(totalDivisions - division)` til `(totalDivisions - division + 1)`.

### 2. Frontend: `RoundResultsCard.tsx`
Ret samme formel i `calculatePointsDisplay`.

### 3. Regler-tekst: `LeagueRulesSheet.tsx`
Opdater eksemplet så det matcher den korrekte pointfordeling (f.eks. 5 divisioner: Superliga #1 = 100pt, osv.) og ret "6 runder" til "7 runder".

