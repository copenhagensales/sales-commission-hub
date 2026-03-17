
## Problem

Brugeren `madhan@statfinity.in` blev oprettet som auth-bruger den 11. marts, men der blev aldrig oprettet en `employee_master_data` post. Når man nu trykker "Opret medarbejder" i dialogen, finder edge-funktionen `create-employee-user` den eksisterende auth-bruger, opdaterer password'et, og returnerer success — **uden at oprette employee-posten**.

Loggen bekræfter: `"Updated password for existing user madhan@statfinity.in"`

Derefter prøver frontend'en at `UPDATE employee_master_data SET job_title = ... WHERE private_email = 'madhan@statfinity.in'`, men der er ingen række at opdatere.

**Root cause**: `create-employee-user` mangler logik til at oprette `employee_master_data`-posten når auth-brugeren allerede eksisterer men employee-recorden ikke gør.

## Plan

### 1. Fix `create-employee-user` edge function

I den "existing user" gren (linje ~57-82), efter password-opdatering og linking-forsøget, tilføj check: hvis ingen employee_master_data matcher email'en, opret en ny post med `first_name`, `last_name`, `private_email`, `is_active: true`, `auth_user_id`, `job_title`, og `is_staff_employee`.

### 2. Fix den aktuelle bruger

Opret manuelt en `employee_master_data` post for `madhan@statfinity.in` via migration, med `auth_user_id` linket til den eksisterende auth-bruger (`c553edf9-b9bb-4469-9b4b-36ae73d3faeb`), og `job_title: 'Rekruttering'` baseret på hvad der blev valgt i dialogen.

### 3. Send `job_title` til edge function

Frontend'en sender ikke `job_title` til edge-funktionen (linje 618-625). Tilføj `job_title: createData.job_title` i request body, så edge-funktionen kan inkludere det i begge paths (ny og eksisterende bruger).
