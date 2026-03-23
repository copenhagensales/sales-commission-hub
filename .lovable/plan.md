

# Fix: Upload annulleringsfil crasher

## Problem
Siden crasher med fejlen: *"A Select.Item must have a value prop that is not an empty string"*. Det sker fordi `<SelectItem value="">Ingen</SelectItem>` bruges til telefon- og virksomhedskolonne-vælgerne — Radix UI Select tillader ikke tom streng som value.

## Ændring

### `src/components/cancellations/UploadCancellationsTab.tsx`

- Erstat `<SelectItem value="">Ingen</SelectItem>` med `<SelectItem value="__none__">Ingen</SelectItem>` (2 steder: telefonkolonne og virksomhedskolonne)
- Opdater `phoneColumn`/`companyColumn` initialisering og `handleReset` til at bruge `"__none__"` som default
- Opdater `handleMatch` til at tjekke `phoneColumn !== "__none__"` i stedet for `!phoneColumn`

| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/UploadCancellationsTab.tsx` | Erstat tom streng med `"__none__"` sentinel-value i Select |

