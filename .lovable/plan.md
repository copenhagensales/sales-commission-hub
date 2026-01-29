
# Tilføj datovælger til Fieldmarketing Dashboard

## Overblik
Tilføjer en datovælger i headerområdet af Fieldmarketing dashboardet, så brugere kan filtrere salgsdata til en specifik periode i stedet for kun at se faste perioder (i dag, denne uge, denne måned).

## Ændringer

### 1. Opdater FieldmarketingDashboardFull.tsx
- Tilføj en `dateRange` state med `useState` til at holde valgt periode
- Standard-værdi: "Denne måned" (fra månedens start til i dag)
- Placer `DashboardDateRangePicker` i `rightContent` prop på `DashboardHeader`
- Send `dateRange` ned til `ClientDashboard` komponenten

### 2. Opdater ClientDashboard komponenten
- Modtag `dateRange` som prop
- Brug valgt periode til at filtrere:
  - Sælger-tabellen (månedens sælgere → periodens sælgere)
  - "Seneste salg" tabellen
- KPI-kortene forbliver som de er (viser altid i dag/uge/måned) for hurtig sammenligning

### 3. Opdater hooks/queries
- Justér de eksisterende queries til at bruge det valgte datointerval
- `topSellers` og `todaySellers` queries skal filtrere på `dateRange.from` og `dateRange.to`

## UI Layout

```text
+-------------------------------------------------------+
| [CPH Sales Logo]  Fieldmarketing Dashboard     [Logo] |
|                                      [Datovælger 📅]  |
+-------------------------------------------------------+
| [Tab: Eesy FM] [Tab: YouSee]                          |
+-------------------------------------------------------+
| KPI: I dag | KPI: Uge | KPI: Måned | KPI: Total      |
+-------------------------------------------------------+
| Periodens sælgere (filtreret) | Dagens sælgere       |
+-------------------------------------------------------+
| Seneste salg (filtreret på periode)                  |
+-------------------------------------------------------+
```

## Tekniske detaljer

**Fil-ændringer:**
1. `src/pages/dashboards/FieldmarketingDashboardFull.tsx`
   - Import `DashboardDateRangePicker` og `DateRange` type
   - Tilføj `dateRange` state med default til denne måned
   - Send datovælger til header via `rightContent`
   - Send `dateRange` som prop til `ClientDashboard`

2. `ClientDashboard` i samme fil
   - Modtag `dateRange` som prop i interface
   - Opdatér `topSellers` query til at bruge `dateRange.from`/`dateRange.to`
   - Opdatér salg-tabellen til at filtrere på perioden
   - Opdatér kort-titlen "Månedens sælgere" → "Periodens sælgere"

**Kodeeksempel:**
```tsx
// State i hovedkomponenten
const [dateRange, setDateRange] = useState<DateRange | undefined>({
  from: startOfMonth(new Date()),
  to: new Date(),
});

// I DashboardHeader rightContent
<DashboardDateRangePicker 
  dateRange={dateRange} 
  onDateRangeChange={setDateRange} 
/>
```

## Brugerflow
1. Bruger åbner dashboardet → ser data for denne måned (default)
2. Bruger klikker på datovælger → vælger "Sidste 7 dage" eller custom periode
3. Sælger-tabellen og salg opdateres til at vise data for den valgte periode
4. KPI-kortene viser stadig "I dag", "Denne uge" osv. for hurtig sammenligning
