# Selvbetjent skift af adgangskode i Min Profil

## Nuværende situation
En indlogget bruger kan ikke selv skifte adgangskode. De tre eksisterende veje er:

1. "Glemt adgangskode?" på `/auth` — token-mail via `initiate-password-reset`, ny kode sættes på `/reset-password`.
2. Tvungent skift ved første login (`mustChangePassword` i `Auth.tsx`).
3. Leder sætter kode manuelt på medarbejderkortet (`EmployeeDetail.tsx` → `set-user-password`).

`MyProfile.tsx` har ingen password-sektion.

## Hvad der bygges
En "Skift adgangskode"-sektion på Min Profil:

- Felter: nuværende adgangskode, ny adgangskode, bekræft ny adgangskode.
- Nuværende kode verificeres først med `signInWithPassword` mod brugerens egen email (fejl → "Nuværende adgangskode er forkert").
- Ny kode valideres med den eksisterende `validatePassword` og vises med `PasswordStrengthIndicator`.
- Gem via `supabase.auth.updateUser({ password })`, toast ved succes/fejl.
- Knappen er deaktiveret indtil kravene er opfyldt og de to nye felter matcher.

## Teknisk
- Ny komponent `src/components/profile/ChangePasswordCard.tsx`, indsat i `src/pages/MyProfile.tsx`.
- Genbruger `src/lib/password-validation.ts` og `src/components/password/PasswordStrengthIndicator.tsx`.
- Ingen DB-migration, ingen edge function, ingen ændring af login- eller reset-flow.
- Zone: grøn/gul (UI + auth-selvbetjening), ingen ændring i `permissionKeys.ts` eller RLS.
