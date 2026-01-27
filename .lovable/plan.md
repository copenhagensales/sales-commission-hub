
# Plan: Vis CPR-nummer i medarbejder stamkort popup

## Problem
CPR-nummeret vises aktuelt som "••••••••" i popup-vinduet, fordi `masked` prop'en er sat til `true` på `ReadOnlyRow` komponenten.

## Løsning
Fjern `masked` prop'en fra CPR-rækken i `EmployeeProfileDialog.tsx`, så det faktiske CPR-nummer vises.

---

## Teknisk ændring

### Fil: `src/components/employee/EmployeeProfileDialog.tsx`

**Før (linje 96):**
```tsx
<ReadOnlyRow label="CPR-nr." value={employee.cpr_number} masked />
```

**Efter:**
```tsx
<ReadOnlyRow label="CPR-nr." value={employee.cpr_number} />
```

---

## Bemærkning
Dette er en enkelt-linje ændring. Ved at fjerne `masked` prop'en vil CPR-nummeret blive vist i fuld længde (f.eks. "010190-1234") i stedet for "••••••••".
