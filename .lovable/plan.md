

# Plan: Opdater ClientDBTab til at bruge junction-tabellen for flere assistenter

## Problembeskrivelse

`ClientDBTab.tsx` blev ikke opdateret da vi implementerede understøttelse af flere assisterende teamledere. Komponenten bruger stadig den gamle `teams.assistant_team_leader_id` kolonne, som kun understøtter én assistent.

**Status i databasen:**
- TDC Erhverv har nu **to** assistenter i junction-tabellen:
  - Jeppe Buster Munk
  - Johannes Hedebrink

**Status i koden:**
- `ClientDBTab` henter kun `assistant_team_leader_id` fra `teams` tabellen
- Kun én assistent beregnes per team
- Jeppe Munks løn medregnes ikke i rapporten

---

## Ændringer

### 1. Import hook til junction-data

Tilføj import af `useTeamAssistantLeaders` og hjælpefunktioner:

```typescript
import { useTeamAssistantLeaders, getTeamAssistantIds, getAllAssistantIds } from "@/hooks/useTeamAssistantLeaders";
```

---

### 2. Hent junction-data

Tilføj query til at hente alle team-assistent-relationer:

```typescript
const { data: teamAssistants = [] } = useTeamAssistantLeaders();
```

---

### 3. Opdater allAssistantIds til at bruge junction-tabellen

**Fra:**
```typescript
const allAssistantIds = useMemo(() => {
  if (!teamSalaries) return [];
  return Object.values(teamSalaries)
    .map(ts => ts.assistantId)
    .filter(Boolean) as string[];
}, [teamSalaries]);
```

**Til:**
```typescript
const allAssistantIds = useMemo(() => {
  return getAllAssistantIds(teamAssistants);
}, [teamAssistants]);
```

---

### 4. Opdater beregning af assistentløn per team

**Fra:** (linje 603-606)
```typescript
const assistantId = teamInfo.assistantId;
const assistantData = assistantId && assistantHoursData ? assistantHoursData[assistantId] : null;
const totalAssistantSalary = assistantData?.totalSalary || 0;
```

**Til:**
```typescript
// Get all assistant IDs for this team from junction table
const teamAssistantIds = getTeamAssistantIds(teamAssistants, teamId);
// Sum salary for all assistants
let totalAssistantSalary = 0;
for (const aId of teamAssistantIds) {
  const assistantData = assistantHoursData ? assistantHoursData[aId] : null;
  totalAssistantSalary += assistantData?.totalSalary || 0;
}
```

---

### 5. Opdater TeamSalaryInfo interface

Fjern `assistantId` da det nu hentes fra junction-tabellen:

```typescript
interface TeamSalaryInfo {
  teamId: string;
  percentageRate: number;
  minimumSalary: number;
  // assistantId fjernes - hentes nu fra junction-tabellen
}
```

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/components/salary/ClientDBTab.tsx` | Opdater til at bruge junction-tabel |

---

## Forventet resultat

Efter implementering vil:
- Både Jeppe Munk og Johannes Hedebrink indgå i assistentløn for TDC Erhverv
- "Assist.løn" kolonnen vil vise den samlede assistentomkostning for begge
- Korrekt fordeling af assistentløn på tværs af klienter baseret på omsætningsandel

