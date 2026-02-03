

## Problem: Karl Kan Se Alle Teams i Dagssedler

### Årsag

Karl Koppel er **Teamleder for "Relatel"** teamet og hans permission `menu_reports_daily` har `visibility: team`, men **DailyReports.tsx implementerer IKKE team-baseret filtrering**.

**Beviser fra database:**
- Karl er teamleder for: **Relatel**
- Hans permission: `menu_reports_daily` → `visibility: team`
- Men koden henter ALLE teams uden filtrering

**Teknisk årsag:**
1. `PERMISSION_SCOPE_MAP` i `usePositionPermissions.ts` mangler mapping for `menu_reports_daily`
2. `DailyReports.tsx` importerer IKKE `usePermissions` og bruger ikke scope-baseret filtrering
3. Team-dropdown viser alle teams i stedet for kun brugerens egne teams

### Løsningsplan

#### Trin 1: Tilføj scope mapping for reports
**Fil:** `src/hooks/usePositionPermissions.ts`

Tilføj i `PERMISSION_SCOPE_MAP`:
```typescript
'menu_reports_daily': 'scope_reports_daily',
```

Tilføj helper i `usePermissions()`:
```typescript
scopeReportsDaily: getDataScope("scope_reports_daily"),
```

#### Trin 2: Implementer team-filtrering i DailyReports
**Fil:** `src/pages/reports/DailyReports.tsx`

Ændringer:
1. Importer `usePermissions` og `useCurrentEmployee` hooks
2. Hent `scopeReportsDaily` fra usePermissions
3. Hvis scope = "team":
   - Find teams hvor bruger er team_leader eller assistant_team_leader
   - Filtrer team-dropdown til kun at vise disse teams
   - Filtrer medarbejdere til kun at vise teammedlemmer
4. Hvis scope = "alt" → vis alt (ejere, admins)
5. Hvis scope = "egen" → vis kun egne data

#### Trin 3: Pre-select brugerens team
Når scope = "team", sæt automatisk `selectedTeam` til brugerens primære team i stedet for "all".

---

## Tekniske Detaljer

### Nuværende kode (linje 188-198):
```typescript
// Fetch teams - NO FILTERING
const { data: teams = [] } = useQuery({
  queryKey: ["daily-report-teams"],
  queryFn: async () => {
    const { data } = await supabase
      .from("teams")
      .select("id, name")
      .order("name");
    return data || [];
  },
});
```

### Ny kode med team-filtrering:
```typescript
import { usePermissions } from "@/hooks/usePositionPermissions";
import { useCurrentEmployee } from "@/hooks/useShiftPlanning";

// Inside component:
const { scopeReportsDaily } = usePermissions();
const { data: currentEmployee } = useCurrentEmployee();

// Fetch user's led teams (for scope = "team")
const { data: ledTeamIds = [] } = useQuery({
  queryKey: ["daily-report-led-teams", currentEmployee?.id],
  queryFn: async () => {
    if (!currentEmployee?.id) return [];
    const { data } = await supabase
      .from("teams")
      .select("id")
      .or(`team_leader_id.eq.${currentEmployee.id},assistant_team_leader_id.eq.${currentEmployee.id}`);
    return data?.map(t => t.id) || [];
  },
  enabled: !!currentEmployee?.id && scopeReportsDaily === "team",
});

// Filter teams based on scope
const availableTeams = useMemo(() => {
  if (scopeReportsDaily === "alt") return teams; // Owner sees all
  if (scopeReportsDaily === "team") return teams.filter(t => ledTeamIds.includes(t.id));
  return []; // "egen" = only self, no teams
}, [teams, scopeReportsDaily, ledTeamIds]);
```

### Filer der ændres:
1. `src/hooks/usePositionPermissions.ts` - Tilføj scope mapping
2. `src/pages/reports/DailyReports.tsx` - Implementer team-filtrering

### Forventet resultat:
- Karl (Teamleder) kan kun se Relatel i team-dropdown
- Karl kan kun se medarbejdere fra Relatel
- Ejere kan fortsat se alle teams
- Andre roller følger deres konfigurerede visibility

