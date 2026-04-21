
## Forkort labels på Pilot omstilling-toggle

### Ændring (kun `src/pages/TdcOpsummering.tsx`)
I Pilot-varianten af "Omstilling"-boksen, opdater labels på toggle-switchen:
- **Venstre label**: `Standard omstilling` → `Standard`
- **Højre label**: `Professionel omstilling` → `Professionel`

Ordet "omstilling" fjernes fra labels, da det allerede fremgår af boksens titel.

### Ikke berørt
- Toggle-adfærd, default-state og styling.
- Genereret tekst-output (uændret).
- Standard- og 5g-fri-varianten.
- `TdcOpsummeringPublic.tsx`.

### Filer berørt
- `src/pages/TdcOpsummering.tsx`
