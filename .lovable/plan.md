

# Plan: Tilføj understøttelse af flere assisterende teamledere

## Oversigt

Denne opgave udvider den nuværende team-struktur til at understøtte flere assisterende teamledere pr. team. I dag kan hvert team kun have én assisterende teamleder (via `assistant_team_leader_id` kolonnen i `teams` tabellen). Med denne ændring kan et team have mange assistenter, og hver assistent kan potentielt være på flere teams.

## Nuværende arkitektur

```text
+------------------+
|      teams       |
+------------------+
| id               |
| name             |
| team_leader_id   |    --> 1 teamleder pr. team
| assistant_...id  |    --> 1 assistent pr. team (BEGRÆNSNING)
+------------------+
```

## Ny arkitektur

```text
+------------------+         +------------------------+         +------------------+
|      teams       |         | team_assistant_leaders |         | employee_master  |
+------------------+         +------------------------+         +------------------+
| id               |<--------| team_id                |-------->| id               |
| name             |         | employee_id            |         | first_name       |
| team_leader_id   |         | created_at             |         | last_name        |
| (assistant...id) |         +------------------------+         +------------------+
+------------------+              Many-to-many
```

## Ændringer

### 1. Database-ændringer

**Ny junction-tabel: `team_assistant_leaders`**
- `team_id` (uuid, FK → teams)
- `employee_id` (uuid, FK → employee_master_data)
- `created_at` (timestamp)
- Primary key: (team_id, employee_id)

**Migrering af eksisterende data**
- Alle eksisterende `assistant_team_leader_id` værdier kopieres til den nye junction-tabel

**Bevar kompatibilitet**
- `teams.assistant_team_leader_id` kolonnen beholdes midlertidigt for at undgå at bryde eksisterende kode
- Den markeres som deprecated og kan fjernes i en fremtidig migration

---

### 2. UI-ændringer i TeamsTab.tsx

**Nuværende:**
- Enkelt Select dropdown til "Ass. Teamleder"

**Ny:**
- Multi-select chip-baseret UI
- Viser alle valgte assistenter som badges med X-knap til fjernelse
- Tilføj-knap åbner dropdown til at tilføje flere

---

### 3. Opdatering af berørte komponenter og hooks

| Fil | Ændring |
|-----|---------|
| `TeamsTab.tsx` | Multi-select UI for assistenter |
| `DBOverviewTab.tsx` | Summér løn fra alle assistenter |
| `ClientDBTab.tsx` | Hent alle assistant IDs fra junction |
| `useAssistantHoursCalculation.ts` | Understøt flere assistenter pr. team |
| `AbsenceManagement.tsx` | Tjek om bruger er assistent via junction |
| `DailyReports.tsx` | Tjek team-adgang via junction |
| `EmployeeMasterData.tsx` | Hent alle team-assistenter |
| `ClosingShifts.tsx` | Inkluder alle assistenter |

---

## Tekniske detaljer

### Database migration SQL

```sql
-- 1. Opret ny junction-tabel
CREATE TABLE public.team_assistant_leaders (
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employee_master_data(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (team_id, employee_id)
);

-- 2. Migrér eksisterende data
INSERT INTO public.team_assistant_leaders (team_id, employee_id)
SELECT id, assistant_team_leader_id
FROM public.teams
WHERE assistant_team_leader_id IS NOT NULL;

-- 3. Aktiver RLS
ALTER TABLE public.team_assistant_leaders ENABLE ROW LEVEL SECURITY;

-- 4. RLS policies
CREATE POLICY "Authenticated users can read" 
  ON public.team_assistant_leaders FOR SELECT 
  TO authenticated USING (true);

CREATE POLICY "Team managers can modify"
  ON public.team_assistant_leaders FOR ALL
  TO authenticated USING (public.has_edit_permission('tab_employees_teams'));
```

### Frontend formData struktur

```typescript
// Fra:
formData = {
  assistant_team_leader_id: string
}

// Til:
formData = {
  assistant_team_leader_ids: string[]
}
```

### Hooks/queries opdateringer

```typescript
// Fra: 
const assistantIds = teams.map(t => t.assistant_team_leader_id).filter(Boolean);

// Til:
const { data: teamAssistants } = useQuery({
  queryKey: ["team-assistant-leaders"],
  queryFn: async () => {
    const { data } = await supabase.from("team_assistant_leaders").select("*");
    return data;
  }
});
const assistantIds = [...new Set(teamAssistants?.map(ta => ta.employee_id) || [])];
```

---

## Implementeringsrækkefølge

1. **Database migration** - Opret junction-tabel med RLS
2. **Data migration** - Flyt eksisterende assistant-data
3. **TeamsTab.tsx** - Ny multi-select UI + CRUD
4. **Hooks** - Opdater alle hooks der bruger assistant IDs
5. **Rapporter** - Opdater DBOverviewTab og ClientDBTab
6. **Adgangskontrol** - Opdater AbsenceManagement og DailyReports
7. **Test** - Verificer at alle flows virker

