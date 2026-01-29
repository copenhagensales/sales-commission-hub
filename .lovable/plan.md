
# Fix: Thomas Wehage mangler rettigheder til fraværshåndtering

## Problem
Thomas Wehage kan stadig ikke oprette fravær for teammedlemmer, selvom `is_teamleder_or_above()` funktionen nu returnerer `true` for ham.

## Årsag identificeret
RLS-policyen for `absence_request_v2` bruger **to funktioner**:

```sql
is_teamleder_or_above(auth.uid()) AND can_view_employee(employee_id, auth.uid())
```

Mens `is_teamleder_or_above()` nu virker ✅, fejler `can_view_employee()` ❌ fordi den kalder `get_user_manager_scope()` som returnerer `'self'` baseret på `role_page_permissions`.

### Nuværende rettigheder for `assisterende_teamleder_fm`:

| Permission Key | can_view | can_edit | visibility |
|----------------|----------|----------|------------|
| `menu_absence` | false | false | self |
| `menu_employees` | false | false | self |

### Teamleder har til sammenligning:

| Permission Key | can_view | can_edit | visibility |
|----------------|----------|----------|------------|
| `menu_absence` | true | true | team |
| `menu_employees` | true | true | team |

## Løsning
Opdater `role_page_permissions` for `assisterende_teamleder_fm` rollen så den får team-niveau adgang til fravær:

### SQL Migration:
```sql
UPDATE role_page_permissions
SET can_view = true, can_edit = true, visibility = 'team'
WHERE role_key = 'assisterende_teamleder_fm'
AND permission_key IN ('menu_absence', 'menu_employees');
```

## Hvad dette ændrer
- **menu_absence**: Giver adgang til fraværsmenu og team-niveau synlighed
- **menu_employees**: Giver adgang til medarbejderoversigt og team-niveau synlighed

## Resultat efter ændring
1. `get_user_manager_scope()` returnerer `'team'` i stedet for `'self'`
2. `can_view_employee()` returnerer `true` for teammedlemmer
3. Thomas kan oprette, se og redigere fravær for sit Fieldmarketing team

## Alternativ (UI-baseret)
Ændringen kan også laves via Permission Editor UI'en på `/employees?tab=permissions`:
1. Find rollen "Assisterende Teamleder FM" 
2. Aktivér "Menu - Fravær" med visibility = Team
3. Aktivér "Menu - Medarbejdere" med visibility = Team
