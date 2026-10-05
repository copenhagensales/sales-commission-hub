# TDC Opsummering – ny type "Ny implementeringsopsummering"

Ny fjerde knap i "Opsummeringstype" ved siden af Standard, Pilot og Kun 5g fri salg.

## Første version
- Teksten er en præcis kopi af Pilot-teksten (dansk og engelsk).
- Felter, krav og det røde "Udfyld venligst"-felt opfører sig som ved Pilot (fx Omstilling-kontakten Standard/Avanceret, ingen krav om opstart).
- Pilot ændres ikke.
- Gælder både den interne side og den offentlige version, da de deler samme formular.

Derefter retter vi teksten til linje for linje, som du ønsker.

## Teknisk
- `src/lib/tdcOpsummering/generateSummary.ts`: udvid `SummaryVariant` med `"implementering"`; egen tekstgren, foreløbig kopieret fra pilot-grenene (linje 165 og 253), så senere rettelser ikke rammer Pilot.
- `src/components/tdc-opsummering/TdcOpsummeringForm.tsx`: ny knap "Ny implementeringsopsummering"; Pilot-lignende UI-logik (`isPilot`-tjek) udvides til også at gælde den nye type.
- Ingen database, ingen rettigheder, ingen rød-zone-filer.
