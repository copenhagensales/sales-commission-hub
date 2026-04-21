

## Sejer kan ikke redigere vagtplan / give medarbejder fri — analyse + fix

### Hvad jeg fandt

Sejer Sylvester Schmidt har position **"Assisterende Teamleder TM"** (system_role_key `assisterendetm`) og er **assistent på Eesy TM** via `team_assistant_leaders`-junctiontabellen.

Hans permissions er fine på alle niveauer:
- ✅ `menu_shift_overview` — view + edit (scope: all)
- ✅ `menu_absence` — view + edit (scope: team)
- ✅ `menu_employees` — view + edit (scope: team)
- ✅ RLS på `shift`/`employee_standard_shifts` tillader ham at skrive (`is_teamleder_or_above` returnerer true for ham via `system_roles.role='teamleder'` + `job_title`-fallback)

**Rodårsagen** ligger i `useEmployeesForShifts`-hooken (`src/hooks/useShiftPlanning.ts` linje 706-709), som henter medarbejdere fra de teams brugeren leder:

```ts
.from("teams")
.select("id, name")
.or(`team_leader_id.eq.${currentEmployeeId},assistant_team_leader_id.eq.${currentEmployeeId}`)
```

Denne query bruger den **deprecated `assistant_team_leader_id`-kolonne** på `teams`-tabellen. Vi migrerede for længe siden til many-to-many via `team_assistant_leaders`-junctionen (jvf. memory `Team Assistant Structure`). Sejer er KUN assistent via junctionen — `teams.assistant_team_leader_id` er NULL for hans team.

**Resultat:** `ledTeams.length === 0` → falder ned i `manager_id`-fallback (linje 734-741) → ingen matcher → **tom medarbejderliste**. Derfor:
- "Meld syg"-dialogen viser ingen medarbejdere at vælge
- Vagtplan-oversigten viser ingen at planlægge vagter for
- Han kan ikke give fri / oprette vagter for sit team

`AbsenceManagement.tsx` (linje 76-79) har allerede den rigtige logik (læser fra junction). Det er kun denne ene hook der halter bagud.

### Fix

I `src/hooks/useShiftPlanning.ts` linje ~706-715: erstat `OR`-query'en med samme mønster som `AbsenceManagement.tsx` bruger:

1. Hent teams hvor `team_leader_id = currentEmployeeId`
2. Hent team_ids fra `team_assistant_leaders` hvor `employee_id = currentEmployeeId`
3. Union de to lister, dedup, fortsæt som før

Pseudokode:

```ts
const [{ data: leaderTeams }, { data: assistantTeams }] = await Promise.all([
  supabase.from("teams").select("id, name").eq("team_leader_id", currentEmployeeId),
  supabase.from("team_assistant_leaders")
    .select("team_id, team:teams(id, name)")
    .eq("employee_id", currentEmployeeId),
]);
const ledTeamIds = [
  ...new Set([
    ...(leaderTeams?.map(t => t.id) || []),
    ...(assistantTeams?.map(a => a.team_id) || []),
  ]),
];
```

Resten af blokken (hent team_members, dedup, exclude self, fetch employees) er uændret.

### Filer der ændres
- `src/hooks/useShiftPlanning.ts` (kun den ene `.or(...)`-query inde i `useEmployeesForShifts`)

### Verificering
- Sejer åbner `/shift-planning` eller `/shift-planning/absence` → ser sit Eesy TM-team's medarbejdere
- "Meld syg"-knappen viser dropdown med Eesy TM-medarbejdere
- Han kan oprette/slette vagter og fravær for dem
- Console-log `[useEmployeesForShifts] Led teams (leader or assistant):` viser nu Eesy TM

### Hvad jeg IKKE rører
- RLS, system_roles, position_permissions (alt er korrekt)
- `assistant_team_leader_id`-kolonnen (lader den ligge — udfases separat)
- Andre hooks der allerede bruger junctionen korrekt (`AbsenceManagement`, `useTeamAssistantLeaders` m.fl.)
- Owner/teamleder-stierne i samme hook (uændrede)

