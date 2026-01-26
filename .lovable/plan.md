
# UI/UX Optimeringsplan: Hjemmeside Redesign

## Overordnet Vision
Transformer hjemmesiden fra en "informationsopslagstavle" til et **personligt performance dashboard** med fokus på hurtige handlinger og motivation.

---

## 1. Ny Informationsarkitektur

### Nuværende struktur (7+ sektioner)
```
Velkomst → Dit Overblik → Liga → Anerkendelser (4 kort) → Fødselsdage → Citat
```

### Ny struktur (3 primære zoner)
```
┌─────────────────────────────────────────────────────────┐
│  ZONE 1: Hero Performance (dit vigtigste tal + status) │
├─────────────────────────────────────────────────────────┤
│  ZONE 2: Hurtige Handlinger + Liga-position            │
├─────────────────────────────────────────────────────────┤
│  ZONE 3: Sekundært Indhold (kollapsibelt)              │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Zone 1: Ny "Hero Performance Card"

### Design
Erstat den statiske velkomsthilsen med et dynamisk performance-kort:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│     God morgen, Jonas! 🔥                              │
│                                                         │
│     ┌─────────────┐                                    │
│     │    142%     │  ← Stor, animeret tal              │
│     │  af dit mål │                                    │
│     └─────────────┘                                    │
│                                                         │
│     📈 18.450 kr provision denne periode               │
│     🏆 #15 i ligaen (↑3 siden i går)                   │
│                                                         │
│     "Du er foran dit snit - keep going!"               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Tekniske ændringer
- Kombiner data fra `YourOverview` og `LeaguePromoCard`
- Fjern separat "Dit overblik" kort
- Tilføj position-ændring (↑/↓) fra forrige dag

---

## 3. Zone 2: Quick Actions + Liga

### Venstre side: Kontekstuelle hurtige handlinger
Baseret på brugerens status:

| Status | Handling |
|--------|----------|
| Ingen mål sat | "Sæt dit mål for perioden →" |
| Under target | "Se hvordan du indhenter →" |
| På track | "Se dine næste milestones →" |
| Over target | "Del din succes →" |

### Højre side: Kompakt liga-visning
Behold den nye "din placering + 2 over/under" men i mere kompakt format:

```
┌─────────────────────────────┐
│ Din liga-position           │
│                             │
│ #14 Thomas B    18.800 kr   │
│ #15 Du          18.000 kr ← │
│ #16 Louise M    17.500 kr   │
│                             │
│ [Se fuld liga →]            │
└─────────────────────────────┘
```

---

## 4. Zone 3: Sekundært Indhold (Kollapsibelt)

### Redesign af anerkendelser
Reducer fra 4 kort til 1 smart komponent med tabs:

```
┌─────────────────────────────────────────┐
│ 🏆 Anerkendelser                        │
│                                         │
│ [Denne uge] [Sidste uge]  ← Tabs        │
│                                         │
│ Top Performer    │  Bedste Dag          │
│ Anna S - 45k    │  Peter L - 12k       │
│ (mandag)        │  (torsdag)           │
│                                         │
└─────────────────────────────────────────┘
```

### Fødselsdage og fejringer
Kun vis hvis der ER fødselsdage i dag (ellers skjul helt):

```
┌─────────────────────────────────────────┐
│ 🎂 Anna har fødselsdag i dag!           │
│                                         │
│ [Send lykønskning]                      │
└─────────────────────────────────────────┘
```

---

## 5. Dynamiske Motivationsbeskeder

Erstat det statiske Churchill-citat med kontekstuel motivation:

| Performance | Besked |
|-------------|--------|
| 0-50% af mål | "Hver samtale tæller - du bygger momentum!" |
| 50-80% af mål | "Du er på vej! X salg til næste milepæl" |
| 80-100% af mål | "Målstregen er i sigte - push through!" |
| 100-120% af mål | "Mål nået! Går du efter rekorden?" |
| 120%+ af mål | "Du er on fire 🔥 Top 3 venter!" |

---

## 6. Mobile-First Optimering

### Nuværende problem
- Lang vertikal scroll
- Små touch-targets
- Vigtig info "below the fold"

### Løsning
**Sticky hero-kort** der følger med ved scroll:

```
┌─────────────────────────┐
│ 142% │ #15 │ 18.450 kr │ ← Sticky mini-bar
├─────────────────────────┤
│                         │
│  [Resten af indholdet]  │
│                         │
└─────────────────────────┘
```

---

## 7. Implementeringsplan

### Fase 1: Hero Performance Card
**Filer:** `src/pages/Home.tsx`, ny `HeroPerformanceCard.tsx`

- Opret ny komponent der kombinerer velkomst + overblik
- Integrer liga-position direkte i hero
- Tilføj performance-baseret farvetema

### Fase 2: Quick Actions
**Filer:** Ny `QuickActionsBar.tsx`

- Kontekstuel CTA baseret på bruger-status
- Integreret med eksisterende routing

### Fase 3: Kollapsible sektioner
**Filer:** `src/pages/Home.tsx`, anerkendelser-komponenter

- Implementer Collapsible fra UI library
- Reducer 4 kort til 1 tabbed komponent
- Skjul fødselsdage hvis ingen i dag

### Fase 4: Dynamiske beskeder
**Filer:** Udvid `gamification-quotes.ts`

- Tilføj flere kontekstuelle beskeder
- Integrer med HeroPerformanceCard

### Fase 5: Mobile sticky header
**Filer:** `src/pages/Home.tsx`, CSS

- Implementer scroll-aware sticky mini-bar
- Test på forskellige skærmstørrelser

---

## 8. Før/Efter Sammenligning

### Desktop
| Før | Efter |
|-----|-------|
| 7+ separate sektioner | 3 fokuserede zoner |
| Statisk velkomst | Dynamisk performance-hero |
| 4 anerkendelseskort | 1 tabbed komponent |
| Statisk citat | Kontekstuel motivation |

### Mobile
| Før | Efter |
|-----|-------|
| Lang scroll (10+ screens) | Kompakt (3-4 screens) |
| Vigtig info skjult | Performance synlig altid |
| Ingen hurtige handlinger | Kontekstuel CTA top |

---

## 9. Tekniske hensyn

- **Eksisterende hooks:** Genbrug `useSalesGamification`, `useLeagueData`, `useCurrentEmployeeId`
- **Komponenter:** Brug eksisterende `Collapsible`, `Tabs` fra UI library
- **Performance:** Lazy-load sekundært indhold
- **Animationer:** Brug eksisterende `animate-fade-in` klasser
