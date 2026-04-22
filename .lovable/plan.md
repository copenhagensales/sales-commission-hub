

## Fix toggle-orientering for dark mode

### Problem
Lige nu er switchen `checked={isDarkTheme}`. Default `true` betyder at thumb står til højre (mod solen), men aktiverer dark mode → forvirrende.

### Løsning (kun `src/pages/TdcOpsummering.tsx`)
Inverter switch-bindingen så "off" (thumb venstre, ved måne) = dark mode (default), og "on" (thumb højre, ved sol) = light mode.

Konkret:
- Switch: `checked={!isDarkTheme}` og `onCheckedChange={(v) => setIsDarkTheme(!v)}`.
- Beholder `useState(true)` for `isDarkTheme` → switchen starter som "off" (venstre, ved måne-ikonet) og preview vises i dark mode som ønsket.
- Ikonerne forbliver: `Moon` venstre, `Sun` højre — matcher nu thumb-position korrekt.

### Filer berørt
- `src/pages/TdcOpsummering.tsx` (kun switch-bindingen omkring linje 637-639).

