# Bulk Salg (Leder) på Tast selv salg

## Mål
Ny fane-knap "Bulk Salg (Leder)" på siden "Tast selv salg", placeret ude til højre — adskilt fra kanal-knapperne ("Lederne", "Hiper Bredbånd"). Kun ejere kan se og tilgå den.

## Sådan gøres det
- Fane-rækken pakkes i en flex-række med `justify-between`: kanal-knapperne til venstre, den nye knap i sin egen `TabsList` til højre.
- Den nye fane vises kun når brugeren har ejer-rolle. Sælgere og andre roller ser den slet ikke, og kan heller ikke aktivere den (fanen findes ikke i DOM'en for dem).
- Indholdet under fanen laves som tom placeholder ("Bulk-registrering kommer her") — indhold og logik bygger vi i næste prompt.
- Hvis brugeren kun har én kanal i dag, bruges Tabs-strukturen alligevel for ejere, så knappen kan vises.

## Teknisk
- Fil: `src/pages/TastSelvSalg.tsx` (grøn zone, ren UI).
- Ejer-tjek via eksisterende `usePositionPermissions()` → `isOwner` (`roleKey === 'ejer'`). Ingen hardkodede mails, ingen DB-ændring.
- Ingen ændringer i `useLederneSales`, edge functions eller rettighedstabeller.

## Note
Ejer-tjekket er en frontend-visning. Når fanens funktionalitet bygges, skal serversiden (edge function/RLS) også validere adgangen — det tager vi i næste trin.
