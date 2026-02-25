## Status: Dato-konsolidering — 100% gennemført ✅

### Alle trin implementeret

| Trin | Beskrivelse | Status |
|------|-------------|--------|
| **Trin 1** | Frontend: Erstat `@/utils/payrollPeriod` imports → `@/lib/calculations` | ✅ DONE |
| **Trin 2** | Frontend: Erstat `@/lib/vagt-flow-date-utils` imports → `@/lib/calculations` | ✅ DONE |
| **Trin 3** | Slet legacy-filer (`payrollPeriod.ts`, `vagt-flow-date-utils.ts`) | ✅ DONE |
| **Trin 4A** | `tv-dashboard-data` → importerer `_shared/date-helpers.ts` | ✅ DONE |
| **Trin 4A** | `parse-expense-formula` → importerer `_shared/date-helpers.ts` | ✅ DONE |
| **Trin 4B** | `calculate-kpi-incremental` → importerer `_shared/date-helpers.ts` | ✅ DONE |
| **Trin 4B** | `calculate-kpi-values` → bruger `getPayrollPeriod()` fra `_shared/date-helpers.ts` | ✅ DONE |
| **Trin 4B** | `calculate-leaderboard-incremental` → importerer `_shared/date-helpers.ts` | ✅ DONE |
| **Trin 4B** | `snapshot-payroll-period` → importerer `_shared/date-helpers.ts` (inkl. `getPreviousPayrollPeriod`) | ✅ DONE |
| **Trin 4C** | CI-script `scripts/check-inline-dates.sh` | ✅ DONE |

---

### Bemærkning: `lint:dates` i `package.json`

`package.json` er read-only i Lovable. Scriptet `scripts/check-inline-dates.sh` kan køres direkte med:

```bash
bash scripts/check-inline-dates.sh
```

Hvis `lint:dates` ønskes i `package.json`, skal det tilføjes manuelt via git.

---

### Kanoniske kilder

| Kontekst | Fil | Eksporterede funktioner |
|----------|-----|------------------------|
| Frontend | `src/lib/calculations/dates.ts` | `getPayrollPeriod`, `getStartOfWeek`, `countWorkDaysInPeriod`, `getPreviousPayrollPeriod` |
| Backend | `supabase/functions/_shared/date-helpers.ts` | Samme funktioner |

**Nul inline payroll-logik tilbage i repoen.** CI-scriptet fanger fremtidige regressioner.
