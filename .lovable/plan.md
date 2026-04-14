

## Problem

"Nulstil kode"-knappen på medarbejder-detaljesiden (EmployeeDetail.tsx linje 594) bruger `supabase.auth.resetPasswordForEmail()` — Supabase's indbyggede nulstilling. Men appen bruger et **custom token-baseret** reset-flow via edge functions:

1. `initiate-password-reset` — genererer token og sender email
2. `validate-reset-token` — validerer token
3. `complete-password-reset` — sætter ny adgangskode

Den indbyggede Supabase-reset virker sandsynligvis ikke, fordi redirect-URL'en og flowet ikke matcher appens custom `/reset-password` side.

## Løsning

Udskift `supabase.auth.resetPasswordForEmail()` kaldet i `EmployeeDetail.tsx` med et kald til `initiate-password-reset` edge function:

```typescript
const { data, error } = await supabase.functions.invoke("initiate-password-reset", {
  body: { email: employee.private_email }
});
```

### Fil der ændres

| Fil | Ændring |
|-----|---------|
| `src/pages/EmployeeDetail.tsx` | Linje 594-596: Erstat `supabase.auth.resetPasswordForEmail` med `supabase.functions.invoke("initiate-password-reset", ...)` |

En enkelt ændring — ca. 3 linjer kode.

