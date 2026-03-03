

## Hvorfor Eline-Kirstine ikke kan se Salg-siden

### Årsag fundet

Der er en **mismatch** mellem to systemer:

1. **I databasen:** Eline-Kirstine har positionen "Assisterende Teamleder TM" med `system_role_key = 'assisterendetm'`. Denne rolle har `menu_sales: can_view = true`.

2. **I koden:** Funktionen `mapJobTitleToRoleKey()` i `usePositionPermissions.ts` oversætter hendes `job_title` ("Assisterende Teamleder") til role key `'teamleder'` — **ikke** `'assisterendetm'`. Og `teamleder`-rollen har `menu_sales: can_view = false`.

Kort sagt: Koden ignorerer den korrekte `system_role_key` fra `job_positions`-tabellen og bruger i stedet en hårdkodet tekstmapping baseret på `job_title`.

### Løsning

**Ændr `usePositionPermissions.ts`** til at hente `position_id` → `job_positions.system_role_key` fra databasen i stedet for at bruge `mapJobTitleToRoleKey()`.

Konkret:
- Udvid employee-opslaget til også at selecte `position_id`
- Hent `system_role_key` fra `job_positions` via `position_id`
- Brug den som `roleKey` til at slå op i `role_page_permissions`
- Behold `mapJobTitleToRoleKey()` som fallback, hvis `position_id` eller `system_role_key` ikke findes

Dette sikrer at Rettigheds-editoren (som skriver til `role_page_permissions` med den korrekte `system_role_key`) faktisk styrer adgangen.

### Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/hooks/usePositionPermissions.ts` | Hent `system_role_key` fra `job_positions` via `position_id` i stedet for `mapJobTitleToRoleKey()` |

