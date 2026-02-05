
# Fase 4: Frontend Migration til Central Calculations Library

## Status Oversigt

| Fase | Status |
|------|--------|
| Fase 1: Shared Edge Function Modules | ✅ Komplet |
| Fase 2: Frontend Utility Library | ✅ Komplet |
| Fase 3: Migration af Edge Functions | ✅ Komplet |
| **Fase 4: Migration af Frontend Komponenter** | ❌ I gang |

---

## Fase 4 - Detaljeret Migrationsplan

### Del 1: Vacation Pay Migration (8 filer)

Erstat hardcoded vacation pay rates med import fra `@/lib/calculations`:

| Fil | Nuværende Kode | Ny Kode |
|-----|----------------|---------|
| `useStaffHoursCalculation.ts` | `const VACATION_PAY_RATE = 0.125` | `import { VACATION_PAY_RATES } from '@/lib/calculations'` |
| `useAssistantHoursCalculation.ts` | `const ASSISTANT_VACATION_PAY_RATE = 0.125` | `import { VACATION_PAY_RATES } from '@/lib/calculations'` |
| `ClientDBTab.tsx` | `const SELLER_VACATION_RATE = 0.125; const LEADER_VACATION_RATE = 0.01` | `import { VACATION_PAY_RATES } from '@/lib/calculations'` |
| `ClientDBDailyBreakdown.tsx` | `const SELLER_VACATION_RATE = 0.125` | `import { VACATION_PAY_RATES } from '@/lib/calculations'` |
| `Home.tsx` | `if (employee.vacation_type === 'vacation_pay') return 0.125` | `import { getVacationPayRate } from '@/lib/calculations'` |
| `MyProfile.tsx` | `const vacationPayRate = 0.125` | `import { VACATION_PAY_RATES } from '@/lib/calculations'` |
| `RevenueByClient.tsx` | `totalCommission * 0.125` | `import { calculateVacationPay } from '@/lib/calculations'` |
| `HeroStatusCard.tsx` | `projectedFinal * 0.125` | `import { VACATION_PAY_RATES } from '@/lib/calculations'` |

---

### Del 2: Hours Calculation Migration (2 filer)

Erstat duplikeret `calculateHoursFromShift()` med central funktion:

| Fil | Nuværende | Ændring |
|-----|-----------|---------|
| `useStaffHoursCalculation.ts` | Lokal `calculateHoursFromShift()` (linje 256-275) | Fjern lokal, import fra `@/lib/calculations` |
| `useAssistantHoursCalculation.ts` | Lokal `calculateHoursFromShift()` (linje 231-250) | Fjern lokal, import fra `@/lib/calculations` |

Den centrale funktion i `src/lib/calculations/hours.ts` håndterer:
- Parsing af HH:mm og HH:mm:ss format
- Overnight shifts (når endTime < startTime)
- 30-minutters pause ved vagter over 6 timer
- Afrunding til 2 decimaler

---

### Del 3: Formatting Migration (28 filer - Lav Prioritet)

28 filer har lokale `formatCurrency()` funktioner. Disse skal migreres til:

```typescript
import { formatCurrency } from '@/lib/calculations';
```

**Højest prioriterede filer** (bruges i payroll/DB beregninger):
1. `ClientDBTab.tsx`
2. `ClientDBDailyBreakdown.tsx`
3. `SellerSalariesTab.tsx`
4. `CombinedSalaryTab.tsx`
5. `TeamExpensesTab.tsx`
6. `DBDailyBreakdown.tsx`

**Øvrige filer** (kan migreres senere):
- `HeadToHeadComparison.tsx`
- `DailyCommissionChart.tsx`
- `HeroPulseWidget.tsx`
- `EmployeeCommissionHistory.tsx`
- `LeagueAdminDashboard.tsx`
- `ChurnCalculator.tsx`
- `EesyTmDashboard.tsx`
- `TdcErhvervDashboard.tsx`
- `UnitedDashboard.tsx`
- `CsTop20Dashboard.tsx`
- `SalesDashboard.tsx`
- `TeamLeaderSalary.tsx`
- `AssistantSalary.tsx`
- `GoalProgressRing.tsx`
- + 13 andre filer

---

## Implementeringsrækkefølge

### Step 1: Vacation Pay (Høj prioritet)
1. Opdater `useStaffHoursCalculation.ts` - erstat konstant
2. Opdater `useAssistantHoursCalculation.ts` - erstat konstant
3. Opdater `ClientDBTab.tsx` - erstat begge konstanter
4. Opdater `ClientDBDailyBreakdown.tsx` - erstat konstant
5. Opdater `Home.tsx` - brug `getVacationPayRate()`
6. Opdater `MyProfile.tsx` - brug konstant
7. Opdater `RevenueByClient.tsx` - brug `calculateVacationPay()`
8. Opdater `HeroStatusCard.tsx` - brug konstant

### Step 2: Hours Calculation (Høj prioritet)
1. Opdater `useStaffHoursCalculation.ts` - fjern lokal funktion, import central
2. Opdater `useAssistantHoursCalculation.ts` - fjern lokal funktion, import central

### Step 3: Formatting (Lav prioritet - kan gøres inkrementelt)
1. Start med payroll-relaterede filer (6 stk)
2. Derefter dashboard-filer efter behov

---

## Tekniske Ændringer

### Eksempel: useStaffHoursCalculation.ts

**Før:**
```typescript
const VACATION_PAY_RATE = 0.125; // 12.5%

// ... senere i filen ...
const vacationPay = baseSalary * VACATION_PAY_RATE;

// ... og lokal funktion ...
function calculateHoursFromShift(startTime: string, endTime: string): number {
  // 20 linjer kode
}
```

**Efter:**
```typescript
import { VACATION_PAY_RATES, calculateHoursFromShift } from '@/lib/calculations';

// ... senere i filen ...
const vacationPay = baseSalary * VACATION_PAY_RATES.STAFF;

// Lokal calculateHoursFromShift() funktion FJERNET
```

### Eksempel: Home.tsx

**Før:**
```typescript
const vacationPayRate = useMemo(() => {
  if (!employee?.vacation_type) return 0;
  if (employee.vacation_type === 'vacation_pay') return 0.125;
  if (employee.vacation_type === 'vacation_bonus') return 0.01;
  return 0;
}, [employee?.vacation_type]);
```

**Efter:**
```typescript
import { getVacationPayRate } from '@/lib/calculations';

const vacationPayRate = useMemo(() => {
  return getVacationPayRate(employee?.vacation_type || null);
}, [employee?.vacation_type]);
```

---

## Forventet Resultat Efter Fase 4

| Metrik | Før | Efter |
|--------|-----|-------|
| Vacation pay konstanter | 8 filer | 1 central (`vacation-pay.ts`) |
| calculateHoursFromShift() | 2 kopier | 1 central (`hours.ts`) |
| formatCurrency() | 28 filer | 1 central (`formatting.ts`) |
| Vedligeholdelse | Ændringer i mange filer | Ændringer ét sted |

---

## Tidsestimat for Fase 4

| Del | Estimat |
|-----|---------|
| Del 1: Vacation Pay (8 filer) | 30-45 min |
| Del 2: Hours Calculation (2 filer) | 15-20 min |
| Del 3: Formatting (28 filer) | 1-2 timer (kan gøres inkrementelt) |
| **Total Fase 4** | **2-3 timer** |

---

## Anbefaling

Start med **Del 1 + Del 2** (vacation pay + hours) da disse er højest prioritet og direkte påvirker lønberegninger. Formatting (Del 3) kan migreres inkrementelt over tid.
