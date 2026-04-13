

## Konsolidering af vagtlogik — Implementeringsplan

**Scope:** 2 nye filer + 1 DB-migration + 38 fil-opdateringer = 41 ændringer

**DB-status:** 0 dubletter i `employee_standard_shifts` — klar til UNIQUE constraint.

---

### Fase 1: DB-migration
UNIQUE constraint på `employee_standard_shifts.employee_id`

### Fase 2: Nye kernefiler
- **`src/lib/shiftResolution.ts`** — `resolveShiftForDay()`, `resolveShiftsForPeriod()`, `hasExistingShift()`
- **`src/hooks/useShiftResolution.ts`** — React Query wrapper med caching

Hierarki: Individuel vagt → Tildelt standardvagt → Ingen vagt (0 timer). Ingen weekday-fallback.

### Fase 3: Vagtadmin UI (2 filer)
`TeamStandardShifts.tsx`, `CreateShiftDialog.tsx` — fjern "speciel vagt", dobbelt-vagt-beskyttelse

### Fase 4: Vagtplan-visninger (4 filer)
`ShiftOverview.tsx`, `MySchedule.tsx`, `MyScheduleTabContent.tsx`, `VagtplanFMContent.tsx`

### Fase 5: Rapporter + kalender (4 filer)
`DailyReports.tsx`, `MissingShiftsAlert.tsx`, `EmployeeCommissionHistory.tsx`, `EmployeeCalendar.tsx` (7-dages visning)

### Fase 6: KPI & beregninger (5 filer)
`useEmployeeWorkingDays.ts`, `useKpiTest.ts`, `FormulaLiveTest.tsx`, `useEffectiveHourlyRate.ts`, `useDashboardKpiData.ts`

### Fase 7: Løn + profil (9 filer)
`useStaffHoursCalculation.ts`, `useAssistantHoursCalculation.ts`, `PayrollDayByDay.tsx`, `MyProfile.tsx`, `SalesGoalTracker.tsx`, `usePreviousPeriodComparison.ts`, `ClientDBTab.tsx`, `useSalesGamification.ts`, `DailyCommissionChart.tsx`

### Fase 8: Forecast + dashboards (4 filer)
`useTeamGoalForecast.ts`, `useClientForecast.ts`, `useDashboardSalesData.ts`, `CphSalesDashboard.tsx`

### Fase 9: FM dialoger + booking (5 filer)
`EditBookingDialog.tsx`, `AddEmployeeDialog.tsx`, `CapacityPanel.tsx`, `BookingsContent.tsx`, `useFmBookingConflicts.ts`

### Fase 10: Edge functions + docs (5 filer)
`calculate-kpi-values/index.ts`, `tv-dashboard-data/index.ts`, `parse-expense-formula/index.ts`, `_shared/date-helpers.ts`, `Logikker.tsx`

---

### Regler der overholdes
- Weekend-**styling** bevares (orange farver, chart-labels)
- Weekend-**filtrering** fjernes fra alle beregninger
- `useCalendarBooking.ts`, `usePersonalWeeklyStats.ts`, `MarketCalendarWidget.tsx` — uberørt
- Eksisterende bookinger uden vagt = flagges som konflikter, slettes ikke
- FM-tildeling blokeres uden vagt, booking-tider fra faktisk vagt (ikke hardcoded 09-17)

Starter med Fase 1+2, derefter fase for fase.

