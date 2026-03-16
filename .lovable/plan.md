

## Liga Sæson Admin-interface

### Oversigt
Byg en ny "Sæsoner"-sektion i LeagueAdminDashboard, der giver admins mulighed for at se alle sæsoner, oprette nye, redigere datoer og skifte status.

### Ændringer

**1. Ny hook: `useAllSeasons`** i `src/hooks/useLeagueData.ts`
- Henter alle sæsoner fra `league_seasons` sorteret efter `season_number DESC`

**2. Ny hook: `useCreateSeason`** i `src/hooks/useLeagueData.ts`
- Mutation til at oprette ny sæson med auto-beregnet `season_number` (max + 1)
- Sætter status til `draft`, `is_active` til `false`

**3. Ny hook: `useUpdateSeasonStatus`** i `src/hooks/useLeagueData.ts`
- Mutation til at opdatere `status` felt (draft → qualification → active → completed)
- Når en sæson sættes til `active`, deaktivér evt. andre aktive sæsoner

**4. Ny komponent: `SeasonManagerCard`** i `src/components/league/SeasonManagerCard.tsx`
- Viser en tabel med alle sæsoner (sæsonnummer, status-badge, datoer, handlinger)
- "Opret ny sæson"-knap åbner dialog med datepickers for alle 6 datoer:
  - `qualification_source_start/end`
  - `qualification_start_at/end_at`
  - `start_date` / `end_date`
- Statusskift via Select-dropdown pr. sæson (draft/qualification/active/completed)
- Redigér-knap genbruger eksisterende `SeasonSettingsDialog` (udvid med start_date/end_date)

**5. Udvid `SeasonSettingsDialog`** i `src/components/league/SeasonSettingsDialog.tsx`
- Tilføj `start_date` og `end_date` felter
- Udvid `useUpdateSeasonDates` til at inkludere disse felter

**6. Integrér i `LeagueAdminDashboard.tsx`**
- Tilføj `SeasonManagerCard` under stats-sektionen (før deltagertabellen)
- Fjern "Ingen aktiv sæson"-blokeringen så dashboardet altid vises

### Tekniske detaljer
- Ingen databaseændringer nødvendige – tabellen har allerede alle felter
- Genbruger eksisterende Supabase-client og RLS-policies
- Calendar-komponenten skal have `pointer-events-auto` klasse (jf. projekt-knowledge)
- Status-badges: draft=secondary, qualification=default, active=green, completed=outline

