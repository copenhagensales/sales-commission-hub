

# Fix: FM-medarbejdere skal ALTID bruge bookingOnly

## Problem
Vagtplanen viser "09:30-17:30 / ikke booket" for alle FM-medarbejdere — det er team standard shifts (man-fre). Forecastet tæller disse som rigtige vagter, fordi `useBookingOnly` kun er `true` når der er **nul** bookinger. Har medarbejderen bare 1 booking, bruges team standard for alle andre dage → oppustet forecast.

## Løsning
Identificér FM-medarbejdere via teamnavnet og tving `bookingOnly = true` for dem alle. Så tælles KUN individuelle vagter + booking assignments — aldrig team standard.

## Ændring i `src/hooks/useClientForecast.ts`

**Linje 482-508 erstattes med:**
```typescript
// FM employees: ALWAYS use bookingOnly (team standard is irrelevant for FM)
const empTeamId = employeeTeamMap.get(emp.id);
const empTeamName = empTeamId ? teamNameMap.get(empTeamId) : null;
const isFmEmployee = empTeamName?.toLowerCase().includes('fieldmarketing') 
  || empTeamName?.toLowerCase().includes('field marketing');

const useBookingOnly = isFmEmployee || (!hasAnyForecastShifts && !hasAnyForecastBookings);

let grossShifts = countShifts(emp.id, forecastStart, empForecastEnd, false, useBookingOnly);
let forecastShifts = countShifts(emp.id, forecastStart, empForecastEnd, true, useBookingOnly);
```

- Fjern safety-net (linje 490-495) — nu overflødig
- Fjern debug-logs (linje 497-508) — nu overflødig
- Kræver at `teamNameMap` allerede eksisterer (skal verificeres, evt. bygges fra eksisterende team-data)

## Resultat
- Sandra R april: 0 bookinger → 0 vagter → 0 forecast
- Sandra R marts: kun hendes faktiske bookinger+vagter tælles
- Non-FM medarbejdere: uændret (bruger stadig team standard som fallback)

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | FM = altid bookingOnly, fjern debug+safety-net |

