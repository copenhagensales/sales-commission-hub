

# 4 UI-forbedringer til Superligaen

## 1. Animated rank transitions (framer-motion)
Wrap hver `PlayerRow` / `SeasonPlayerRow` i en `motion.div` med `layoutId` baseret på `employee_id`, så spillere glider op/ned ved rangopdatering i stedet for at re-rendere instant.

**Filer:**
- `src/components/league/QualificationBoard.tsx` — import `motion` fra framer-motion, wrap `PlayerRow` output
- `src/components/league/ActiveSeasonBoard.tsx` — samme tilgang for `SeasonPlayerRow`
- `package.json` — tilføj `framer-motion` (allerede i projektet via shadcn)

**Detaljer:**
- Tilføj `<motion.div layout layoutId={standing.employee_id} transition={{ type: "spring", damping: 25, stiffness: 200 }}>` rundt om hver spillerrække
- Wrap hele listen i `<AnimatePresence>` for enter/exit
- Bevar eksisterende `memo` logik — framer-motion håndterer layout-animationen uafhængigt

---

## 2. Provision gap-indikator
Vis afstand til spilleren over og under i subtil tekst, f.eks. "↑ 1.250 kr" og "↓ 820 kr".

**Filer:**
- `src/components/league/QualificationBoard.tsx` — beregn gap i `PlayerRow`, vis under provision
- `src/components/league/ActiveSeasonBoard.tsx` — samme for `SeasonPlayerRow`

**Detaljer:**
- Send `prevProvision` og `nextProvision` som nye props til row-komponenten
- Vis i `text-[9px]` under provision-tallet:
  - `↑ X kr til #N` (afstand til spilleren foran)
  - Kun vis gap-indikatoren for den aktuelle bruger (`isCurrentUser`) for at undgå clutter

---

## 3. Hover-highlight hele rækken
Tilføj en synlig hover-effekt på hele rækken.

**Filer:**
- `src/components/league/QualificationBoard.tsx` — tilføj hover-klasser til row div
- `src/components/league/ActiveSeasonBoard.tsx` — samme

**Detaljer:**
- Tilføj `hover:bg-muted/30 cursor-default` til den ydre `div` i PlayerRow
- Tilføj `group` klasse og brug `group-hover:` til subtil border-glow:
  ```
  "hover:bg-muted/30 hover:shadow-[inset_0_0_0_1px_hsl(var(--border)/0.5)] transition-all duration-200"
  ```

---

## 4. Ret sparkline-alignment (forskudt grafer)
Sparklines er placeret i en `flex-1` container, men navnelængden skubber dem ud af alignment. Løsning: giv navn-kolonnen fast bredde.

**Filer:**
- `src/components/league/QualificationBoard.tsx` — ændr navn-kolonne fra `max-w-[180px]` til fast `w-[180px]`
- `src/components/league/ActiveSeasonBoard.tsx` — samme

**Detaljer:**
- Ændr `min-w-0 max-w-[180px] sm:max-w-[220px]` til `w-[180px] sm:w-[220px] shrink-0` på navn-div'en
- Dette sikrer at sparkline-containeren (`flex-1`) altid starter på samme x-position uanset navnelængde
- Sparklines vil herefter stå perfekt på linje

---

| Fil | Ændring |
|-----|---------|
| `QualificationBoard.tsx` | Alle 4 forbedringer |
| `ActiveSeasonBoard.tsx` | Alle 4 forbedringer |

