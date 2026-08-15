# Kolonnetitel over blyanten

## Hvad
I tabellerne under "Eesy FM afvigelser (Leder)" står blyant-knappen i en kolonne uden overskrift. Den får titlen "Ret salg", så det er tydeligt hvad ikonet gør.

## Teknisk
- `src/pages/vagt-flow/EesyFmDeviations.tsx`, linje 325: den tomme `<TableHead className="w-12" />` erstattes med en overskrift med teksten "Ret salg" (højrestillet, `whitespace-nowrap`, lidt bredere kolonne).
- Ingen ændring i data, hooks eller logik — kun præsentation. Gælder både Afvigelser-, Mangler i PowerBI- og Claims/Reimport-visningen, hvor `showRowActions` er slået til.
