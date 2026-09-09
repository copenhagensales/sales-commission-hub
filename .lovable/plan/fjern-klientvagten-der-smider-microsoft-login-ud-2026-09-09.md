# Fjern klientvagten der smider Microsoft-login ud

## Hvorfor beskeden kom
Beskeden "Login med adgangskode er lukket" kommer fra `src/hooks/usePasswordLoginBlock.ts` (linje 14-21), kaldt globalt i `src/App.tsx:87`. Den logger brugeren ud, hvis `session.user.app_metadata.provider` ikke er præcis `azure`.

Bekræftet i data: **323 af 323 konti i `auth.users` har `provider = 'email'`**. Det felt beskriver hvordan kontoen oprindeligt blev oprettet — ikke hvordan man loggede ind lige nu. Derfor blev du logget ud og fik beskeden, selv om du trykkede på Microsoft-knappen. Med den vagt aktiv vil ingen kunne logge ind.

Email/password-provideren er nu slået fra i Cloud, så håndhævelsen ligger korrekt server-side.

## Ændring
1. Fjern kaldet `usePasswordLoginBlock()` i `src/App.tsx` og slet `src/hooks/usePasswordLoginBlock.ts`.
2. Intet andet ændres.

## Bevares uændret
- `useMicrosoftLoginGuard` (matcher Microsoft-logins mod `employee_master_data`, afviser ukendte og dubletter).
- Reset-endpoints svarer fortsat HTTP 410.
- `disable_signup = true`.
- Loginsiden med kun Microsoft-knappen og infoteksten.
- Auth-konti, user IDs, roller, rettigheder, RLS, provision og løn.

## Verifikation
- Typecheck.
- Ingen forekomster af `usePasswordLoginBlock` i kodebasen.
- Du logger ind via Microsoft og bliver ikke smidt ud; ingen fejltoast.
