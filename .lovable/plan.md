# Kolonner på "Mangler i PowerBI"

## Ændring
På visningen "Mangler i PowerBI" (under Oversigt-fanen):

- Fjern kolonnerne **Produkt** og **Type**.
- Tilføj en smal kolonne længst til **højre** uden overskrift, med en lille blyant-ikonknap på hver række/salg.

Ny kolonnerækkefølge:

```text
Salgsdato | Sælger | Mobil | Tastselv | [blyant]
```

Blyanten er indtil videre kun UI (ingen handling endnu). Når matching-logikken er færdig, bliver det her FM-lederen kan rette et salg — fx et forkert mobilnummer.

## Teknisk
- Fil: `src/pages/vagt-flow/EesyFmDeviations.tsx`
- Opdater `MISSING_COLUMNS` til `["Salgsdato", "Sælger", "Mobil", "Tastselv"]`.
- Tilføj i `DeviationsPanel` en valgfri "actions"-kolonne (kun aktiv for missing-visningen): tom `TableHead` til højre + `Button variant="ghost" size="icon"` med `Pencil`-ikon pr. række.
- Ingen ændring i "Afvigelser — oversigt" og ingen data-/backend-ændringer.
