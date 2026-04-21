

## Polish "English" toggle på TDC Opsummering (intern)

### Problem
Den nuværende switch ser visuelt malplaceret ud ved siden af de grønne radio-knapper — den bruger standard primary-farve uden grøn outline-stil, og labelen er på engelsk ("English") selvom UI'en ellers er dansk.

### Ændringer (kun `src/pages/TdcOpsummering.tsx`)

1. **Label-tekst**: `English` → `Engelsk`.

2. **Visuel stil på switchen** — match radio-knappernes grønne outline-look:
   - Brug inline `className` på `<Switch>` til at override farver:
     - Unchecked-state: transparent baggrund med grøn border (`border-2 border-primary bg-transparent`)
     - Checked-state: grøn fyld (`data-[state=checked]:bg-primary`)
     - Thumb: grøn når unchecked, hvid/baggrund når checked — så den matcher radio-prikkens visuelle sprog
   - Resultat: switchen ser ud som en "aflang radio-knap" der visuelt hører til samme gruppe.

3. **Wrapper-styling for bedre integration**:
   - Erstat `border-l border-border pl-4` med en blødere divider (samme højde som radio-rækken) eller tilføj `py-1` så switchen står lodret-centreret i forhold til radio-knapperne.
   - Tilføj `gap-2` mellem switch og label så afstanden matcher radio-knappernes spacing.

### Adfærd
- Uændret. `isEnglish`-state forbliver ren visuel toggle uden effekt på `summaryLines` indtil oversættelser leveres.

### Ikke berørt
- `src/components/ui/switch.tsx` — den globale switch-komponent ændres IKKE. Stil-overrides sker lokalt via `className`-prop, så andre switches i appen ikke påvirkes.
- `src/pages/TdcOpsummeringPublic.tsx` — paritet brydes fortsat med vilje.

### Filer berørt
- `src/pages/TdcOpsummering.tsx` (kun denne)

