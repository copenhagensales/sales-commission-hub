

# Fix: Sandra R får forecast trods ingen vagter

## Problem
`countNormalShifts` bruger et fallback-hierarki: individuelle vagter → booking assignments → employee standard → **team standard**. Sandra R har ingen af de tre første, men teamets standard shift er mon-fre, så hun får ~22 "vagter" i marts og dermed et forecast baseret på forrige måneds SPH.

For FM-medarbejdere skal forecast være 0 når der ikke er bookinger — team standard shifts er irrelevant for FM.

## Løsning
Forecastet skal for FM-medarbejdere kun tælle vagter fra individuelle shifts og booking assignments — **ikke** falde igennem til employee standard eller team standard.

### Ændring i `useTeamGoalForecast.ts`

**Tilføj FM-team detection:**
- Hent teamets navn eller brug en kendt team_id for at afgøre om teamet er FM
- Alternativt: check om medarbejderen har booking_assignments i perioden — hvis ikke, og der heller ikke er individuelle vagter, sæt targetShifts = 0

**Simpleste fix:** For `targetShifts`-beregningen (fremtiden): Hvis medarbejderen ikke har nogen individuelle vagter OG ikke har nogen booking assignments i target-måneden, sæt targetShifts = 0 i stedet for at falde igennem til team standard.

Dette matcher den dokumenterede regel: "Ingen bookinger = 0 forecast".

**Konkret:** I `countNormalShifts`, tilføj en parameter `bookingOnly: boolean`. Når det er true, spring employee standard og team standard over. Brug dette flag for target-måneden når medarbejderen ikke har individuelle vagter eller bookings.

| Fil | Ændring |
|-----|---------|
| `useTeamGoalForecast.ts` | Stop fallback til team/employee standard shifts for target-måneden når ingen bookinger findes |

