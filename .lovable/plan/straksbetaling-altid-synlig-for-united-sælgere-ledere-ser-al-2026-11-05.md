# Straksbetaling: altid synlig for United-sælgere, ledere ser alle

## Hvad ændres
1. **Synlighed**
   - United-sælgere (rettighed til fanen + primær kundetilknytning til ASE/United) ser altid fanen, også uden salg den dag.
   - Ejere og teamleder (rettigheden "se alle sælgeres salg", allerede givet til ejer og teamleder) ser den altid, som i dag.
   - Kravet om "egne salg med straksbetaling" fjernes som betingelse for at vise fanen.
2. **Sælgere ser kun egne salg** (som i dag: matcher deres egne agent-mails). Tom liste viser "Du har ingen ASE-salg i perioden".
3. **Ejere/teamleder: valgt periode**
   - Periodevælger øverst (Denne lønperiode · Seneste 30 dage · Brugerdefineret fra/til). Standard: seneste 30 dage.
   - Viser alle Uniteds sælgeres ASE-salg i perioden med sælgerkolonne og søgning.
   - De kan tilføje/annullere straksbetaling på sælgerens vegne. Eksisterende regel bevares: kun salg fra indeværende måned kan ændres; ældre vises gråt med begrundelse.
4. Sælgere får ikke periodevælger (fast 30 dage), så deres visning er uændret.

## Uændret
Satser, prisregler, pricing-motor, provisionsberegning, rettighedsnøgler, Fieldmarketing (ASE FM), data.

## Kendt begrænsning (ikke del af denne ændring)
Salg uden en prisregel med straksbetaling (fx dagens "Salg"/"Lønsikring" indlæst med faste satser) vises fortsat ikke. Kræver særskilt beslutning om prisregler.

## Teknisk
- `src/lib/straksbetalingSynlighed.ts` + test: `synlig = seAlle || (fane && erUnitedSaelger)`; tests for de tre tilfælde.
- `useMitArbejdeSynlighed.ts`: erstat `useHasImmediatePaymentSales` med lille hook, der læser egen primære kundetilknytning (`employee_client_assignments`, client = `CLIENT_IDS["Ase"]`) via React Query; ingen hardkodet person/rolle.
- `ImmediatePaymentASE.tsx`: periode-state (kun når `seAlle`), `gte/lte` på `sale_datetime`, queryKey inkl. periode; sælgerfilter uændret.
- Sælgerbegrænsningen er i dag kun i klienten; adgang til andres salg styres af eksisterende RLS på `sales` — ingen RLS-ændring.
- Ingen migrationer, ingen backendfunktioner, ingen afsendelser. Typecheck/tests/build; visuel kontrol 360/393/430/1280.
