
# Fix: Inkluder stoppede medarbejdere i Onboarding Analyse

## Problem
Deaktiverede medarbejdere fjernes fra `team_members`-tabellen, så de får team "Ukendt" → filtreres væk af `EXCLUDED_TEAMS`. Resultatet er at kun aktive medarbejdere vises.

## Løsning
I `OnboardingAnalyse.tsx` queryFn:

1. **Byg et navn→team lookup fra `historical_employment`** — dette har team-data for alle stoppede medarbejdere.
2. **For `employee_master_data`-records uden team i `team_members`**: Slå op i historical_employment-data via navn-match for at finde korrekt team.
3. Prioritet: `team_members` → `historical_employment` match → "Ukendt"

## Fil der ændres
- `src/pages/OnboardingAnalyse.tsx` — Udvid team-resolution logik i queryFn (~10 linjer ændring)
