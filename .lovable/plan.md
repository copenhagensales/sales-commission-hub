

## Problem

`MyGoals.tsx` finder kun medarbejderen via `auth_user_id`. Hvis en medarbejder logger ind med en anden konto end den, der er gemt i `employee_master_data.auth_user_id`, finder systemet dem ikke — selvom deres email matcher `private_email` eller `work_email`.

Databasen har allerede funktionen `get_current_employee_id()` som håndterer dette korrekt med email-fallback og auto-linking.

## Løsning

Ændr `MyGoals.tsx` til at bruge `get_current_employee_id()` RPC i stedet for direkte `auth_user_id` lookup.

### Ændring

**File: `src/pages/MyGoals.tsx`** (linje 61-69)

Erstat:
```tsx
const { data } = await (supabase as any)
  .from("employee_master_data")
  .select("id, salary_type, first_name, last_name")
  .eq("auth_user_id", currentUser.id)
  .single();
```

Med:
```tsx
// Use RPC that matches on auth_user_id OR email, with auto-linking
const { data: employeeId } = await supabase.rpc("get_current_employee_id");
if (!employeeId) return null;

const { data } = await (supabase as any)
  .from("employee_master_data")
  .select("id, salary_type, first_name, last_name")
  .eq("id", employeeId)
  .single();
```

Dette sikrer at uanset hvilken konto medarbejderen logger ind med, finder systemet dem via email-match — og auto-linker `auth_user_id` for fremtidige opslag.

Vi bør også stadig køre migrationen for at rette Emma's `auth_user_id` til hendes aktive konto, så andre steder i systemet også fungerer korrekt.

