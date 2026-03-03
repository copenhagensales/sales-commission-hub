
# Fix: Sæt `auth_user_id` ved oprettelse af brugerkonti

## Problem
Når en medarbejder får oprettet en konto via "Opret bruger" eller "Sæt adgangskode", bliver `auth_user_id` ikke sat på medarbejderens record i databasen. Systemet bruger `auth_user_id` til at koble den loggede bruger til medarbejderdata -- uden det link kan medarbejderen logge ind, men systemet finder ikke deres profil, teams, vagter osv.

Kun `complete-employee-registration` (invitation-flowet) og `batch-set-fieldmarketing-passwords` sætter `auth_user_id` korrekt. De to andre edge functions gør det ikke.

## Berørte funktioner

### 1. `create-employee-user` (bruges fra Medarbejdere-siden og Staff-fanen)
- Opretter auth-bruger og employee_master_data, men sætter aldrig `auth_user_id` på employee-recorden.
- **Fix:** Efter oprettelse af auth-brugeren, opdater `employee_master_data` med `auth_user_id` -- både for nye og eksisterende employee records.

### 2. `set-user-password` (bruges fra Medarbejder-detaljesiden)
- Opretter evt. en ny auth-bruger, men sætter heller aldrig `auth_user_id`.
- **Fix:** Efter oprettelse/find af auth-brugeren, opdater `employee_master_data` med `auth_user_id` via `private_email` match.

## Tekniske ændringer

### `supabase/functions/create-employee-user/index.ts`
- Linje ~120-147: Når en eksisterende employee findes (via email), tilføj `.update({ auth_user_id: authData.user.id })`.
- Når en ny employee oprettes, inkluder `auth_user_id` i insert-data.
- Når en eksisterende bruger får opdateret password (linje 53-77), find og opdater employee med `auth_user_id`.

### `supabase/functions/set-user-password/index.ts`
- Linje 86-117 (ny bruger oprettet): Tilføj `auth_user_id` update på `employee_master_data` via `private_email`.
- Linje 120-148 (eksisterende bruger): Tilføj `auth_user_id` update her også, da det kan mangle fra tidligere oprettelser.

Begge ændringer er bagudkompatible -- de tilføjer blot det manglende link uden at ændre eksisterende adfærd.
