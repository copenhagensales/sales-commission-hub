# Straksbetaling (ASE): fanen og alle Uniteds salg for ejere og teamledere

## Mål
Ejere og Uniteds teamleder (Filip) skal altid kunne se fanen "Straksbetaling", også uden egne ASE-salg. Inde på fanen skal de se ASE-salg fra alle Uniteds sælgere (seneste 30 dage, som i dag) og kunne registrere eller annullere straksbetaling for dem.

## Sådan virker det i dag
- Fanen vises kun med rettigheden `tab_registrer_salg_straksbetaling` OG hvis brugeren selv har ASE-salg med en straks-tilladt prisregel (`useHasImmediatePaymentSales`).
- Siden (`ImmediatePaymentASE.tsx`) henter kun salg på brugerens egne agent-mails.
- Databasen tillader allerede ledere at læse og opdatere salgslinjer (reglerne "zz Ledere kan se salgslinjer" og "Managers can update sale_items" via `is_manager_or_above`). Der kræves derfor ingen ændring i databasen eller adgangsregler.

## Ændring
1. **Ny rettighed** "Straksbetaling: se alle sælgeres salg" (`tab_registrer_salg_straksbetaling_alle`) i rettighedslisten. Tildeles ejer og teamleder i rettighedsopsætningen, så det ikke hardcodes på rolle eller navn. Filip er Teamleder og får den via sin rolle.
2. **Fanesynlighed:** Fanen vises, hvis brugeren har den nye rettighed – uden krav om egne salg. Almindelige sælgere er uændrede.
3. **Siden:** Med den nye rettighed hentes alle salg på ASE-kampagnen (Uniteds klient, ikke ASE FM) de sidste 30 dage, med en kolonne "Sælger" og et søgefelt på navn. Uden rettigheden vises kun egne salg som i dag.
4. **Registrering:** Samme knapper og samme satsskift som i dag; provisionen tilfalder fortsat salgets egen sælger (der ændres kun straks-markeringen og satserne på salgslinjen, aldrig hvem salget tilhører).

## Ikke ændret
Prisregler, satser, genberegningsmotoren, FM's ASE-salg, adgangsregler i databasen, øvrige faner.

## Risiko
Lønrelevant: en leder kan ændre provision for andre sælgere. Det er det, der efterspørges, og databasen tillader det allerede for ledere. Ingen eksisterende salg ændres af selve ændringen.

## Teknisk
- Filer: `src/config/permissionKeys.ts` (rød zone, godkendes med planen), `src/hooks/useMitArbejdeSynlighed.ts`, `src/pages/ImmediatePaymentASE.tsx` (hentning flyttes til en hook `useImmediatePaymentSales`), rettighedsrækker for ejer/teamleder i `role_page_permissions`.
- Lille test af synlighedsreglen (rettighed alene giver fanen; uden rettighed kræves egne salg).
- Kontrol: build, test, og visning som ejer i preview.
