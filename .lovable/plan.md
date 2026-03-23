

# Skjul "Ingen salgsdata" og "Mangler opsætning" fra forecast

## Problem
I Eesy FM-forecastet vises medarbejdere under "Ingen salgsdata" og "Mangler opsætning", selvom de sandsynligvis arbejder på Yousee og ikke bør indgå i Eesy FM-forecastet. De skaber forvirring og forurener overblikket.

## Ændring

### `src/components/forecast/ForecastBreakdownTable.tsx`
- Fjern de to sektioner "Ingen salgsdata" og "Mangler opsætning" helt fra visningen
- Fjern de tilhørende variabler (`noDataEmployees`, `unmappedEmployees`) da de ikke længere bruges
- Dette gør forecastet rent og kun fokuseret på medarbejdere med faktisk salgsaktivitet

### `src/components/forecast/ForecastTeamOverview.tsx`
- Sørg for at team-kort kun tæller mapped+aktive medarbejdere (allerede filtreret via `!e.missingAgentMapping`, men verificér at no-data medarbejdere heller ikke påvirker team-totaler)

| Fil | Ændring |
|-----|---------|
| `src/components/forecast/ForecastBreakdownTable.tsx` | Fjern "Ingen salgsdata" og "Mangler opsætning" sektionerne |

