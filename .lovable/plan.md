# Vælg selv ikrafttrædelsesdato på kontrakten

## Problemet i dag

I kontraktteksten står `{{startdato}}` (punkt 1.1 "Medarbejderen tiltræder sin stilling hos Arbejdsgiver den …"). Når kontrakten sendes, udfyldes den automatisk med medarbejderens startdato fra stamkortet. Går en medarbejder fra fuldtid til deltid, kan du derfor ikke selv bestemme, hvornår den nye aftale gælder fra — der står den oprindelige ansættelsesdato.

## Løsning

I dialogen "Send kontrakt" tilføjes et nyt felt: **Ikrafttrædelsesdato**.

- Feltet er forudfyldt med medarbejderens nuværende startdato, så alt virker som i dag, hvis du ikke ændrer noget.
- Du kan vælge en anden dato (fx den dag deltidsaftalen gælder fra).
- Den valgte dato flettes ind der, hvor kontrakten bruger startdato — både i forhåndsvisningen, i mailen til medarbejderen og på underskriftssiden.
- Under feltet står en kort hjælpetekst: "Bruges hvor kontrakten skriver tiltrædelses-/startdato. Ændrer ikke medarbejderens stamkort."

Stamkortet ændres ikke. Løn, timer, vagter og rapporter påvirkes derfor ikke.

## Teknisk

- Kun `src/components/contracts/SendContractDialog.tsx`.
- Ny state `effectiveDate`, forudfyldt fra `employee.employment_start_date` når skabelon/medarbejder vælges, nulstilles i `resetForm`.
- Datovælger efter shadcn-mønsteret (Popover + Calendar med `pointer-events-auto`), dansk format via `date-fns`/`da`.
- I `mergeContent` bruges `effectiveDate` (i stedet for `employee.employment_start_date`) til at danne `startDateFormatted`, som allerede dækker varianterne `startdato`, `medarbejder_startdato`, `ansættelsesdato`, `tiltrædelsesdato`, `employment_start_date`.
- `effectiveDate` tilføjes til `useMemo`-afhængighederne for forhåndsvisningen, så preview opdateres med det samme.
- Ingen ændringer i database, RLS, edge functions, løn- eller pricinglogik. Allerede sendte/underskrevne kontrakter berøres ikke.
