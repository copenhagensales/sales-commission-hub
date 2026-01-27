

# Implementering: Én medarbejder, én booking per dag

## Oversigt

Implementerer en streng regel der sikrer at en medarbejder kun kan have ét booking-assignment per dag - uanset lokation eller booking.

---

## Database-ændringer

### Migration: Oprydning og ny constraint

```sql
-- Trin 1: Fjern eksisterende dubletter (behold den ældste per medarbejder/dato)
DELETE FROM public.booking_assignment a
WHERE a.id NOT IN (
  SELECT (array_agg(id ORDER BY created_at ASC))[1]
  FROM public.booking_assignment
  GROUP BY employee_id, date
);

-- Trin 2: Tilføj unik constraint på employee_id + date
ALTER TABLE public.booking_assignment
ADD CONSTRAINT booking_assignment_unique_employee_date 
UNIQUE (employee_id, date);
```

---

## Frontend-ændringer

### 1. AddEmployeeDialog.tsx

**Ændring i `handleSubmit` (ca. linje 487-503):**

Tilføj filtrering af allerede bookede dage:

```typescript
const assignments = validEmployees.map(employeeId => ({
  employeeId,
  dates: Array.from(selectedDays)
    .filter(dayIndex => hasShiftOnDay(employeeId, dayIndex))
    .filter(dayIndex => !isBookedOnDay(employeeId, dayIndex)) // NY
    .map(dayIndex => format(addDays(weekStart, dayIndex), "yyyy-MM-dd")),
})).filter(a => a.dates.length > 0);

if (assignments.length === 0) {
  toast.error("Ingen gyldige dage - medarbejdere er allerede booket");
  return;
}
```

### 2. EditBookingDialog.tsx

**Ændring i `handleAddEmployees` (ca. linje 814-830):**

Samme filtrering:

```typescript
const assignments = validEmployees.map(employeeId => ({
  employeeId,
  dates: Array.from(selectedEmployeeDays)
    .filter(dayIndex => hasShiftOnDay(employeeId, dayIndex))
    .filter(dayIndex => !isBookedOnDay(employeeId, dayIndex)) // NY
    .map(dayIndex => format(addDays(weekStart, dayIndex), "yyyy-MM-dd")),
})).filter(a => a.dates.length > 0);

if (assignments.length === 0) {
  toast.error("Ingen gyldige dage - medarbejdere er allerede booket");
  return;
}
```

### 3. Bookings.tsx

**Forbedret fejlhåndtering i `bulkAssignMutation` (ca. linje 295-302):**

```typescript
onError: (error: any) => {
  const isUniqueViolation = error.message?.includes('unique') || 
                            error.message?.includes('duplicate') ||
                            error.code === '23505';
  const message = isUniqueViolation 
    ? "Medarbejder er allerede booket på en eller flere af de valgte dage"
    : "Kunne ikke tildele medarbejdere";
  toast({ title: message, variant: "destructive" });
},
```

### 4. MarketsContent.tsx

**Samme forbedrede fejlhåndtering (ca. linje 183-198):**

```typescript
onError: (error: any) => {
  const isUniqueViolation = error.message?.includes('unique') || 
                            error.message?.includes('duplicate') ||
                            error.code === '23505';
  const message = isUniqueViolation 
    ? "Medarbejder er allerede booket på en eller flere af de valgte dage"
    : error.message;
  toast({ title: "Fejl", description: message, variant: "destructive" });
},
```

---

## Ændringsoversigt

| Fil | Ændring |
|-----|---------|
| Database migration | Slet dubletter + tilføj UNIQUE constraint |
| `AddEmployeeDialog.tsx` | Filtrer bookede dage + fejlbesked |
| `EditBookingDialog.tsx` | Filtrer bookede dage + fejlbesked |
| `Bookings.tsx` | Brugervenlig fejlbesked ved constraint violation |
| `MarketsContent.tsx` | Brugervenlig fejlbesked ved constraint violation |

---

## Resultat

- Eksisterende dubletter fjernes (beholder den ældste)
- Database afviser automatisk nye dubletter
- UI forhindrer valg af allerede bookede dage
- Tydelige fejlbeskeder på dansk
- **En medarbejder kan kun bookes én gang per dag**

