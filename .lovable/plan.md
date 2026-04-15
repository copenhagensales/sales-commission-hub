

# Fix: "Tom fil" ved Excel-upload

## Problem
`parseWithExcelJS` bruger `wb.getWorksheet(1)` som henter worksheet efter **ID**, ikke efter position. Hvis Excel-filen har et worksheet med ID ≠ 1 (f.eks. efter kopiering/redigering), returnerer ExcelJS `undefined`. Funktionen returnerer da `{ rows: [], columns: [] }` — uden at kaste en fejl. Dermed trigges SheetJS-fallbacken aldrig, og systemet viser "Tom fil".

## Løsning
Ændr `wb.getWorksheet(1)` til `wb.worksheets[0]` som altid henter det første worksheet uanset ID.

## Ændring

### `src/utils/excel.ts` — linje 83
Fra:
```ts
const ws = wb.getWorksheet(1);
```
Til:
```ts
const ws = wb.worksheets[0];
```

Én linje ændres. Ingen andre filer berørt.

