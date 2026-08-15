# Claim/Reimport-afkrydsning på Eesy FM salgsregistrering

## Hvad der bygges
På siden "Tast selv salg" (FM salgsregistrering) tilføjes en checkboks **"Claim/Reimport"** ved telefonnummer-sektionen. Den gælder hele registreringen (alle salg der tastes ind i samme omgang).

- Default: **fra**. Ingen tvang til at vælge til/fra.
- Vises kun når bookingens klient er **Eesy FM**.
- Når den er markeret:
  - Kommentar-feltet under "Salgsoplysninger" bliver påkrævet, markeres med `*`, får rød ramme og en hjælpetekst ("Kommentar er påkrævet ved Claim/Reimport").
  - Forsøg på at gemme uden kommentar blokeres med fejlbesked, og der scrolles/fokuseres til kommentar-feltet.
- Checkboks og kommentar nulstilles efter gemt registrering og ved skift ud af callback-tilstand.

## Ikke med i denne omgang
Hvordan Claim/Reimport gemmes på salget i databasen afklares senere. Denne opgave er ren UI + validering — ingen ændring af datamodel, hooks eller pricing.

## Teknisk
- Fil: `src/pages/vagt-flow/SalesRegistration.tsx`
  - Ny state `isClaimReimport` (boolean, default `false`).
  - Eesy-tjek: `activeBooking?.client?.id === FIELDMARKETING_CLIENTS.EESY_FM` (fra `@/hooks/useFieldmarketingSales`).
  - Checkboks placeres i "Telefonnumre"-kortet (over telefonrækkerne) med `Checkbox` fra `@/components/ui/checkbox` + `Label`.
  - Validering i `handleSubmit`: hvis `isClaimReimport && !comment.trim()` → `toast.error(...)`, `return` før mutation; sæt en `commentError`-tilstand der styrer rød ramme + hjælpetekst, og `focus()` på kommentar-feltet via ref.
  - Reset af `isClaimReimport` i success-grenen og i `exitCallbackMode`.
- Ingen ændringer i `useFieldmarketingSales.ts`, ingen DB-migration, ingen ændring af `comment`-payload ud over eksisterende adfærd.
