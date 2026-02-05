
# Fase 4: Frontend Migration til Central Calculations Library

## Status Oversigt

| Fase | Status |
|------|--------|
| Fase 1: Shared Edge Function Modules | ✅ Komplet |
| Fase 2: Frontend Utility Library | ✅ Komplet |
| Fase 3: Migration af Edge Functions | ✅ Komplet |
| Fase 4: Migration af Frontend Komponenter | ✅ Komplet |
| **Test og Verifikation** | ✅ Komplet |

---

## Fase 4 - Komplet

### Del 1: Vacation Pay Migration (8 filer) ✅

Alle hardcoded vacation pay rates er erstattet med import fra `@/lib/calculations`:

| Fil | Status |
|-----|--------|
| `useStaffHoursCalculation.ts` | ✅ `VACATION_PAY_RATES.STAFF` |
| `useAssistantHoursCalculation.ts` | ✅ `VACATION_PAY_RATES.ASSISTANT` |
| `ClientDBTab.tsx` | ✅ `VACATION_PAY_RATES.SELLER` + `.LEADER` |
| `ClientDBDailyBreakdown.tsx` | ✅ `VACATION_PAY_RATES.SELLER` |
| `Home.tsx` | ✅ `getVacationPayRate()` |
| `MyProfile.tsx` | ✅ `VACATION_PAY_RATES.SELLER` |
| `RevenueByClient.tsx` | ✅ `calculateVacationPay()` |
| `HeroStatusCard.tsx` | ✅ `VACATION_PAY_RATES.SELLER` |

---

### Del 2: Hours Calculation Migration (2 filer) ✅

Duplikeret `calculateHoursFromShift()` er fjernet og erstattet med central import:

| Fil | Status |
|-----|--------|
| `useStaffHoursCalculation.ts` | ✅ Lokal funktion fjernet, importerer fra `@/lib/calculations` |
| `useAssistantHoursCalculation.ts` | ✅ Lokal funktion fjernet, importerer fra `@/lib/calculations` |

---

### Del 3: Formatting Migration (28 filer - Lav Prioritet)

Ikke implementeret i denne fase. Kan migreres inkrementelt i fremtiden.

---

## Test og Verifikation ✅

36 unit tests bestået:
- `vacation-pay.test.ts`: 9 tests (rates, getVacationPayRate, calculateVacationPay)
- `hours.test.ts`: 27 tests (shift beregning, pauser, overnight, timestamps)

---

## Resultat

| Metrik | Før | Efter |
|--------|-----|-------|
| Vacation pay konstanter | 8+ filer | 1 central (`vacation-pay.ts`) |
| calculateHoursFromShift() | 2 kopier | 1 central (`hours.ts`) |
| Edge Function pricing logic | 4+ kopier | 1 central (`pricing-service.ts`) |
| Vedligeholdelse | Ændringer i mange filer | Ændringer ét sted |
| Unit tests | 0 | 36 |

---

## Central Library Oversigt

### Backend (`supabase/functions/_shared/`)
- `pricing-service.ts` - Provision & omsætning med fallback hierarki
- `date-helpers.ts` - Periode-beregninger
- `format-helpers.ts` - Formattering

### Frontend (`src/lib/calculations/`)
- `vacation-pay.ts` - VACATION_PAY_RATES, getVacationPayRate(), calculateVacationPay()
- `hours.ts` - calculateHoursFromShift(), parseTimeToMinutes()
- `dates.ts` - Periode-helpers
- `formatting.ts` - formatCurrency(), formatNumber()
- `index.ts` - Re-exports alle
