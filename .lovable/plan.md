

## Professionelt kontraktdesign med bedre layout og progress

### Overordnet tilgang
Redesigne `ContractSign.tsx` med tre fokusområder: bedre kontraktindhold-layout, visuelt redesign og progress/status overblik.

### 1. Progress/Status overblik (top)
Tilføj en visuel stepper under headeren der viser kontraktens flow:
- Step 1: "Kontrakt modtaget" (altid done)
- Step 2: "Gennemlæst" (done når bruger scroller til bunds)
- Step 3: "Accepteret" (done når checkbox er markeret)  
- Step 4: "Underskrevet" (done når signeret)

Implementeres som en horisontal stepper med ikoner, forbindelseslinjer og status-farver.

### 2. Visuelt redesign
- **Header-kort**: Tilføj en mere professionel header med tydeligere hierarki. Tilføj metadata-grid (udsendt dato, status, kontrakttype) i small pills/badges under titlen.
- **Kontraktindhold**: Indpak i et "papir"-lignende container med hvid/lys baggrund, subtil skygge, og en tynd venstre-border accent. Dette giver kontrast mod den mørke baggrund og ligner et rigtigt dokument.
- **Underskrift-kort**: Mere kompakt og elegant design med tidslinje-layout i stedet for listevisning.
- **Spacing**: Konsekvent brug af `space-y-8` og bedre padding.

### 3. Bedre kontraktindhold-layout
- Tilføj et **resumé-kort** øverst i kontrakten med nøgleinformation (medarbejder, stilling, startdato, løn) trukket fra kontraktens metadata — hvis data er tilgængelig.
- Behold den eksisterende prose-styling men tilføj en subtil sektionsnummerering via CSS counters.
- Tilføj en "Scroll ned for at underskrive" floating hint i bunden der forsvinder når underskriftssektionen er synlig.

### Teknisk implementering

**Fil**: `src/pages/ContractSign.tsx`

**Ændringer**:
1. Tilføj `ContractProgressStepper` komponent inline (4 steps med cirkel-ikoner og linjer)
2. Tilføj scroll-tracking via `IntersectionObserver` for at detektere om bruger har scrollet kontrakten igennem
3. Redesign header-sektionen med metadata-grid
4. Wrap kontraktindhold i papir-lignende container med `bg-white dark:bg-slate-900` og `shadow-2xl`
5. Tilføj floating "Scroll ned" indikator
6. Opdater underskrift-sektionen med tidslinje-design

Ingen database-ændringer. Ingen nye filer nødvendige — alt kan implementeres i den eksisterende fil.

