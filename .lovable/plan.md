

# Forecast: Brug `booking_assignment` som vagtkilde for FM-medarbejdere

## Problem
Forecast-beregningen henter kun vagter fra `shift`-tabellen og standard-vagthierarkiet (individuelle vagter → medarbejder-standard → team-standard). FM-medarbejderes vagter registreres derimod i `booking_assignment`-tabellen via booking-systemet. Derfor har Sandra og alle andre FM-medarbejdere 0 vagter → 0 timer → forkert forecast.

## Ændring

### `src/hooks/useClientForecast.ts`

**1. Hent `booking_assignment`-data (ved linje 230, i Promise.all)**
- Tilføj query: `booking_assignment` med `employee_id, date` for alle aktive medarbejdere i perioden (ninetyDaysAgo → forecastEndStr)
- Byg et `bookingAssignmentMap: Map<string, Set<string>>` (employee_id → set af datoer)

**2. Udvid `countShifts()` funktionen (linje 315-351)**
- I vagthierarkiet, tjek `bookingAssignmentMap` som ekstra kilde:
  - Hvis datoen findes i `booking_assignment` for medarbejderen → tæl som vagt
  - Prioritet: `individualDates` (shift-tabel) → `bookingAssignment` → `empStandardDays` → `teamDays`
- FM-bookinger har dermed højere prioritet end standard-vagter men lavere end individuelle shift-poster

**3. Udvid `getNormalWeeklyShifts()` (linje 354-361)**
- For medarbejdere der primært bruger bookinger (ingen standard-vagter), beregn gennemsnitligt antal ugentlige bookinger fra de seneste 8 uger som fallback

| Fil | Ændring |
|-----|---------|
| `src/hooks/useClientForecast.ts` | Tilføj `booking_assignment` query + integrer i `countShifts()` hierarkiet |

## Effekt
- FM-medarbejdere som Sandra vil få korrekt vagttal baseret på deres faktiske bookinger
- SPH beregnes nu med reelle timer (bookede vagter × 7,5 timer)
- Forecast vil reflektere det faktiske antal planlagte arbejdsdage

