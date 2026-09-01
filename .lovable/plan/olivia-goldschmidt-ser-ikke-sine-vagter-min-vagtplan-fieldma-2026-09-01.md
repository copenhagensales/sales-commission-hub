# Olivia Goldschmidt ser ikke sine vagter (Min vagtplan, Fieldmarketing)

## Rod-årsag (bekræftet)

Hun har vagter i databasen — 8 bekræftede `booking_assignment`-rækker (26/8–4/9 2026, alle `booking.status = confirmed`).

Problemet er identitetsopslaget:

- Login-mail (auth): `oliviagoldschmidt@gmail.com`
- `employee_master_data`: `private_email = oliviaskiligoldschmidt@gmail.com`, `work_email = olgo@copenhagensales.dk`

`src/pages/vagt-flow/MyBookingSchedule.tsx:32-38` finder medarbejderen udelukkende via
`private_email.ilike / work_email.ilike` på login-mailen. Ingen af de to matcher hendes login-mail,
så `employeeId` bliver `null`, og vagt-forespørgslen kører aldrig (`enabled: !!employeeId`).
Siden viser derfor "Ingen vagt" hver dag uden fejl.

Hendes `auth_user_id` (`6678b2cf-…`) står korrekt på medarbejderrækken — det er kun mail-matchet der fejler.

## Plan

### 1. Ret data (løser hendes problem med det samme)

Opdatér `private_email` på hendes medarbejderrække til den mail hun faktisk logger ind med,
`oliviagoldschmidt@gmail.com`. Ingen andre felter røres, ingen løn- eller salgsdata påvirkes.

### 2. Ret årsagen, så det ikke sker for andre (frontend)

I `MyBookingSchedule.tsx` slås medarbejderen først op via `auth_user_id` (`user.id`), og først
hvis det ikke giver et resultat falder den tilbage til mail-matchet. Det gør siden robust over for
mail-uoverensstemmelser for alle FM-medarbejdere, ikke kun Olivia.

### 3. Verifikation

- Kør et opslag som hendes bruger og bekræft at de 8 assignments returneres.
- Åbn Min vagtplan for uge 36 og bekræft at 31/8–4/9 vises.
- Bekræft at en anden FM-medarbejder (hvor mailen matcher) stadig ser sine vagter uændret.

## Teknisk resume

- Data: `UPDATE employee_master_data SET private_email = 'oliviagoldschmidt@gmail.com' WHERE id = '29b7a229-…'`
- Kode: `src/pages/vagt-flow/MyBookingSchedule.tsx` (kun opslaget af `employeeId`)
- Ingen ændringer i RLS, lønberegning eller booking-data.

## Åbent spørgsmål

Samme mail-baserede opslag bruges også i `useVagtEmployee`, `useIsFieldmarketingEmployee` og
`useCanWorkFieldmarketing`. Skal `auth_user_id`-først-logikken udbredes til dem i samme omgang,
eller holder vi denne leverance til vagtplanen?
