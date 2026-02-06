
# Plan: Datovælger til alle Dashboards ✅ IMPLEMENTERET

## Status: Færdig

Implementeret dato: 6. februar 2026

---

## Hvad blev implementeret

### 1. DashboardPeriodSelector komponent
Placering: `src/components/dashboard/DashboardPeriodSelector.tsx`

**Features:**
- Dropdown med presets: I dag, I går, Denne uge, Sidste 7 dage, Denne måned, Lønperiode
- "Brugerdefineret..." åbner kalender for at vælge custom periode (2 måneder synlige)
- Viser valgt periode i knappen
- Returnerer `{ type, from, to, label }`
- Hjælpefunktioner: `getDefaultPeriod()`, `mapPeriodTypeToCache()`, `canUseCachedKpis()`

### 2. Dashboard-opdateringer

| Dashboard | Status | Notes |
|-----------|--------|-------|
| CsTop20Dashboard | ✅ | Fuld integration med hybrid caching + custom period queries |
| RelatelDashboard | ✅ | Period selector tilføjet i header |
| TdcErhvervDashboard | ✅ | Period selector tilføjet i header |
| EesyTmDashboard | ✅ | Period selector tilføjet i header |
| UnitedDashboard | ✅ | Period selector tilføjet i header |
| CphSalesDashboard | ⏭️ | Har allerede sin egen DashboardDateRangePicker |
| FieldmarketingDashboardFull | ⏭️ | Allerede implementeret |

### 3. Data-strategi (hybrid tilgang)
- **Standard-perioder** (today, this_week, this_month, payroll_period): Bruger cached KPIs fra `kpi_leaderboard_cache`
- **Custom-perioder** (yesterday, last_7_days, custom dates): Direkte database-forespørgsler

---

## Teknisk detaljer

### PeriodSelection interface
```typescript
type PeriodType = "today" | "yesterday" | "this_week" | "last_7_days" | "this_month" | "payroll_period" | "custom";

interface PeriodSelection {
  type: PeriodType;
  from: Date;
  to: Date;
  label: string;
}
```

### Brug
```tsx
const [selectedPeriod, setSelectedPeriod] = useState<PeriodSelection>(() => getDefaultPeriod("payroll_period"));

<DashboardHeader 
  title="Dashboard Title" 
  rightContent={
    <DashboardPeriodSelector
      selectedPeriod={selectedPeriod}
      onPeriodChange={setSelectedPeriod}
      disabled={tvMode} // Hide in TV mode
    />
  }
/>
```
