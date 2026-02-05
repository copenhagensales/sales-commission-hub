
# Fase 4B: Udvidet Frontend Migration

## Fundne Duplikater der Kræver Migration

| Kategori | Antal Filer | Prioritet |
|----------|-------------|-----------|
| `countWorkDaysInPeriod` | 3 | Høj |
| Break-logik (30 min) | 6 | Høj |
| Afrunding `Math.round` | 6 | Medium |
| `STANDARD_MONTH_DAYS` | 1 | Medium |
| `formatPercentage` | 1 | Lav |

---

## Del 1: countWorkDaysInPeriod Migration (Høj prioritet)

### Nuværende Tilstand
Central funktion eksisterer i `src/lib/calculations/dates.ts`, men 3 filer har lokale kopier.

### Filer der skal opdateres

| Fil | Ændring |
|-----|---------|
| `useStaffHoursCalculation.ts` | Fjern lokal `countWorkDaysInPeriod` (linje 20-30), import fra `@/lib/calculations` |
| `MyProfile.tsx` | Erstat lokal `countWorkdays()` med `countWorkDaysInPeriod` fra `@/lib/calculations` |
| `CphSalesDashboard.tsx` | Erstat lokal `countWorkDaysInPeriod()` med central import |

### Eksempel: useStaffHoursCalculation.ts

**Før:**
```typescript
import { eachDayOfInterval, format, getDay, startOfMonth, endOfMonth } from "date-fns";

function countWorkDaysInPeriod(start: Date, end: Date): number {
  let count = 0;
  const days = eachDayOfInterval({ start, end });
  for (const day of days) {
    const dow = getDay(day);
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}
```

**Efter:**
```typescript
import { VACATION_PAY_RATES, calculateHoursFromShift, countWorkDaysInPeriod } from "@/lib/calculations";
// Fjern lokal countWorkDaysInPeriod funktion
```

---

## Del 2: Break-logik Centralisering (Høj prioritet)

### Problem
6 filer har hardcoded `rawHours > 6 ? 30 : 0` logik som duplikerer:

```typescript
const breakMinutes = rawHours > 6 ? 30 : 0;
```

### Løsning
Eksporter konstanter fra `hours.ts` og brug dem:

```typescript
import { BREAK_THRESHOLD_MINUTES, BREAK_DURATION_MINUTES } from "@/lib/calculations";

const breakMinutes = (rawHours * 60) > BREAK_THRESHOLD_MINUTES 
  ? BREAK_DURATION_MINUTES 
  : 0;
```

### Filer der skal opdateres

| Fil | Linje | Nuværende | Efter |
|-----|-------|-----------|-------|
| `EmployeeCommissionHistory.tsx` | 279 | `rawHours > 6 ? 30 : 0` | Brug konstanter |
| `useDashboardSalesData.ts` | 412 | `rawHours > 6 ? 30 : 0` | Brug konstanter |
| `FormulaLiveTest.tsx` | 999 | `hoursElapsed > 6 ? 30 : 0` | Brug konstanter |
| `useKpiTest.ts` | 1602, 2237 | `rawHours > 6 ? 30 : 0` | Brug konstanter |
| `DailyReports.tsx` | 786 | `rawHours > 6 ? 30 : 0` | Brug konstanter |
| `UnitedDashboard.tsx` | 301 | `hours > 6 ? 30 : 0` | Brug konstanter |

---

## Del 3: Afrundingsfunktion (Medium prioritet)

### Problem
`Math.round(value * 100) / 100` gentages 16+ gange på tværs af 6 filer.

### Løsning
Tilføj utility funktion til `formatting.ts`:

```typescript
/**
 * Rounds a number to specified decimal places.
 * @param value - Number to round
 * @param decimals - Decimal places (default: 2)
 */
export function roundToDecimals(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
```

### Filer der skal opdateres

| Fil | Antal steder |
|-----|--------------|
| `useEffectiveHourlyRate.ts` | 3 |
| `useDashboardSalesData.ts` | 2 |
| `useKpiTest.ts` | 6 |
| `FormulaLiveTest.tsx` | 3 |
| `DailyReports.tsx` | 2 |

---

## Del 4: STANDARD_MONTH_DAYS Konstant (Medium prioritet)

### Problem
`ClientDBTab.tsx` har hardcoded `const STANDARD_MONTH_DAYS = 30`.

### Løsning
Tilføj til `dates.ts`:

```typescript
/** Standard number of days in a month for proration calculations */
export const STANDARD_MONTH_DAYS = 30;
```

### Fil der skal opdateres
- `ClientDBTab.tsx`: Fjern lokal konstant, import fra `@/lib/calculations`

---

## Del 5: formatPercentage Migration (Lav prioritet)

### Fil
- `StaffSalary.tsx`: Erstat lokal `formatPercentage` med import fra `@/lib/calculations`

---

## Implementeringsrækkefølge

### Step 1: Tilføj manglende utilities (5 min)
1. Tilføj `roundToDecimals()` til `formatting.ts`
2. Tilføj `STANDARD_MONTH_DAYS` til `dates.ts`
3. Eksporter begge fra `index.ts`

### Step 2: countWorkDaysInPeriod (15 min)
1. `useStaffHoursCalculation.ts` - fjern lokal, import central
2. `MyProfile.tsx` - erstat lokal funktion
3. `CphSalesDashboard.tsx` - erstat lokal funktion

### Step 3: Break-logik (20 min)
1. Opdater alle 6 filer til at bruge `BREAK_THRESHOLD_MINUTES` og `BREAK_DURATION_MINUTES`

### Step 4: Afrunding og formatering (15 min)
1. Opdater filer til at bruge `roundToDecimals()`
2. `StaffSalary.tsx` - brug central `formatPercentage`
3. `ClientDBTab.tsx` - brug central `STANDARD_MONTH_DAYS`

---

## Forventet Resultat

| Metrik | Før | Efter |
|--------|-----|-------|
| `countWorkDaysInPeriod` kopier | 4 | 1 central |
| Break-logik (hardcoded) | 6 filer | 1 central |
| Afrunding `Math.round(...*100)/100` | 16+ steder | 1 funktion |
| `STANDARD_MONTH_DAYS` | 1 lokal | 1 central |
| `formatPercentage` | 2 lokale | 1 central |

---

## Tekniske Bemærkninger

### Breaking Changes: Ingen
Alle ændringer er refactoring - ingen funktionalitetsændringer.

### Tests
Eksisterende tests i `hours.test.ts` og `vacation-pay.test.ts` dækker allerede:
- `BREAK_THRESHOLD_MINUTES` (360)
- `BREAK_DURATION_MINUTES` (30)
- Break-beregning for vagter >6 timer

### Tidsestimat
| Del | Estimat |
|-----|---------|
| Del 1: countWorkDaysInPeriod | 15 min |
| Del 2: Break-logik | 20 min |
| Del 3: roundToDecimals | 15 min |
| Del 4: STANDARD_MONTH_DAYS | 5 min |
| Del 5: formatPercentage | 5 min |
| **Total** | **1 time** |
