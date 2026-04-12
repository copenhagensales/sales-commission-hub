

## Fix: Forsinkelser kan ikke registreres

### Problem
I `handleSetLateness` (linje 931-932) hentes medarbejderens planlagte starttid via `getWorkTimesForEmployeeAndDay()`. Denne funktion kan returnere sentinelværdien `"__NO_SPECIAL_SHIFT__"` (når medarbejderen ikke har en special-vagt og bruger team-standard eller personlig standard_start_time).

Problemet er at `handleSetLateness` **ikke** håndterer denne sentinelværdi:

```typescript
const workTimes = getWorkTimesForEmployeeAndDay(employeeId, date);
const startTime = workTimes ? workTimes.split('-')[0].trim() : "08:00";
```

Når `workTimes` er `"__NO_SPECIAL_SHIFT__"`, er den truthy, og `.split('-')` giver `["__NO_SPECIAL_SHIFT__"]` som starttid. Derefter i `handleDelaySubmit` giver `originalStartTime.split(':').map(Number)` → `NaN`, og `delayMinutes` bliver `NaN`, så `delayMinutes <= 0` evaluerer til `false`, og upsert'en fejler med ugyldig data.

Renderings-koden (linje 1366-1369) håndterer dette korrekt ved at falde tilbage til `employee.standard_start_time`, men forsinkelsesregistreringen gør det ikke.

### Løsning

Ret `handleSetLateness` (linje 931-932) til at håndtere `NO_SPECIAL_SHIFT` sentinelen og falde tilbage til medarbejderens `standard_start_time`:

```typescript
const rawWorkTimes = getWorkTimesForEmployeeAndDay(employeeId, date);
const employee = employees?.find(e => e.id === employeeId);
const workTimes = rawWorkTimes === NO_SPECIAL_SHIFT 
  ? employee?.standard_start_time 
  : rawWorkTimes;
const startTime = workTimes ? workTimes.split('-')[0].trim() : "08:00";
```

### Fil der ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/shift-planning/ShiftOverview.tsx` | Ret `handleSetLateness` til at håndtere `NO_SPECIAL_SHIFT` fallback (linje 931-932) |

### Resultat
Forsinkelser kan registreres korrekt for alle medarbejdere, uanset om de har en special-vagt, team-vagt, eller kun en personlig standard-mødetid.

