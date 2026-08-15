# Kolonner på "Mangler i PowerBI"

## Ændring
På visningen "Mangler i PowerBI" (under Oversigt-fanen):

- Fjern kolonnerne **Produkt** og **Type**.
- Tilføj en ny kolonne **Ret salg** som den første (længst til venstre).

Ny kolonnerækkefølge:

```text
Ret salg | Salgsdato | Sælger | Mobil | Tastselv
```

"Ret salg" er indtil videre kun en tom kolonne (pladsholder). Når matching-logikken er færdig, bliver det her FM-lederen kan rette et salg — fx et forkert mobilnummer.

## Teknisk
- Fil: `src/pages/vagt-flow/EesyFmDeviations.tsx`
- Opdater `MISSING_COLUMNS` til `["Ret salg", "Salgsdato", "Sælger", "Mobil", "Tastselv"]`.
- Ingen ændring i "Afvigelser — oversigt" og ingen data-/backend-ændringer.
