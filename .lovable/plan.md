

## Tilføj lønperiode-start per medarbejder på lønarter

### Problem
Når man tilknytter medarbejdere til en lønart, kan man ikke angive fra hvilken lønperiode den enkelte medarbejder skal starte.

### Ændringer

**1. Database migration**
Tilføj `effective_from` kolonne til `salary_type_employees`:
```sql
ALTER TABLE salary_type_employees ADD COLUMN effective_from date DEFAULT NULL;
```

**2. Fil: `src/components/salary/SalaryTypesTab.tsx`**

- **State**: Skift `selectedEmployeeIds: string[]` til `selectedEmployees: Record<string, string | null>` (employee_id -> effective_from dato eller null)
- **useEffect** (linje 101-113): Hent `employee_id, effective_from` og konverter til Record
- **Popover onSelect** (linje 476-481): Tilføj/fjern i Record i stedet for array
- **Badge-sektionen** (linje 496-515): Erstat simple badges med en liste hvor hver medarbejder vises med:
  ```text
  [Navn]  [date input: Fra ____-__-__]  [X fjern]
  ```
- **saveEmployeeAssignments** (linje 127-135): Inkluder `effective_from` i insert-data
- **resetForm** (linje 223): Nulstil til tomt Record
- **Popover trigger tekst** (linje 460-462): Brug `Object.keys(selectedEmployees).length`
- **createMutation/updateMutation**: Send Record videre til saveEmployeeAssignments

Alle steder der refererer `selectedEmployeeIds` opdateres til `selectedEmployees`.

