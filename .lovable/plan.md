

# Ret ticker-tekst og tydeliggør 300 kr-grænsen

## Problem
Teksten "Seneste salg (300+ kr)" og "Ingen salg over 300 kr de sidste 15 min" antyder at det er per salg. Men grænsen er per sælger (samlet provision over 15 min). En sælger med 3 × 100 kr = 300 kr skal også fremgå — og det gør de allerede i koden, men teksten er misvisende.

## Ændringer i `src/pages/tv-board/TvLeagueDashboard.tsx`

1. **Header-tekst** (linje 448): Ændr fra `🔥 Seneste salg (300+ kr)` til `🔥 Seneste indtjening (300+ kr samlet)`
2. **Tomtilstand** (linje 117): Ændr fra `Ingen salg over 300 kr de sidste 15 min` til `Ingen sælgere med 300+ kr siden sidste opdatering`

Ingen ændringer i edge function — logikken er allerede korrekt (aggregerer per sælger).

| Fil | Ændring |
|-----|---------|
| `src/pages/tv-board/TvLeagueDashboard.tsx` | Opdater 2 tekst-strenge |

