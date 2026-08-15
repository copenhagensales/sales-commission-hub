# Flyt "Marker alle" op i kortets header

## Ændring
I Telefonnumre-kortet på salgsregistrering:

- Fjern den separate boks med "Marker alle" under titlen.
- Placér i stedet checkboksen i kortets header, på samme linje som "Telefonnumre *", yderst til højre, som en afrundet pille med kant: label "Marker alle Claim/Reimport" efterfulgt af checkboksen.
- Vises kun for Eesy FM, som i dag. Funktionen er uændret (markerer/afmarkerer alle linjer).
- Header får `flex items-center justify-between` så titel står til venstre og pillen til højre.

## Teknisk
Kun `src/pages/vagt-flow/SalesRegistration.tsx` (CardHeader/CardTitle i Telefonnumre-kortet). Ingen logikændringer.
