

## UI-forbedringer for Salgsligaen -- Komplet plan

Baseret på en grundig gennemgang af koden identificerer jeg 5 konkrete forbedringer der vil gøre siden markant pænere og mere motiverende.

---

### 1. Hero Header med gradient, glow og motiverende tagline

**Fil:** `CommissionLeague.tsx` (linje 284-315)

**Nu:** Flad header med plain `Trophy`-ikon og tekst uden visuel "wow-faktor".

**Forbedring:**
- Wrap headeren i en gradient-baggrund (`bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950`)
- Tilføj en glowing pulse-animation på trophy-ikonet via CSS keyframe
- Tilføj motiverende tagline under sæson-info (f.eks. "Kaemp dig til toppen!") fra `gamification-quotes.ts`
- Afrundede hjørner og subtle border-glow

```text
┌─────────────────────────────────────────────┐
│  ✨ [Glowing Trophy]  Saeson 1   [Fan]      │
│  Runde ? (i gang) · 61 spillere             │
│  "Kaempf dig til toppen!"                   │
│  Landstraener: Oscar Belcher  [Countdown]   │
└─────────────────────────────────────────────┘
```

**Teknisk:** Gradient-klasser, ny `@keyframes trophy-glow` i `index.css`, random tagline fra `gamification-quotes.ts`.

---

### 2. Forbedret Countdown med progress-bar og urgency-effekt

**Fil:** `QualificationCountdown.tsx`

**Nu:** 4 flade blokke (dage/timer/min/sek) uden kontekst for "hvor langt er vi".

**Forbedring:**
- Tilfoej en progress-bar under countdown der viser `(elapsed / total) * 100%`
- Pulserende glow-effekt naar der er < 2 dage tilbage
- Props udvides med `startDate` saa progress kan beregnes

**Teknisk:** Ny prop `startDate`, beregn progress, conditional `animate-pulse` klasse paa wrapper.

---

### 3. Prize Cards med shimmer, gradient-borders og lock-overlay

**Fil:** `PrizeShowcase.tsx`

**Nu:** Flade kort med solid borders. Ingen visuel forskel mellem "laast" og "aaben" tilstand.

**Forbedring:**
- Top 3-kortet: Subtle guld-gradient baggrund, CSS shimmer-sweep animation
- De 3 special-kort: Gradient-borders (conic-gradient trick), hover-scale effekt
- Naar saesonen ikke er startet: Lock-ikon overlay med blur/opacity
- Naar data er tilgaengeligt: Kort "popper" ind med scale-animation

**Teknisk:** Ny `@keyframes shimmer` i `index.css`, `hover-scale` klasse (allerede i CSS), conditional lock-overlay.

---

### 4. "Din Position" highlight-kort med motiverende besked

**Fil:** `MyQualificationStatus.tsx`

**Nu:** Funktionelt kort med rank, division og stats -- men visuelt diskret og uden motivation.

**Forbedring:**
- Stoerre, mere prominent rank-visning med gradient-baggrund baseret paa zone
- Motiverende besked fra `gamification-quotes.ts` baseret paa zone (groen = "Du er paa vej op!", roed = "Kaempf dig fri!")
- Animated number for rank (CSS `number-animate` klasse eksisterer allerede)
- Tilfoej en "rival-info" sektion: "Du er X kr fra naeste plads"

```text
┌──────────────────────────────────────┐
│  #12 i Salgsligaen    Division 1     │
│  ████████████░░░  85.000 kr          │
│  "Du er taet paa toppen – push!"     │
│  Naeste plads: 2.300 kr foran dig    │
└──────────────────────────────────────┘
```

**Teknisk:** Zone-baserede gradient-klasser, import `getContextualMotivation` fra `gamification-quotes.ts`, rival-beregning fra standings-data.

---

### 5. Standings med mini progress-bars og bedre visuel hierarki

**Fil:** `QualificationBoard.tsx` (PlayerRow, linje 148-261)

**Nu:** Ren tekst med provision-belob. Svaert at se "gabet" mellem spillere visuelt.

**Forbedring:**
- Tilfoej en tynd baggrunds-bar bag provision der viser `provision / maxProvision * 100%`
- Bedre visuelt hierarki: Stoerre skrift for top-3, subtle fade for lavere placeringer
- Tilfoej en subtle separator-animation mellem zoner

**Teknisk:** Beregn `maxProvision` i parent og send som prop. Render en `div` med `width: X%` bag provision-vaerdien.

---

### Opsummering

| # | Forbedring | Filer | Svaerhedsgrad |
|---|-----------|-------|---------------|
| 1 | Hero gradient + glow + tagline | `CommissionLeague.tsx`, `index.css` | Let |
| 2 | Countdown med progress-bar | `QualificationCountdown.tsx` | Let |
| 3 | Prize cards shimmer + lock | `PrizeShowcase.tsx`, `index.css` | Medium |
| 4 | "Din Position" med motivation | `MyQualificationStatus.tsx` | Medium |
| 5 | Standings mini progress-bars | `QualificationBoard.tsx` | Let |

Alle aendringer er rent frontend/UI. Ingen database- eller backend-aendringer. Eksisterende `gamification-quotes.ts` genbruges for motiverende beskeder.

