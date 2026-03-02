

# Giv teamledere deaktiverings-rettighed + bedre fejlhåndtering

## Problem
Jonas (teamleder) forsøgte at deaktivere en medarbejder. Frontenden viste ingen fejl, men databasen blokerede opdateringen fordi der ikke findes en UPDATE RLS-politik for teamledere på `employee_master_data`. Rettighedseditoren viser allerede `can_edit: true` for teamledere under "Medarbejdere", men databasen håndhæver det ikke.

## Løsning

### 1. Tilføj UPDATE RLS-politik for teamledere (database migration)
Tilføj en ny RLS-politik på `employee_master_data` der tillader teamledere at opdatere medarbejdere i deres eget team:

```sql
CREATE POLICY "Teamledere can update their team employees"
ON public.employee_master_data
FOR UPDATE
TO authenticated
USING (
  is_teamleder_or_above(auth.uid())
  AND can_view_employee(id, auth.uid())
)
WITH CHECK (
  is_teamleder_or_above(auth.uid())
  AND can_view_employee(id, auth.uid())
);
```

Dette genbruger de eksisterende `is_teamleder_or_above` og `can_view_employee` funktioner, som allerede bruges til SELECT-politikken. Teamledere kan kun opdatere medarbejdere de kan se (dvs. i deres team).

### 2. Tilføj en specifik deaktiverings-rettighed i permissionKeys.ts
Tilføj en ny permission key `action_employee_deactivate` under `menu_employees` for finere kontrol:

```text
action_employee_deactivate: { label: 'Deaktiver medarbejder', section: 'personale', parent: 'menu_employees' }
```

### 3. Brug rettigheden i frontend (EmployeeMasterData.tsx)
- Tjek `canEdit('action_employee_deactivate')` eller `canEdit('menu_employees')` før deaktiverings-switchen vises/aktiveres.
- Vis en tydelig fejlbesked i `onError` hvis opdateringen fejler pga. manglende rettigheder (RLS-fejl).

### 4. Bedre fejlhåndtering i toggleActiveMutation
Frontenden viser allerede en toast ved fejl (linje 558-560), men `supabase.update()` returnerer fejlen korrekt - problemet var at Jonas aldrig så den fordi databasen returnerer en "tom" success ved RLS-blokering. Vi tilføjer et ekstra tjek:

```typescript
const { error, count } = await supabase
  .from("employee_master_data")
  .update(updateData)
  .eq("id", id)
  .select();

if (error) throw error;
if (!data || data.length === 0) {
  throw new Error("Du har ikke rettighed til at ændre denne medarbejder");
}
```

## Teknisk opsummering

| Ændring | Fil |
|---------|-----|
| RLS UPDATE-politik for teamledere | Database migration (SQL) |
| Ny permission key `action_employee_deactivate` | `src/config/permissionKeys.ts` |
| Frontend-rettigheds-tjek + fejlhåndtering | `src/pages/EmployeeMasterData.tsx` |

