

# Plan: Medarbejder-specifik timeberegning for stab

## Overblik

Opdater `useStaffHoursCalculation` så den understøtter individuel `hours_source` per stab-medarbejder og korrekt håndterer sygdom som betalt arbejdstid.

## Forretningsregler

| Medarbejder | Timeløn | hours_source | Ferie/Fri | Sygdom |
|-------------|---------|--------------|-----------|--------|
| Jeppe Buster Munk | 200 kr | `shift` | 0 kr | Normal løn (som planlagt vagt) |
| Alfred Rud | 160 kr | `timestamp` | 0 kr | 0 kr (medmindre indstemplet) |
| William Hoé Seiding | 190 kr | `timestamp` | 0 kr | 0 kr (medmindre indstemplet) |

---

## Tekniske ændringer

### 1. Database-migration

Tilføj `hours_source` kolonne til `personnel_salaries` tabellen:

```sql
ALTER TABLE personnel_salaries 
ADD COLUMN hours_source TEXT DEFAULT 'shift' 
CHECK (hours_source IN ('shift', 'timestamp'));

-- Sæt Alfred Rud og William Hoé til 'timestamp'
UPDATE personnel_salaries 
SET hours_source = 'timestamp' 
WHERE employee_id IN (
  'f66edb4c-7649-4617-94a3-ba02b7aea02f',  -- Alfred Rud
  '712e71af-bcc4-4988-b525-2d32f53b69b1'   -- William Hoé Seiding
);

-- Jeppe Buster forbliver 'shift' (default)
```

### 2. Opdater useStaffHoursCalculation.ts

**Ændring 1 - Hent hours_source fra personnel_salaries (linje 37-41):**

```typescript
// FØR:
const { data: salaries } = await supabase
  .from("personnel_salaries")
  .select("employee_id, monthly_salary, hourly_rate")
  .eq("salary_type", "staff")
  .eq("is_active", true)
  .in("employee_id", staffIds);

// EFTER:
const { data: salaries } = await supabase
  .from("personnel_salaries")
  .select("employee_id, monthly_salary, hourly_rate, hours_source")
  .eq("salary_type", "staff")
  .eq("is_active", true)
  .in("employee_id", staffIds);
```

**Ændring 2 - Hent team via team_members (linje 43-49):**

```typescript
// FØR:
const { data: employees } = await supabase
  .from("employee_master_data")
  .select("id, team_id")
  .in("id", staffIds);

const teamIds = [...new Set(employees?.map(e => e.team_id).filter(Boolean))] as string[];

// EFTER:
const { data: teamMemberships } = await supabase
  .from("team_members")
  .select("employee_id, team_id")
  .in("employee_id", staffIds);

const employeeTeamMap = new Map<string, string>();
for (const tm of teamMemberships || []) {
  employeeTeamMap.set(tm.employee_id, tm.team_id);
}

const teamIds = [...new Set(
  (teamMemberships || []).map(tm => tm.team_id).filter(Boolean)
)] as string[];
```

**Ændring 3 - Hent absences med type (linje 84-90):**

```typescript
// FØR:
const { data: absences } = await supabase
  .from("absence_request_v2")
  .select("employee_id, start_date, end_date, is_full_day")
  ...

// EFTER:
const { data: absences } = await supabase
  .from("absence_request_v2")
  .select("employee_id, start_date, end_date, is_full_day, type")
  ...
```

**Ændring 4 - Hent time_stamps (ny query efter absences):**

```typescript
// NY QUERY - Hent faktiske stemplinger
const { data: timeStamps } = await supabase
  .from("time_stamps")
  .select("employee_id, clock_in, clock_out, break_minutes")
  .in("employee_id", staffIds)
  .gte("clock_in", format(periodStart, "yyyy-MM-dd") + "T00:00:00")
  .lte("clock_in", format(periodEnd, "yyyy-MM-dd") + "T23:59:59");
```

**Ændring 5 - Opdater absence map til at inkludere type:**

```typescript
// FØR:
const absenceDates = new Set<string>();
for (const absence of empAbsences) {
  ...
  for (const day of days) {
    absenceDates.add(format(day, "yyyy-MM-dd"));
  }
}

// EFTER:
const absenceDateMap = new Map<string, { type: string }>();
for (const absence of empAbsences) {
  const start = new Date(absence.start_date);
  const end = new Date(absence.end_date);
  const days = eachDayOfInterval({ start, end });
  for (const day of days) {
    absenceDateMap.set(format(day, "yyyy-MM-dd"), { type: absence.type });
  }
}
```

**Ændring 6 - Hovedlogik for timer-beregning:**

```typescript
const hoursSource = salary?.hours_source || 'shift';
let totalHours = 0;

if (hoursSource === 'timestamp') {
  // === ALFRED RUD / WILLIAM HOÉ: Brug faktiske stemplinger ===
  const empTimeStamps = (timeStamps || []).filter(ts => ts.employee_id === staffId);
  
  for (const ts of empTimeStamps) {
    if (ts.clock_in && ts.clock_out) {
      const clockIn = new Date(ts.clock_in);
      const clockOut = new Date(ts.clock_out);
      
      const totalMinutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
      const breakMins = ts.break_minutes || 0;
      const netMinutes = Math.max(0, totalMinutes - breakMins);
      
      totalHours += Math.round((netMinutes / 60) * 100) / 100;
    }
  }
} else {
  // === JEPPE BUSTER: Brug planlagte vagter ===
  const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd });

  for (const day of daysInPeriod) {
    const dateStr = format(day, "yyyy-MM-dd");
    const jsWeekday = getDay(day);
    
    const absenceInfo = absenceDateMap.get(dateStr);
    
    // Ferie/fri/no_show = 0 timer
    if (absenceInfo && absenceInfo.type !== 'sick') {
      continue;
    }
    
    // Find planlagt vagt for denne dag
    let scheduledHours = 0;
    
    if (individualShiftMap.has(dateStr)) {
      const shift = individualShiftMap.get(dateStr)!;
      scheduledHours = calculateHoursFromShift(shift.start, shift.end);
    } else if (empShiftDays) {
      const dayShift = empShiftDays.find(d => d.dayOfWeek === jsWeekday);
      if (dayShift) {
        scheduledHours = calculateHoursFromShift(dayShift.startTime, dayShift.endTime);
      }
    } else if (teamShiftDays) {
      const dayShift = teamShiftDays.find(d => d.dayOfWeek === jsWeekday);
      if (dayShift) {
        scheduledHours = calculateHoursFromShift(dayShift.startTime, dayShift.endTime);
      }
    }
    
    // Sygdom = normal løn (som om planlagt vagt)
    // Ingen fravær = normal løn
    if (scheduledHours > 0) {
      totalHours += scheduledHours;
    }
  }
}
```

---

## Forventet resultat (denne uge: 2-8. februar)

### Med `hours_source = 'shift'` (Jeppe Buster):
- Mandag-fredag: 5 dage × 7 timer = 35 timer
- Løn: 35 × 200 kr = 7.000 kr
- Feriepenge: 7.000 × 12,5% = 875 kr
- **Total: 7.875 kr**

### Med `hours_source = 'timestamp'` (Alfred Rud):
- Faktiske stemplinger: ~15,3 timer (fra database)
- Løn: 15,3 × 160 kr = 2.448 kr
- Feriepenge: 2.448 × 12,5% = 306 kr
- **Total: ~2.754 kr**

### Med `hours_source = 'timestamp'` (William Hoé):
- Ingen stemplinger denne uge = 0 timer
- **Total: 0 kr**

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| Database migration | Tilføj `hours_source` kolonne til `personnel_salaries` |
| `src/hooks/useStaffHoursCalculation.ts` | Tilføj logik for `timestamp` vs `shift`, sygdoms-håndtering |

---

## Test-scenarier

1. Vælg "Denne uge" → Jeppe får 7.875 kr (fra vagtplan)
2. Vælg "Denne uge" → Alfred får ~2.754 kr (fra indstemplinger)
3. Tilføj sygdom for Jeppe → Han får stadig normal løn
4. Tilføj ferie for Jeppe → 0 kr for den dag

