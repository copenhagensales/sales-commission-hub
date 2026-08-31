# Fix: Tryg - Ret salg smider dig tilbage til forsiden

## Årsag (bekræftet)

`src/routes/config.tsx:428` har ruten registreret som:

```
{ path: "/reports/tryg-edit-sales", component: TrygEditSales, access: "auth" }
```

`access: "auth"` er ikke "kræver login" — det er guarden til login-siderne. I `src/routes/guards.tsx:15-23` gør `AuthRoute` det modsatte: er man logget ind, sendes man til `/` (`if (user && !isRecoveryFlow) return <Navigate to="/" replace />`). Derfor bliver alle indloggede brugere kastet til forsiden. Det var en fejl i forrige runde, hvor jeg skiftede fra `role` for ikke at blokere allowlist-brugere.

## Ændring

Ret den ene linje til `access: "protected"`. `ProtectedRoute` (`src/components/RoleProtectedRoute.tsx:130`) kræver kun login + aktiv medarbejder og tjekker ingen position-permission, så allowlist-brugerne (Filip, Annika) rammes ikke.

Selve adgangskontrollen ligger uændret i siden og sidebaren via `useTrygEditAccess` (ejere + allowlist), så uvedkommende får fortsat ingen adgang til indholdet.

## Verifikation

- Typecheck
- Åbn `/reports/tryg-edit-sales` i preview og bekræft, at siden bliver stående i stedet for at redirecte

Ingen ændringer i beregninger, data eller rettighedslogik.
