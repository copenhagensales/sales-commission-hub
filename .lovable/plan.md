
# Plan: Datovælger til alle Dashboards

## Oversigt
Tilføj en ensartet datovælger-komponent til alle dashboards, der giver mulighed for at vælge mellem foruddefinerede perioder (I dag, I går, Denne uge, Denne måned, Lønperiode) samt en brugerdefineret periode via kalender.

---

## Arkitektur

### Data-strategi (hybrid tilgang)
Dashboards bruger i dag **pre-computed KPIs** fra `kpi_cached_values` og `kpi_leaderboard_cache`, som kun understøtter faste perioder:
- today
- this_week
- this_month
- payroll_period

For at understøtte **brugerdefinerede perioder** implementeres en hybrid tilgang:
- **Standard-perioder**: Brug cached KPIs (hurtig, <50ms)
- **Custom-perioder**: Fallback til direkte database-forespørgsler

---

## Komponenter

### 1. Ny universel komponent: `DashboardPeriodSelector`
Placering: `src/components/dashboard/DashboardPeriodSelector.tsx`

**Features:**
- Dropdown med presets: I dag, I går, Denne uge, Sidste 7 dage, Denne måned, Lønperiode
- "Brugerdefineret..." åbner kalender for at vælge custom periode
- Viser valgt periode i knappen
- Returnerer `{ from, to, periodType, isCustom }`

```text
┌─────────────────────────────────────────────────┐
│ 📅 I dag ▼                                      │
├─────────────────────────────────────────────────┤
│ • I dag                                         │
│ • I går                                         │
│ • Denne uge                                     │
│ • Sidste 7 dage                                 │
│ • Denne måned                                   │
│ • Lønperiode                                    │
│ ─────────────────────────────────               │
│ 📅 Brugerdefineret...                           │
└─────────────────────────────────────────────────┘
```

### 2. Custom hook: `useDashboardData`
Placering: `src/hooks/useDashboardData.ts`

Håndterer den hybride datahentning:
```typescript
function useDashboardData(options: {
  clientId?: string;
  teamId?: string;
  periodType: "today" | "this_week" | "this_month" | "payroll_period" | "custom";
  customPeriod?: { from: Date; to: Date };
}) {
  // Hvis standard periode: brug cached KPIs
  // Hvis custom periode: hent direkte fra database
}
```

---

## Dashboard-opdateringer

### Dashboard 1: RelatelDashboard
Fil: `src/pages/RelatelDashboard.tsx`

Ændringer:
- Tilføj `DashboardPeriodSelector` i header
- Tilføj state for valgt periode
- Opdater data-hentning til at bruge valgt periode
- KPI-kort viser data for valgt periode (ikke dag/uge/måned separat)

### Dashboard 2: EesyTmDashboard
Fil: `src/pages/EesyTmDashboard.tsx`

Samme ændringer som Relatel.

### Dashboard 3: TdcErhvervDashboard
Fil: `src/pages/TdcErhvervDashboard.tsx`

Samme ændringer som Relatel.

### Dashboard 4: UnitedDashboard
Fil: `src/pages/UnitedDashboard.tsx`

Samme ændringer som Relatel.

### Dashboard 5: CsTop20Dashboard
Fil: `src/pages/CsTop20Dashboard.tsx`

Samme ændringer - global leaderboard med valgbar periode.

### Dashboard 6: CphSalesDashboard
Fil: `src/pages/dashboards/CphSalesDashboard.tsx`

Allerede har date picker for "Salg per opgave". Udvid til at påvirke hele dashboardet.

### Dashboard 7: FieldmarketingDashboardFull
Fil: `src/pages/dashboards/FieldmarketingDashboardFull.tsx`

Allerede implementeret - ingen ændringer nødvendige.

---

## Teknisk implementering

### DashboardPeriodSelector interface
```typescript
interface DashboardPeriodSelectorProps {
  selectedPeriod: PeriodSelection;
  onPeriodChange: (period: PeriodSelection) => void;
  showNavArrows?: boolean; // Pil til forrige/næste periode
}

interface PeriodSelection {
  type: "today" | "yesterday" | "this_week" | "last_7_days" | "this_month" | "payroll_period" | "custom";
  from: Date;
  to: Date;
  label: string;
}
```

### Presets konfiguration
```typescript
const PERIOD_PRESETS = [
  { type: "today", label: "I dag", getValue: () => ({ from: startOfDay(now), to: now }) },
  { type: "yesterday", label: "I går", getValue: () => ({ from: startOfDay(subDays(now,1)), to: endOfDay(subDays(now,1)) }) },
  { type: "this_week", label: "Denne uge", getValue: () => ({ from: startOfWeek(now), to: endOfWeek(now) }) },
  { type: "last_7_days", label: "Sidste 7 dage", getValue: () => ({ from: subDays(now,6), to: now }) },
  { type: "this_month", label: "Denne måned", getValue: () => ({ from: startOfMonth(now), to: endOfMonth(now) }) },
  { type: "payroll_period", label: "Lønperiode", getValue: () => getPayrollPeriod(now) },
];
```

---

## Berørte filer

| Fil | Handling |
|-----|----------|
| `src/components/dashboard/DashboardPeriodSelector.tsx` | **Ny** - Universel periode-vælger |
| `src/hooks/useDashboardData.ts` | **Ny** - Hybrid data hook |
| `src/pages/RelatelDashboard.tsx` | Tilføj period selector |
| `src/pages/EesyTmDashboard.tsx` | Tilføj period selector |
| `src/pages/TdcErhvervDashboard.tsx` | Tilføj period selector |
| `src/pages/UnitedDashboard.tsx` | Tilføj period selector |
| `src/pages/CsTop20Dashboard.tsx` | Tilføj period selector |
| `src/pages/dashboards/CphSalesDashboard.tsx` | Udvid eksisterende picker |

---

## UI-eksempel efter implementation

```text
┌──────────────────────────────────────────────────────────────────┐
│  Relatel – Overblik                           [📅 Lønperiode ▼]  │
├──────────────────────────────────────────────────────────────────┤
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐             │
│  │ 45 Salg  │ │ 12.500 kr│ │ 28.000 kr│ │ 0.85/t   │             │
│  │ I alt    │ │ Provision│ │ Omsætning│ │ Salg/time│             │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Top sælgere (valgt periode)                                 ││
│  │ ...                                                         ││
│  └─────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

---

## Fase-opdeling

**Fase 1**: Opret `DashboardPeriodSelector` komponent
**Fase 2**: Opret `useDashboardData` hook med hybrid logik
**Fase 3**: Opdater hvert dashboard (et ad gangen for at sikre stabilitet)
