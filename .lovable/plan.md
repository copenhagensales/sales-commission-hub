

## Filtrér medarbejdere i vagtplanen baseret på start- og stopdato

### Problem
Vagtplanen viser alle aktive medarbejdere, uanset om de er startet endnu. Derudover forsvinder inaktive medarbejdere med det samme, selvom de burde være synlige indtil deres stopdato (`employment_end_date`).

### Hvad ændres

**Fil: `src/hooks/useShiftPlanning.ts` - `useEmployeesForShifts` hook**

Ændringen sker i den centrale hook der henter medarbejdere til vagtplanen. I stedet for kun at filtrere på `is_active = true`, ændres logikken til:

1. **Hent bredere**: Fjern den hårde `is_active = true` filter fra alle Supabase-queries i hooket (3 steder: `fetchEmployeesByIds`, manager fallback, og owner mode)
2. **Tilføj `employment_start_date` og `employment_end_date`** til select-felterne
3. **Filtrer i koden** efter hentning med denne logik:
   - **Skjul** medarbejdere hvor `employment_start_date` er i fremtiden (ikke startet endnu)
   - **Vis** inaktive medarbejdere (`is_active = false`) så længe `employment_end_date` er i dag eller i fremtiden
   - **Skjul** inaktive medarbejdere hvor `employment_end_date` er i fortiden (eller ikke sat)
   - **Vis** aktive medarbejdere der allerede er startet (normal case)

### Tekniske detaljer

Pseudo-logik for filtreringen:

```text
const today = new Date() // dagens dato

employees.filter(emp => {
  // 1. Hvis medarbejder ikke er startet endnu -> skjul
  if (emp.employment_start_date && parseISO(emp.employment_start_date) > today) {
    return false
  }

  // 2. Hvis aktiv -> vis
  if (emp.is_active) return true

  // 3. Hvis inaktiv men har employment_end_date >= i dag -> vis
  if (!emp.is_active && emp.employment_end_date) {
    return parseISO(emp.employment_end_date) >= today
  }

  // 4. Inaktiv uden stopdato -> skjul
  return false
})
```

Ændringen gælder alle 3 query-paths i hooket:
- `fetchEmployeesByIds` (bruges ved team-filter og led-teams)
- Manager fallback query
- Owner mode query

Select-felterne udvides fra:
`"id, first_name, last_name, standard_start_time, weekly_hours, manager_id, salary_type, salary_amount, team_id"`
til:
`"id, first_name, last_name, standard_start_time, weekly_hours, manager_id, salary_type, salary_amount, team_id, is_active, employment_start_date, employment_end_date"`

