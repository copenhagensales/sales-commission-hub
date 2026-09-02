# Flyt "Send til Tryg"-knappen op til periode-linjen

## Hvad ændres
- Knappen fjernes fra tabelhovedet (over "Handlinger") på fanen "Afviste salg".
- Den placeres i stedet på samme linje som periodevælgeren ("Periode: Fra/Til + hurtigvalg"), skubbet helt ud til højre.
- Knappen gøres større og mere tydelig (normal knapstørrelse i stedet for den lille variant).
- Vises stadig kun på fanen "Afviste salg", og er deaktiveret når der ingen afviste numre er i perioden.
- Antal afviste numre bevares i knapteksten, og dialogen/mailen er uændret.

## Teknisk
- `src/pages/reports/TrygEditSales.tsx`: periode-linjen wrappes i en flex-container med `justify-between`, hvor knappen ligger til højre (kun for "Afviste salg"-fanen). `headerAction`-prop droppes for denne tabel. Knappen får `size="default"` / større højde og ikon.
- `src/components/reports/TrygSalesTable.tsx`: `headerAction`-prop bliver ubrugt — den fjernes for at undgå skyggekode (ingen andre kald bruger den).

Kun UI/præsentation. Ingen ændringer i salgsdata, status-lagring, RLS, pricing eller løn.
