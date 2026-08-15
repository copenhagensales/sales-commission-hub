# Fjern kolonnen "PB Produkt"

## Mål
Kolonnen "PB Produkt" fjernes fra tabellen under "Afvigelser — oversigt". Alle øvrige kolonner (Salgsdato, Sælger, Mobil, Afvigelse, Tastselv, PB Kampagne, PB Operator, Kilde) og selve afvigelses-logikken bevares uændret.

## Ændringer
`src/pages/vagt-flow/EesyFmDeviations.tsx`:
- Fjern `"PB Produkt"` fra `OVERVIEW_COLUMNS` (linje 96).
- Fjern den tilhørende `<TableCell>` der viser `row.powerBiProduct` (omkring linje 806).
- Behold `row.powerBiProduct` i fritekst-søgningen (linje 565), så man fortsat kan søge på PowerBI-produktet, eller fjern det hvis det ikke ønskes — default er at beholde det.

Ingen ændring i `useEesyFmDeviations.ts`: feltet beregnes stadig og bruges til produktsammenligningen bag "Afvigelse".
