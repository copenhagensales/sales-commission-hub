

# Onboarding Churn Analyse — per-team breakdown med navne

## Oversigt
Ny side `/onboarding-analyse` der viser en detaljeret per-team og per-måned churn-analyse med individuelle navne, så ledelsen kan tracke forbedringer over tid.

## Datakilder (eksisterende)
- `historical_employment` — stoppede medarbejdere med `employee_name`, `team_name`, `start_date`, `end_date`, `tenure_days`
- `employee_master_data` — aktive/inaktive med `first_name`, `last_name`, `employment_start_date`, `employment_end_date`
- `team_members` + `teams` — team-tilknytning

Ingen database-ændringer nødvendige.

## Ny side: `src/pages/OnboardingAnalyse.tsx`

### Layout
1. **KPI-kort øverst** — Samlet 60-dages churn, antal starter denne måned, aktuel retention rate
2. **Månedsfilter** — Vælg tidsperiode (default: seneste 6 måneder)
3. **Per-team breakdown tabel**:
   - Team | Kohorte-størrelse | Stoppet ≤60d | Churn% | Trend-ikon
   - Expanderbar række → viser individuelle navne:
     - Navn | Startdato | Slutdato | Ansættelsesdage | Status (stoppet/aktiv)
4. **Per-måned kohorte-tabel**:
   - Måned | Starter | Stoppet ≤60d | Churn% | Navne på stoppede

### Funktionalitet
- Genbruger `normalizeTeamName` og `EXCLUDED_TEAMS` fra eksisterende kode
- Henter data med React Query (samme mønster som `NewHireChurnKpi`)
- Collapsible team-rækker via Radix Collapsible
- Farvekodet churn-rate (grøn/gul/rød)
- Sortérbar efter churn%

## Filer der ændres/oprettes
1. **Ny:** `src/pages/OnboardingAnalyse.tsx` — Hovedside
2. **Ændring:** `src/routes/pages.ts` — Tilføj lazy import
3. **Ændring:** `src/routes/config.tsx` — Tilføj route (`/onboarding-analyse`, permission: `menu_contracts`)

