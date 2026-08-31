# Tryg - Ret salg: søgefelt på telefonnummer

## Hvad der bygges

1. Et søgefelt øverst i kortet (til venstre for "Kopiér markerede"/datovælgeren) med placeholder "Søg telefonnummer".
2. Tabellen filtreres live, mens du skriver: kun linjer hvis telefonnummer indeholder de indtastede cifre vises.
3. Søgningen ignorerer mellemrum, bindestreger og landekode (`+45`, `0045`, `45` foran), så både "2970 9099" og "+4529709099" finder samme linje.
4. Ryd-knap (lille kryds) i feltet, og feltet nulstilles ved skift af dag.
5. "Kopiér markerede" bruger fortsat kun de markerede numre — markeringer bevares selv om en linje skjules af søgningen, så du ikke mister et valg ved at søge videre.
6. Tom søgning uden resultater viser "Ingen salg matcher søgningen".

## Teknisk

- Kun `src/pages/reports/TrygEditSales.tsx` ændres.
- Ny state `phoneSearch`; `Input` fra `@/components/ui/input`.
- Filtrering i en `useMemo` over `sales` med en lille normaliseringshjælper (fjerner alt ikke-cifret og et evt. `45`-præfiks) brugt på både rækkens nummer og søgestrengen.
- Tabellen renderes fra den filtrerede liste; `selectedPhones` beregnes fortsat ud fra hele `sales`-listen, så markeringer på skjulte linjer stadig tælles med.
- `useEffect` nulstiller `phoneSearch` ved skift af `day`.

Ingen ændringer i data, hooks, sletning, skabelon eller adgangskontrol — udelukkende visning.
