

## Redesign "Opsummeringstype"-boks med pill-segmenter (TDC Opsummering intern)

### Layout-ændringer (kun øverste del af `src/pages/TdcOpsummering.tsx`)

Match screenshot-designet:

**1. Header-rækken** (linje 277-283 + flyt sprog-toggle hertil)
- Behold ikon + titel + undertekst til venstre.
- Tilføj **DA/EN segmented pill** i højre side af header-rækken (samme `flex justify-between`-række).
- Pill-design: pillformet container med to "fane"-knapper. Aktiv = grøn fyld (`bg-primary text-primary-foreground`), inaktiv = transparent grå tekst (`text-muted-foreground`).
- **Default: "DA" aktiv** (`isEnglish = false`).
- Klik på "DA" → `setIsEnglish(false)`, klik på "EN" → `setIsEnglish(true)`.

**2. "Opsummeringstype"-kortet** (linje 289-324)
- Fjern den nuværende `RadioGroup` og fjern den separate Switch-blok (sprog-toggle flyttes til header).
- Erstat med en **segmented pill button group** der visuelt matcher DA/EN-toggle (blot bredere med 3 valg):
  - Container: pillformet baggrund (`bg-muted/30 rounded-lg p-1 inline-flex`).
  - 3 knapper: "Standard", "Pilot", "Kun 5g fri salg".
  - Aktiv knap: grøn fyld + hvid tekst (`bg-primary text-primary-foreground`).
  - Inaktiv knap: transparent + dæmpet tekst (`text-muted-foreground hover:text-foreground`).
  - Bredde: hver knap `flex-1` så de fylder kortets bredde jævnt (matcher screenshot).

**3. State + adfærd**
- `summaryVariant`-state bevares uændret (`"standard" | "pilot" | "5g-fri"`).
- `isEnglish`-state bevares uændret — bare flyttet visuelt til header.
- Etiketterne i UI'en forbliver på dansk indtil oversættelser leveres (toggle er stadig ren visuel).
- Al downstream-logik (`isPilot`, `kun5gFriSalg`, `summaryLines`) røres IKKE.

### Implementation
- Brug almindelige `<button>`-elementer med `cn()` og `onClick` (ingen ny shadcn-komponent nødvendig).
- Importér `cn` hvis ikke allerede importeret.
- Fjern ubrugte importer (`RadioGroup`, `RadioGroupItem`, `Switch`) hvis de ikke bruges andetsteds i filen — verificeres ved implementation.

### Filer berørt
- `src/pages/TdcOpsummering.tsx` (kun denne — public-version forbliver urørt)

### Ikke berørt
- `src/components/ui/switch.tsx`, `src/components/ui/radio-group.tsx` — globale komponenter ændres ikke.
- `src/pages/TdcOpsummeringPublic.tsx` — paritet brydes fortsat med vilje.
- Resten af siden (Valgfrie sektioner, output-panel, validering).

