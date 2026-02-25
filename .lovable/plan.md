

## Status: Hvad er gjort, og hvad mangler?

### Allerede implementeret

| Trin | Beskrivelse | Status |
|------|-------------|--------|
| **Trin 1** | Frontend: Erstat `@/utils/payrollPeriod` imports → `@/lib/calculations` | **DONE** — filen `src/utils/payrollPeriod.ts` er slettet, ingen imports refererer til den |
| **Trin 2** | Frontend: Erstat `@/lib/vagt-flow-date-utils` imports → `@/lib/calculations` | **DONE** — filen er slettet, ingen imports refererer til den |
| **Trin 3** | Slet legacy-filer | **DONE** — begge filer er væk |
| **Trin 4A** | `tv-dashboard-data` → importerer `_shared/date-helpers.ts` | **DONE** — importerer `getStartOfWeek`, `getPayrollPeriod` |
| **Trin 4A** | `parse-expense-formula` → importerer `_shared/date-helpers.ts` | **DONE** — importerer `getPayrollPeriod`, `countWorkDaysInPeriod` |
| **Trin 4B** | `calculate-kpi-incremental` → importerer `_shared/date-helpers.ts` | **DONE** |
| **Trin 4B** | `calculate-leaderboard-incremental` → importerer `_shared/date-helpers.ts` | **DONE** |
| **Trin 4B** | `snapshot-payroll-period` → importerer `_shared/date-helpers.ts` (inkl. `getPreviousPayrollPeriod`) | **DONE** |
| **Trin 4C** | CI-script `scripts/check-inline-dates.sh` | **DONE** — scriptet eksisterer og fanger `day|currentDay|d >= 15` |

---

### Det der mangler (2 ting)

#### 1. Én sidste inline-rest i `calculate-kpi-values/index.ts` (linje 1741-1745)

Filen importerer allerede `getPayrollPeriod` fra `_shared/date-helpers.ts` (linje 2), men **bruger den ikke** i funktionen `countActiveAndRecentSellers` (linje ~1740). Der ligger stadig en inline-kopi:

```ts
const day = now.getDate();
const payrollStart = day >= 15
  ? new Date(year, month, 15)
  : new Date(year, month - 1, 15);
```

**Fix:** Erstat med `const { start: payrollStart } = getPayrollPeriod(now);` og slet de 4 overflødige linjer.

Dette er den **eneste** rest af inline payroll-logik i hele repoen (bekræftet via grep). CI-scriptet ville fange den.

#### 2. `lint:dates` mangler i `package.json`

CI-scriptet `scripts/check-inline-dates.sh` eksisterer, men der er ingen `lint:dates`-kommando i `package.json`, så det kan ikke køres via `npm run lint:dates`.

**Fix:** Tilføj `"lint:dates": "bash scripts/check-inline-dates.sh"` i `scripts`-sektionen af `package.json`.

---

### Teknisk opsummering

- **1 linje inline-logik** fjernes i `calculate-kpi-values/index.ts`
- **1 script-reference** tilføjes i `package.json`
- Herefter er hele den 4-trins plan **100% gennemført**

