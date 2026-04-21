
## Justér omstilling-toggle på Pilot (intern TDC Opsummering)

### Ændringer (kun `src/pages/TdcOpsummering.tsx`, kun når `summaryVariant === "pilot"`)

**1. Byt om på toggle-siderne**
- **Venstre label**: "Standard omstilling" (default/aktiv ved load)
- **Højre label**: "Professionel omstilling"
- Switch OFF (default) = Standard omstilling → `isStandardOmstilling = true`
- Switch ON = Professionel omstilling → `isStandardOmstilling = false`
- Aktiv label fremhæves (bold/primary), inaktiv dæmpes (`text-muted-foreground`).

**2. Fjern radio-valgene helt på Pilot**
- Når `isPilot === true`: skjul hele `RadioGroup`-blokken med "Omstilling inkluderet" / "Uden omstilling" (linje ~520-545).
- Sæt `hasOmstilling` permanent til `true` på Pilot (omstilling er altid inkluderet) og `noOmstilling` til `false`.
- Vis kun toggle-switchen (Standard ↔ Professionel) som eneste valgmulighed.
- På Standard- og 5g-fri-varianten: bevar nuværende radio-UI uændret.

**3. Genereret tekst (allerede korrekt logik)**
- Linjen *"I forhold til jeres omstilling og hvordan den skal virke..."* vises altid på Pilot.
- Linjen *"Hvis du får brug for menuvalg i fremtiden, så kan du altid opgradere din omstilling"* vises kun når `isStandardOmstilling === true` (Standard omstilling valgt).
- Når brugeren toggler til Professionel → `isStandardOmstilling = false` → menuvalg-linjen forsvinder automatisk fra output.

### Ikke berørt
- Standard- og 5g-fri-varianten (radio-UI bevares).
- `summaryLines`-genereringslogik røres ikke (eksisterende betingelser dækker behovet).
- `src/pages/TdcOpsummeringPublic.tsx` røres ikke.

### Filer berørt
- `src/pages/TdcOpsummering.tsx` (kun denne)
