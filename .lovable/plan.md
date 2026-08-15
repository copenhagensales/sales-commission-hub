# Ny boks: "Salg uden afvigelser"

## Mål
Under boksen med afvigelser på "Afvigelser — oversigt" tilføjes en ny boks, "Salg uden afvigelser", der viser de matchede salg hvor kampagne-reglen er opfyldt.

## Hvad vises
- Kun salg hvor mobilnummeret findes både i Stork og i de uploadede PowerBI-ark, og hvor kombinationen af internt produkt og PowerBI-kampagne er i orden (inkl. "5G Internet", hvor der ikke tjekkes kampagne).
- Excel-rækker uden match i Stork indgår ikke.
- Samme kolonner som afvigelsesboksen: Salgsdato, Sælger, Mobil, Tastselv, PB Kampagne, PB Operator, Kilde — men uden kolonnen "Afvigelse" og uden "Handlinger" (ren kontrol-visning).
- Boksen følger samme periode-, søge- og sælgerfilter som boksen ovenover, og sortering på Salgsdato/Sælger virker på samme måde.
- Antal rækker vises i boksens header, og der er en tom-tilstand ("Ingen salg uden afvigelser i perioden").
- Boksen vises kun på visningen "Afvigelser — oversigt", ikke på "Mangler i PowerBI".

## Teknisk
- `src/hooks/useEesyFmDeviations.ts`: i `deviations`-grenen samles nu også de konforme matches i en separat liste. Hooken returnerer `okRows: DeviationRow[]` ved siden af `rows` (samme rækkeform; `deviation` sættes til tom streng). Ingen nye queries — samme data, ét gennemløb.
- `src/pages/vagt-flow/EesyFmDeviations.tsx`: `DeviationsPanel` får en ekstra `Card` under den eksisterende tabel, som genbruger de samme filter-/sorterings-hjælpere på `okRows`. Kolonnelisten defineres som en variant af `OVERVIEW_COLUMNS` uden "Afvigelse" og "Handlinger".
- Zone: gul/grøn — read-only visning, ingen ændringer i DB, pricing eller løn.
