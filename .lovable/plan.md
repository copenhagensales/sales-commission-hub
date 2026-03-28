

## Erstat em-dash (—) med en-dash (–) i hele systemet

### Omfang

Der er **1.251 forekomster** af em-dash (`—`) fordelt på **95 filer**. De bruges i tre kontekster:

1. **UI-placeholders** — f.eks. `"—"` som tom-celle-indikator i tabeller
2. **Prosa/beskrivelser** — f.eks. `"inkl. godkendte annulleringer og kurvrettelser — inkl..."`  
3. **Kode-kommentarer** — f.eks. `// Check if a default config exists — if so, auto-match`

### Tilgang

Simpel find-and-replace: alle `—` (U+2014 em-dash) erstattes med `–` (U+2013 en-dash) i alle `.ts` og `.tsx` filer udenfor `node_modules` og `dist`.

### Filer (95 filer påvirket)
Alle filer med em-dash vil blive opdateret i én samlet operation. Ingen logikændringer — kun tegnudskiftning.

