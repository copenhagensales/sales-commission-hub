

## Dark mode som standard på TDC Opsummering

### Ændring (kun `src/pages/TdcOpsummering.tsx`)

1. Ændre initial state: `useState(false)` → `useState(true)` for `isDarkTheme`. Gælder automatisk alle tre varianter (Standard, Pilot, Kun 5g fri salg), da samme preview-felt deles.
2. Bytte rundt på ikonerne i toggle-rækken (linje 637-639):
   - Venstre ikon: `Moon` (aktiv-tilstand til venstre = dark)
   - Højre ikon: `Sun` (light til højre)
   - Switch'en forbliver bundet til `isDarkTheme`, så `checked = true` (default) = dark mode.

Brugeren kan stadig slå over til light mode ved at klikke på switchen.

### Ikke berørt
- `TdcOpsummeringPublic.tsx` (jf. tidligere instruks om kun TDC Erhverv-editoren).
- Font-size, copy-funktion, summary-generering, varianter.

### Filer berørt
- `src/pages/TdcOpsummering.tsx`

