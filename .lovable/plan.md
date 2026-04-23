
## Diagnose

Fannys `job_title` er ændret til "Fieldmarketing" — men `position_id` peger stadig på **"Salgskonsulent"** (rolle: `medarbejder`). UI'et viser `job_title`, men permissions kommer fra `position_id → job_positions.system_role_key`.

**Konkret:**
- `employee_master_data.position_id` = Salgskonsulent (`729194f5...`) → rolle `medarbejder` → `menu_section_fieldmarketing.can_view = false` ❌
- "Fieldmarketing"-positionen (`f4c737ca...`) findes med `system_role_key = fm_medarbejder_` → `menu_section_fieldmarketing.can_view = true` ✅

`job_title` er bare en tekst-kolonne; den styrer ikke menuen.

## Fix

Opdatér Fannys `position_id` til Fieldmarketing-positionen:

```sql
UPDATE employee_master_data
SET position_id = 'f4c737ca-2a1a-4169-92e7-e8f33b453017'
WHERE id = 'd60f19b0-dcfa-434e-983f-c40651f45021';
```

Effekt: Hun får rollen `fm_medarbejder_`, som har adgang til:
- `menu_section_fieldmarketing` (sektion synlig)
- `menu_fm_my_schedule`
- `menu_fm_sales_registration`

Hun skal lave hard reload (Ctrl+Shift+R) eller logge ud/ind for at React Query-cachen invalideres.

## Zone

`employee_master_data` med rolle-effekt = **rød zone** (Auth/RLS). Kræver din eksplicitte godkendelse før jeg kører UPDATE.

## Sidenote — åben beslutning

CLAUDE.md §7 nævner at `auto_set_position_id`-triggeren kun sætter `position_id` hvis den er **NULL**. Når `job_title` ændres i UI'et på en eksisterende medarbejder, opdateres `position_id` derfor ikke automatisk. Det er sandsynligvis derfor flere personer kan have samme symptom. Skal vi udvide triggeren til også at re-mappe ved `job_title`-ændring? — separat beslutning, ikke en del af denne fix.

## Næste skridt

Bekræft at jeg må køre UPDATE på Fannys `position_id`.
