
## Fjern dobbelt separator mellem Nummervalg og Tilskud på Pilot

### Problem
På Pilot skjules "Opstart"-blokken (linje 452-470), men begge omkringliggende `<Separator />` (linje 450 og 472) renderes stadig — det giver to linjer mellem Nummervalg og Tilskud.

### Ændring (kun `src/pages/TdcOpsummering.tsx`)
Gør separatoren på linje 472 betinget, så den kun renderes når Startup-blokken faktisk vises:

```tsx
{!isPilot && (numberChoice === "existing" || numberChoice === "mixed") && (
  <Separator />
)}
```

Dermed:
- **Pilot**: kun separator på linje 450 → én linje mellem Nummervalg og Tilskud.
- **Standard uden existing/mixed**: kun separator på linje 450 → én linje (ingen Opstart vises).
- **Standard med existing/mixed**: separator (450) + Opstart + separator (472) → korrekt adskillelse omkring Opstart.

### Filer berørt
- `src/pages/TdcOpsummering.tsx`

### Ikke berørt
- Indhold, state, øvrige separators, 5g-fri-variant, `TdcOpsummeringPublic.tsx`.
