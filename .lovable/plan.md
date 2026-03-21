

# Fix: Medtag helligdage i forecast

## Problem
`countShifts()` i `useClientForecast.ts` ignorerer danske helligdage. I uge 14 (påske) tælles Skærtorsdag, Langfredag og 2. Påskedag som arbejdsdage, hvilket giver ~3 ekstra dages forecast per medarbejder — en betydelig overvurdering.

`useEmployeeWorkingDays` hooket håndterer allerede helligdage korrekt — forecastet gør ikke.

## Løsning
Hent danske helligdage og filtrer dem fra i `countShifts()`.

### `src/hooks/useClientForecast.ts`

1. **Importér `useDanishHolidays`** (eller hent direkte fra `danish_holidays`-tabellen i den eksisterende query)
2. **Byg et `holidayDates: Set<string>`** fra helligdagene i forecast-perioden (inkl. EWMA-vinduet)
3. **Tilføj holiday-check i `countShifts()`**:
   ```
   if (holidayDates.has(dateStr)) {
     cur.setDate(cur.getDate() + 1);
     continue;
   }
   ```
   Placeres INDEN absence-checket og shift-hierarkiet. Helligdage tæller aldrig som vagter, uanset om der er individuelle vagter registreret.

### Effekt
- Uge 14 reduceres fra 5 → 2 arbejdsdage (3 helligdage fjernet)
- EWMA SPH beregnes også korrekt (historiske uger med helligdage justeres)
- Både gross og net shifts påvirkes korrekt

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Hent helligdage, tilføj holiday-filter i `countShifts()` |

