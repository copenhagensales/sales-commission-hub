

# Plan: Daglig Provisions-Bar Chart (seneste 10 arbejdsdage)

## Oversigt

Erstat "Din uge" komponenten med et **interaktivt søjlediagram** der viser din provision per dag for de seneste 10 arbejdsdage. Dette giver sælgere visuel feedback på deres momentum og hjælper med mønstergenkendelse.

## Salgspsykologiske Fordele

| Princip | Effekt |
|---------|--------|
| **Momentum visualisering** | Sælgere motiveres af at SE deres mønster - ikke kun tal |
| **Pattern recognition** | Hjernen identificerer naturligt "gode dage" og vil genskabe dem |
| **Micro-wins** | Hver søjle er en synlig sejr der bygger selvtillid |
| **Comparative context** | Gennemsnitslinje viser om man er "over eller under" |
| **Loss aversion** | Lave søjler trigger "jeg vil ikke have flere af de dage" |

## Design

```text
┌─────────────────────────────────────────────────┐
│  📊 Dine seneste 10 dage     Snit: 1.485 kr/dag │
│                                                 │
│         ┌─┐                                     │
│       ┌─┤ │      ┌─┐       ┌─┐                  │
│       │ │ │  ────┤─│───────┤─│─── Gennemsnit    │
│   ┌─┐ │ │ │  ┌─┐ │ │ ┌─┐ ┌─┤ │ ●                │
│   │ │ │ │ │  │ │ │ │ │ │ │ │ │ │                │
│   └─┴─┴─┴─┴──┴─┴─┴─┴─┴─┴─┴─┴─┴─┘                │
│   Ma Ti On To Fr Ma Ti On To Fr                 │
│                              ↑                  │
│                           I dag                 │
│                                                 │
│   💪 Du har 4 dage over gennemsnittet!         │
└─────────────────────────────────────────────────┘
```

## Data-strategi: Brug Eksisterende Hook

I stedet for at hente fra `kpi_cached_values` (som ikke har daglige per-employee KPIs endnu), udvider vi **`usePersonalWeeklyStats`** hook'en til at returnere daglige breakdowns.

**Fordele:**
- Genbruger eksisterende datahentning og agent-mapping logik
- Ingen behov for nye KPI definitioner eller edge function ændringer
- Allerede bevist at fungere korrekt
- Returnerer data aggregeret per dag

## Teknisk Implementation

### 1. Udvid `usePersonalWeeklyStats` Hook

**Fil:** `src/hooks/usePersonalWeeklyStats.ts`

Tilføj en ny property til returdata der inkluderer daglige stats for de seneste ~14 dage (for at få 10 arbejdsdage):

```typescript
export interface DailyCommissionEntry {
  date: string;           // "2026-01-28"
  dayName: string;        // "Tir"
  commission: number;     // 2350
  isToday: boolean;       // true/false
  isWeekend: boolean;     // true for lørdag/søndag
}

export interface PersonalWeeklyData {
  currentWeek: PersonalWeekStats;
  lastWeek: PersonalWeekStats;
  dailyBreakdown: DailyCommissionEntry[];  // NY - seneste 14 dage
}
```

### 2. Ny Komponent: `DailyCommissionChart`

**Fil:** `src/components/home/DailyCommissionChart.tsx`

Recharts-baseret bar chart med:
- 10 søjler for arbejdsdage (filtrerer weekender ud)
- Grøn farve for dage over gennemsnit
- Neutral farve for dage under gennemsnit
- Accent-farve for "i dag"
- Horisontal gennemsnitslinje
- Motiverende tekst-feedback

### 3. Opdater Home.tsx

**Fil:** `src/pages/Home.tsx`

Erstat `PersonalRecognitions` med `DailyCommissionChart`:

```tsx
// Fra
<PersonalRecognitions
  currentWeek={personalWeeklyStats?.currentWeek || { weekTotal: 0, bestDay: null }}
  lastWeek={personalWeeklyStats?.lastWeek || { weekTotal: 0, bestDay: null }}
/>

// Til
<DailyCommissionChart
  dailyData={personalWeeklyStats?.dailyBreakdown || []}
/>
```

## Motivations-Elementer

Baseret på data vises dynamisk feedback:

| Scenarie | Tekst |
|----------|-------|
| 3+ dage over snit i træk | "🔥 Du er på en streak!" |
| Dagens søjle over snit | "💪 Stærk dag så langt!" |
| Under snit men trending op | "📈 Fin fremgang!" |
| Under snit | "💡 Tid til comeback!" |

## Filer der ændres

| Fil | Handling |
|-----|----------|
| `src/hooks/usePersonalWeeklyStats.ts` | Udvid med `dailyBreakdown` data |
| `src/components/home/DailyCommissionChart.tsx` | **NY** - Bar chart komponent |
| `src/pages/Home.tsx` | Erstat PersonalRecognitions med DailyCommissionChart |

## Resultat

Sælgeren får:
- **Visuel momentum-feedback** på deres seneste 10 arbejdsdage
- **Kontekst** via gennemsnitslinje
- **Motivation** via farver og dynamiske beskeder
- **Mønstergenkendelse** - hvilke dage performer de bedst?

