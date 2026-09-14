# Peter Sørensen kan ikke logge ind (peso@copenhagensales.dk)

## Årsag (bekræftet i data)
Peters login-konto er oprettet på hans **private** mail:

- `employee_master_data`: Peter Sørensen, `work_email = peso@copenhagensales.dk`, `private_email = petersorensen2006@gmail.com`, aktiv, startdato 14-09-2026, `auth_user_id = 9b1ad149…`
- Login-kontoen `9b1ad149…` har e-mail `petersorensen2006@gmail.com` (oprettet 24-07-2026, sidst logget ind 17-08-2026)
- Der findes **ingen** login-konto med `peso@copenhagensales.dk`

Når han bruger Microsoft-knappen, kommer han ind som `peso@copenhagensales.dk`. Da ingen konto har den mail, forsøger systemet at oprette en ny - og nyoprettelse er lukket. Derfor beskeden "sign ups are disabled for this website".

## Rettelse
Flyt e-mailen på hans eksisterende login-konto fra den private til arbejdsmailen. Samme konto, samme bruger-id, samme rettigheder og historik - kun mailen ændres.

Det gøres med det værktøj, der allerede findes til netop dette (`migrate-auth-emails`), men i dag kører det på alle medarbejdere på én gang. Jeg tilføjer en valgfri afgrænsning, så det kan køres for én enkelt person, og kører det kun for Peter.

Trin:
1. Tilføj valgfri parameter (liste af arbejdsmails) til `supabase/functions/migrate-auth-emails/index.ts`. Uden parameter er adfærden præcis som i dag.
2. Kør tørløb for `peso@copenhagensales.dk` og bekræft: 1 til flytning, 0 konflikter.
3. Kør den rigtige flytning for kun ham.
4. Verificér i data, at login-kontoen nu har `peso@copenhagensales.dk`, at bruger-id er uændret, og at ingen andre konti er berørt.

## Rører ikke
Medarbejderdata, roller, rettigheder, RLS, provision, løn, øvrige 303 login-konti, login-flowet eller Microsoft-vagten.

## Efter rettelsen
Peter logger ind med Microsoft-knappen på sin arbejdsmail. Hans private mail kan ikke længere bruges som login - det er meningen, da password-login er lukket.
