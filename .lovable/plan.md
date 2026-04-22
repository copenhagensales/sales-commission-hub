

## Flyt DA/EN-toggle ind i "Opsummeringstype"-boksen

### Ændring (kun `src/pages/TdcOpsummering.tsx`)

1. **Fjern** DA/EN-toggle-blokken fra header-området (linjer 375-394) i øverste højre hjørne.
2. **Tilføj** DA/EN-toggle i `CardHeader` for "Opsummeringstype"-kortet (omkring linje 402-404):
   - Konvertér `CardHeader` til en flex-container (`flex flex-row items-center justify-between`) så `CardTitle` står i venstre side og DA/EN-pillen i højre side.
   - Genbrug eksisterende styling (`inline-flex items-center bg-muted/30 rounded-full p-1` med samme button-mapping) — kun placering ændres.
3. Header-rækken (linje ~365-395) reduceres til kun at vise ikon + titel + undertekst (justify-between kan blive til almindelig flex eller bevares uden højre-element).

### Ikke berørt
- `isEnglish`-state, oversættelseslogik, toast, øvrige toggles (Standard/Pilot/5g), validering.
- Funktionalitet — kun visuel placering.

### Filer berørt
- `src/pages/TdcOpsummering.tsx`

