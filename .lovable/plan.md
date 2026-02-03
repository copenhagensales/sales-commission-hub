
## Problem: Karl kan stadig se alle teams i Dagssedler

### Identificerede årsager

Efter grundig undersøgelse har jeg fundet **3 sammenhængende problemer**:

#### Problem 1: LocalStorage Cache
Permissions caches i `localStorage` med nøglen `cached-permissions-v2` i 24 timer. Hvis Karl loggede ind før `scope_reports_daily` blev tilføjet til mappingen, vil hans cache stadig indeholde de gamle permissions **uden** `scope_reports_daily`.

#### Problem 2: "Alle" option vises altid
I team-dropdown (linje 1112) vises "Alle" som første option **uanset brugerens scope**:
```jsx
<SelectItem value="all">Alle</SelectItem>
{teams.map((team) => (...))}
```

Selvom `teams` listen er filtreret korrekt til kun at vise Karl's team (Relatel), kan han stadig vælge "Alle".

#### Problem 3: Data-hentning respekterer ikke scope
Når `selectedTeam === "all"` henter queryFn data for ALLE medarbejdere ufiltreret. Der er ingen server-side enforcement af scope.

---

### Løsningsplan

#### Trin 1: Bump cache-version
**Fil:** `src/hooks/usePositionPermissions.ts`

Ændre cache-nøgle fra `v2` til `v3` og tilføj den gamle version til cleanup-listen:
```typescript
const PERMISSIONS_CACHE_KEY = 'cached-permissions-v3';

// Force-clear old cache versions on load
try {
  localStorage.removeItem('cached-permissions-v1');
  localStorage.removeItem('cached-permissions-v2'); // NY!
} catch (e) {
  // Ignore errors
}
```

#### Trin 2: Skjul "Alle" option for team-scoped brugere
**Fil:** `src/pages/reports/DailyReports.tsx`

Kun vis "Alle" option for brugere med `scopeReportsDaily === "alt"`:
```jsx
<SelectContent>
  {scopeReportsDaily === "alt" && (
    <SelectItem value="all">Alle</SelectItem>
  )}
  {teams.map((team) => (
    <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
  ))}
</SelectContent>
```

#### Trin 3: Forbedret initial team-valg
Opdater useEffect til at håndtere edge cases:
```typescript
useEffect(() => {
  // For team-scoped users: pre-select their team
  if (scopeReportsDaily === "team" && teams.length > 0 && selectedTeam === "all") {
    setSelectedTeam(teams[0].id);
  }
  // For egen-scoped users: disable team selection entirely
  if (scopeReportsDaily === "egen" && selectedTeam !== "all") {
    setSelectedTeam("all"); // Will show only their own data
  }
}, [scopeReportsDaily, teams, selectedTeam]);
```

#### Trin 4: Tilføj scope-baseret data-filtrering
I report data query-funktionen (linje 296+), tilføj scope-check for at sikre server-side enforcement:
```typescript
// Apply scope restrictions to employee query
if (scopeReportsDaily === "team" && ledTeamIds.length > 0) {
  // Only fetch employees from user's led teams
  filteredEmployees = filteredEmployees.filter(emp =>
    emp.team_members?.some((tm: any) => ledTeamIds.includes(tm.team?.id))
  );
}
if (scopeReportsDaily === "egen" && currentEmployee?.id) {
  // Only fetch current user's data
  filteredEmployees = filteredEmployees.filter(emp => emp.id === currentEmployee.id);
}
```

---

### Tekniske detaljer

#### Filer der ændres:
1. `src/hooks/usePositionPermissions.ts` - Bump cache version til v3
2. `src/pages/reports/DailyReports.tsx` - Implementer komplet scope-filtrering

#### Database-bekræftelse:
- Karl's role_key: `teamleder`
- Karl's permission: `menu_reports_daily` → `visibility: team` ✓
- Karl's team: Relatel (team_id: `f4210d48-5062-4e3a-b945-7ff1d5a874dd`) ✓
- Karl er `team_leader_id` for Relatel ✓

#### Forventet resultat efter fix:
- Karl kan KUN se Relatel i team-dropdown (ingen "Alle" option)
- Karl kan KUN se medarbejdere fra Relatel
- Ejere kan stadig se alle teams og vælge "Alle"
- Cache opdateres automatisk for alle brugere ved næste login
