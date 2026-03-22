

# Fix: Helligdage ignoreres i forecast (forkert tabelnavn)

## Problem
`useClientForecast.ts` linje 215 querier `danish_holidays` (med 's'), men tabellen hedder `danish_holiday`. Queryen fejler stille → `holidayDates` er altid tomt → alle helligdage tælles som arbejdsdage.

For april 2026 mangler 3 arbejdsdage (Skærtorsdag, Langfredag, 2. Påskedag) i forecastet, hvilket oppuster resultatet.

## Ændring

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` linje 215 | Ret `"danish_holidays"` → `"danish_holiday"` |

Én linje. Ingen andre ændringer nødvendige — resten af logikken (holiday-filtering i shift-counting og daysElapsed/daysRemaining) bruger allerede `holidayDates` korrekt.

## Effekt
- April-forecast reduceres med ~3 arbejdsdage per medarbejder
- Alle fremtidige måneder med helligdage (Kr. Himmelfart, Pinse, jul osv.) beregnes nu korrekt
- Indeværende måned påvirkes også positivt (korrekt remaining-beregning)

