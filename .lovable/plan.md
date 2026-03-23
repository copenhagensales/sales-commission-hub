

# Fix: FM-medarbejdere bruger KUN bookinger til forecast-vagter

## Problem
FM-medarbejdere som Melissa (5 bookinger i april) får 22 vagter fordi `countShifts` falder igennem til team standard (man-fre). FM-medarbejdere skal KUN tælle individuelle vagter + booking assignments — aldrig employee standard eller team standard.

## Ændring i `src/hooks/useClientForecast.ts`

### 1. Detect FM-medarbejdere
`teamNameMap` eksisterer allerede (linje 126). Brug det til at checke om medarbejderens team indeholder "fieldmarketing" eller "field marketing".

### 2. Ret `countShifts` — tilføj `isFm`-parameter (linje 330-375)
Tilføj en `isFm: boolean = false` parameter. Når `isFm = true`: tæl KUN individuelle vagter + booking assignments. Spring employee standard og team standard over.

### 3. Ret `getNormalWeeklyShifts` (linje 379-406)
Tilføj `isFm`-parameter. Når `isFm = true`: brug gennemsnitlig booking-frekvens, spring team standard over.

### 4. Brug FM-flag i forecast-loop (linje 436-490)
Beregn `isFmEmployee` fra teamnavnet og send det med til `countShifts` og `getNormalWeeklyShifts`.

## Resultat
- Melissa: 5 bookinger → 5 vagter → 37.5 timer
- Sandra/Jesus/Martin (special shift, 0 dage): 0 vagter → 0 forecast (uændret)
- Non-FM medarbejdere: bruger fortsat team standard fallback (uændret)

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj isFm-parameter til countShifts og getNormalWeeklyShifts, brug det for FM-teams |

