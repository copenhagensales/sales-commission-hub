# United-salg: skjul salg uden telefonnummer

## Hvad der bygges
- Markeringsboks øverst på fanen "United-salg" ved søgefeltet: **"Skjul salg uden telefonnummer"**, slået til som standard.
- Når den er slået til, vises kun salg med et telefonnummer (fx forsvinder de fleste automatiske Lederne-salg). Slås den fra, vises alle salg som i dag.
- Virker sammen med telefonsøgningen og datovælgeren. Nulstilles ikke ved dagsskift.
- Kun på United-fanen; Kanvas-møder og "Alle tryg & alka salg" er uændrede.

## Teknisk
- Kun `src/pages/reports/TrygEditSales.tsx`.
- Ny state `hideNoPhone` (default `true`); udvid United-`useMemo` (linje ~274) med filter `!hideNoPhone || !!s.customerPhone?.trim()`.
- `Checkbox` + `Label` fra `components/ui` i United-headeren.
- Ren visning — ingen ændringer i data, hooks, sletning, ret-dialog, adgang eller DB.
