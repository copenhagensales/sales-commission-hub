

# Fortrolig-toggle direkte på kontraktoversigten

## Problem
I dag kan man kun markere en kontrakt som fortrolig ved oprettelse (SendContractDialog). Man mangler muligheden for at låse/låse op eksisterende kontrakter direkte fra `/contracts`-siden. Derudover skal fortrolige kontrakter skjules fra medarbejdervælgeren i SendContractDialog, så andre brugere ikke kan se dem som "muligheder".

## Ændringer

### 1. `src/pages/Contracts.tsx`
- Tilføj `currentUserEmail`-check (som i SendContractDialog) for at afgøre om brugeren er km@/mg@.
- Tilføj en toggle-knap (lås-ikon) i action-kolonnen for hver kontrakt, kun synlig for km@/mg@.
- Klik toggler `is_confidential` via en mutation (`UPDATE contracts SET is_confidential = !current`).
- Lås-ikonet ændrer udseende: fyldt/farvet når fortrolig, outline når ikke.

### 2. `src/components/contracts/SendContractDialog.tsx`
- Kontraktoversigten/medarbejdervælgeren påvirkes allerede af RLS — fortrolige kontrakter filtreres automatisk fra for uautoriserede brugere. Ingen yderligere ændring nødvendig her.

### Ingen database-ændringer
`is_confidential`-kolonnen og RLS-policies er allerede på plads. Det er kun frontend der mangler toggle-funktionalitet.

### Filer der ændres
- `src/pages/Contracts.tsx` — tilføj email-check, toggle-mutation og lås-knap i tabellen

