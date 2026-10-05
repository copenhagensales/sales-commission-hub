# Nyt valg: Opstart

## Hvad sælgeren får
- Ny sektion "Opstart *" med to valg: "Efter endt binding- og opsigelse" og "Ønskedato". Ingen er valgt fra start, så sælgeren skal vælge en af dem.
- Vælger man "Ønskedato", kommer der et datofelt, som skal udfyldes.

## I mailen
- **Efter endt binding:** Teksten er den samme som i dag ("Vi sørger for, at overflytningen af numrene sker når jeres nuværende bindings- og opsigelsesperiode er udløbet …").
- **Ønskedato:** Teksten skiftes ud med "Vi har aftalt, at numrene flyttes den [dato] eller hurtigst muligt herefter. Hvis det ligger før jeres nuværende udbyders bindings- eller opsigelsesperiode, kan de opkræve et gebyr for tidlig udtrædelse." Datoen skrives som fx "20. oktober 2026".

## Påkrævet
- Det røde felt viser "opstart" indtil der er valgt, og "ønskedato", hvis datoen mangler. Mailen vises og kan kopieres først derefter.

## Tekniske detaljer
- Kun `src/components/tdc-idriftsaettelse/TdcIdriftsaettelseForm.tsx` ændres: state `startMode: "" | "binding" | "date"` og `startDate`. `forloeb2` vælges ud fra `startMode`. Datoen er et `<Input type="date">`, og datoen formateres med date-fns `da`.
- Intet gemmes, og databasen ændres ikke.
