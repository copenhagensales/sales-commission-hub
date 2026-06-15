# Fix: "Edge Function returned a non-2xx status code" ved opret medarbejder

## Problem
`create-employee-user` returnerer 422 `email_exists` når emailen tilhører en eksisterende auth-bruger der ligger uden for første side i `listUsers()` (default 50, Stork har 100+). Eksisterende-gren rammes aldrig → koden kalder `createUser()` og fejler.

Evidens: edge function-log 2026-06-15 07:21:30 + `auth.users` indeholder `floramklug@gmail.com` (oprettet 16. jan 2026).

## Fix (variant B — grundigt)
Erstat paginerede `listUsers()` med direkte opslag i `auth.users` via service role.

**Fil:** `supabase/functions/create-employee-user/index.ts` (linje 75-77)

```ts
// Check if user already exists — direct lookup (O(1), skalerer)
const { data: existingAuthRow } = await supabase
  .schema("auth")
  .from("users")
  .select("id, email")
  .ilike("email", email)
  .maybeSingle();
const existingUser = existingAuthRow
  ? { id: existingAuthRow.id as string, email: existingAuthRow.email as string }
  : null;
```

Resten af eksisterende-grenen (password-update, link `auth_user_id`, opret manglende `employee_master_data`, tildel `medarbejder`-rolle) bevares uændret — den læser kun `existingUser.id`.

## Zone
Gul. Én fil, ingen pricing/løn/RLS/skema. Service role har allerede adgang til `auth.users`.

## Verifikation
Efter deploy: Mathias prøver igen at oprette Flora Klug → forventet resultat: "Adgangskode opdateret" (eksisterende-grenen) i stedet for 422.
