# Tryg - Ret salg: placeholder virker igen (også med nummererede pladser)

## Hvad der er verificeret

Den gemte skabelon i databasen er nu:

```text
Hej Tryg,

Vil i annullerer følgende bookede møder:
[Telefonnummer1]
[Telefonnummer2]
```

Koden kender kun `[Telefonnummer]` (`PHONE_PLACEHOLDER`, `TrygEditSales.tsx:52`) og erstatter den én gang (linje 122 og 145). Derfor bliver `[Telefonnummer1]`/`[Telefonnummer2]` aldrig udskiftet — hverken ved kopiér pr. linje eller "Kopiér markerede".

## Hvad der bygges

Placeholder-håndteringen bliver fleksibel, så din tekst virker som skrevet:

1. Nummererede pladser `[Telefonnummer1]`, `[Telefonnummer2]`, ... udfyldes i rækkefølge med de markerede numre.
2. Er der markeret flere numre end der er nummererede pladser, tilføjes de resterende numre som ekstra linjer lige efter den sidste plads.
3. Er der markeret færre, fjernes de ubrugte placeholder-linjer helt (ingen tomme `[Telefonnummer3]` tilbage).
4. Almindelig `[Telefonnummer]` uden tal virker som før: ved kopiér pr. linje indsættes rækkens nummer, ved "Kopiér markerede" indsættes alle numre på hver sin linje.
5. Kopiér pr. linje udfylder første plads med rækkens nummer og fjerner de øvrige placeholder-linjer.
6. Hjælpeteksten i skabelon-boksen opdateres, så den nævner begge former: `[Telefonnummer]` eller `[Telefonnummer1]`, `[Telefonnummer2]` osv.

## Teknisk

- Kun `src/pages/reports/TrygEditSales.tsx` ændres.
- Ny lokal hjælpefunktion `fillPhonePlaceholders(template, phones)` med regex `/\[Telefonnummer(\d*)\]/g` som eneste kilde til udfyldningen; både kopiér pr. linje (ét nummer) og "Kopiér markerede" (flere numre) kalder den.
- Ubrugte placeholder-linjer fjernes linjevist, så omkringstående tekst og tomme linjer bevares.
- Ingen ændringer i data, hook, sletning, adgangskontrol eller beregninger.
