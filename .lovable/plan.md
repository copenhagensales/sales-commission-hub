

## Fjern numre i parentes fra valgmuligheds-labels

### Ændring (kun `src/pages/TdcOpsummering.tsx`)

Fjern de afsluttende ` (n)` fra følgende `<Label>`-tekster:

- Linje 453: `Mobilevoice som MBB (1)` → `Mobilevoice som MBB`
- Linje 470: `Datadelingskort som MBB (2)` → `Datadelingskort som MBB`
- Linje 504: `uden router (3)` → `uden router`
- Linje 525: `Kun eksisterende/reserverede numre (4)` → `Kun eksisterende/reserverede numre`
- Linje 529: `Blanding af eksisterende og nye (5)` → `Blanding af eksisterende og nye`
- Linje 533: `Kun nye numre (6)` → `Kun nye numre`
- Linje 550: `Efter binding/opsigelsesperiode (7)` → `Efter binding/opsigelsesperiode`
- Linje 554: `Med ønskedato (8)` → `Med ønskedato`

Gælder alle tre varianter (Standard, Pilot, Kun 5g fri salg), da labels er delte.

### Ikke berørt
- Logik, værdier (`value="existing"` osv.), opsummeringstekst, oversættelser, øvrig UI.

### Filer berørt
- `src/pages/TdcOpsummering.tsx`

