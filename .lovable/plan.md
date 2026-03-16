

## Træk dig fra ligaen → bliv fan

### Ændringer

**1. Ny mutation: `useUnenrollAndBecomeFan`** i `src/hooks/useLeagueData.ts`
- Sætter `is_spectator = true` (i stedet for `is_active = false`) på enrollment
- Fjerner fra standings-tabellen
- Spilleren forbliver tilmeldt som fan

**2. Opdater unenroll-sektionen** i `src/pages/CommissionLeague.tsx`
- For **aktive deltagere** (ikke fans): erstat "Afmeld liga"-knappen med **"Træk mig fra ligaen – bliv fan"**
- Klik åbner en `AlertDialog` med advarsel:
  - "Er du sikker? Hvis du trækker dig, starter du i bunden ved ny tilmelding."
  - Bekræft-knap: "Ja, træk mig og bliv fan"
  - Annuller-knap: "Nej, fortryd"
- For **fans**: behold eksisterende "Stop med at følge"-knap (uændret)

**3. Handler** `handleUnenrollAndBecomeFan`:
- Kalder den nye mutation
- Toast: "Du er nu fan og kan følge med! 👀"

Ingen database- eller skemaændringer nødvendige.

