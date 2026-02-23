

## Problem: Manglende team-tags i CS Top 20

### Analyse

Medarbejdere som Sandra R., Melissa C., Noa R., Nora K., Oscar J., Martina C., Theo E., Laila S., og Lucas S. mangler team-tags fordi leaderboard-beregningen ikke kan koble deres salg til deres medarbejderprofiler.

### Koblingsproblemet (steg for steg)

Salg kommer ind fra dialeren med en `agent_email` (f.eks. `saro@copenhagensales.dk`). For at vise team-tags skal systemet finde medarbejderen via denne kæde:

```text
sales.agent_email
   --> agents.email (opslag)
      --> employee_agent_mapping.agent_id (kobling)
         --> employee_master_data.id (medarbejder)
            --> team_members.employee_id (team)
```

For de berørte medarbejdere fejler kæden allerede i det allerførste trin: **der findes ingen `agents`-record** med deres email. Dermed er `employeeId` tom, og `teamName` bliver `null`.

De berørte medarbejdere er primært fra **Fieldmarketing**-teamet, men problemet gælder alle medarbejdere uden agent-records.

### Løsning

Tilføj en **direkte fallback** i leaderboard-beregningen (`calculate-kpi-values`), som matcher `agent_email` direkte mod `employee_master_data.work_email`, hvis den normale agent-mapping-kæde ikke finder en medarbejder.

### Tekniske ændringer

**Fil: `supabase/functions/calculate-kpi-values/index.ts`**

I `calculateGlobalLeaderboard`-funktionen (ca. linje 1165-1172), efter at `emailToEmployeeId`-mappet er bygget fra agent-kæden, tilføjes et ekstra fallback-opslag:

1. Hent alle `employee_master_data` records med `work_email` (allerede tilgængelig i `employeeMap`, men ikke indexeret på email).
2. Byg et `workEmailToEmployeeId` map fra `work_email -> employee_id`.
3. I konverteringsloopet (linje 1238-1259), når `emailToEmployeeId.get(agentKey)` returnerer tomt, prøv `workEmailToEmployeeId.get(agentKey)` som fallback.

Konkret:

- Tilføj en query til `employee_master_data` for `id, work_email` (eller genbruge eksisterende employees-data ved at tilføje `work_email` til selectet i linje 803).
- Byg `workEmailToEmployeeId: Map<string, string>` fra work_email (lowercased) -> employee id.
- I linje 1242, ændr til: `const employeeId = emailToEmployeeId.get(agentKey) || workEmailToEmployeeId.get(agentKey) || ""`.

**Fil: `supabase/functions/calculate-kpi-values/index.ts`** (linje ~801-804)

Udvid employee-queryen til også at hente `work_email`:
```typescript
.select("id, first_name, last_name, avatar_url, work_email")
```

Byg et ekstra map efter employeeMap:
```typescript
const workEmailToEmployeeId = new Map<string, string>();
(employees || []).forEach(emp => {
  if (emp.work_email) {
    workEmailToEmployeeId.set(emp.work_email.toLowerCase(), emp.id);
  }
});
```

Send dette map med til `calculateGlobalLeaderboard` og brug det som fallback.

### Samme fix i `calculateTeamLeaderboard`

Anvend samme fallback-logik i team-leaderboard-funktionen, så team-scoped dashboards også korrekt matcher medarbejdere.

### Samme fix i RPC-funktionen

Opdater `get_cs_top20_custom_period_leaderboard` SQL-funktionen til at bruge et lignende fallback: join `employee_master_data` via `work_email` når agent-mapping ikke matcher.

### Resultat

Alle medarbejdere med salg vil få korrekt `employeeId`, `teamName`, og `avatarUrl` i leaderboardet -- uanset om de har en agent-mapping eller ej.

