

## Fix: Inaktive medarbejdere vises ikke i dagsrapporter

### Problem

Inaktive medarbejdere som Jolie har `is_active = false` og er fjernet fra `team_members`-tabellen (`team_id = null`, ingen rækker i `team_members`). Når der filtreres på "Inaktive" + et specifikt team, falder de ud fordi:

1. **Team-filter** (linje 415-418): Filtrerer på `team_members`, men inaktive har ingen `team_members`-rækker.
2. **Klient-specifik logik** (linje 399-410): Samme problem - henter `team_members(team:teams(id, name))` som er tom for inaktive.

Alle inaktive medarbejdere i databasen har `team_id = null` men mange har `last_team_id` sat (Jolies er `900fc72c`), som kan bruges som fallback.

### Loesning

Brug `last_team_id` som fallback for team-filtrering af inaktive medarbejdere.

### Teknisk aendring

**Fil:** `src/pages/reports/DailyReports.tsx`

**Aendring 1** -- I klient-specifik medarbejder-fetch (linje 399-401), inkluder `last_team_id`:

```typescript
let empQuery = supabase
  .from("employee_master_data")
  .select(`id, first_name, last_name, last_team_id, team_members(team:teams(id, name))`)
  .in("id", employeeIds);
```

**Aendring 2** -- I team-filteret (linje 415-418), brug `last_team_id` som fallback:

```typescript
if (selectedTeam !== "all") {
  filteredEmployees = filteredEmployees.filter(emp => 
    emp.team_members?.some((tm: any) => tm.team?.id === selectedTeam)
    || emp.last_team_id === selectedTeam
  );
}
```

**Aendring 3** -- I den generelle medarbejder-fetch (linje 428-434), inkluder ogsaa `last_team_id`:

```typescript
let employeeQuery = supabase
  .from("employee_master_data")
  .select(`
    id,
    first_name,
    last_name,
    last_team_id,
    team_members(team:teams(id, name))
  `)
```

**Aendring 4** -- I den generelle team-filtrering (ca. linje 450-460), tilfoej samme `last_team_id` fallback for team-matchning.

### Filer der aendres

| Fil | Aendring |
|---|---|
| `src/pages/reports/DailyReports.tsx` | Tilfoej `last_team_id` i queries og brug som fallback i team-filtre |

### Resultat

Inaktive medarbejdere som Jolie vil nu dukke op under deres sidste team naar man vaelger "Inaktive" eller "Alle" i dagsrapporten.
