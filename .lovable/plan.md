
# Plan: Centraliseret Beregnings-Arkitektur (Unified Calculation Services)

## Executive Summary

En grundig analyse af kodebasen afslører **6 hovedområder** med fragmenteret og duplikeret beregningslogik, hvilket forårsager inkonsistens, vedligeholdelsesproblemer og fejl som Yousee's manglende omsætning. Denne plan foreslår en centraliseret arkitektur med delte services.

---

## Identificerede Problemområder

### 1. Provision & Omsætning (17+ steder)

**Problem**: Beregning af commission og revenue sker på 17+ forskellige steder med inkonsistent logik.

| Lokation | Implementering | Problem |
|----------|----------------|---------|
| `calculate-kpi-values` (Edge) | `fetchFmCommissionMap()` bruger KUN `product_pricing_rules` | Yousee FM = 0 kr |
| `calculate-kpi-incremental` (Edge) | Separat version af `fetchFmCommissionMap()` | Inkonsistent |
| `calculate-leaderboard-incremental` (Edge) | Tredje version | Inkonsistent |
| `tv-dashboard-data` (Edge) | `fmPricingMap` - fjerde implementering | Inkonsistent |
| `HeadToHeadComparison.tsx` | Bruger GAMMEL `product_campaign_overrides` | Deprecated |
| `RevenueByClient.tsx` | Bruger GAMMEL `product_campaign_overrides` | Deprecated |
| `DailyRevenueChart.tsx` | Bruger GAMMEL `product_campaign_overrides` | Deprecated |
| `EmployeeCommissionHistory.tsx` | Direkte `products.commission_dkk` | Mangler rules |

**Root Cause**: FM-produkter (Yousee) har priser i `products` tabellen, men Edge Functions kigger kun i `product_pricing_rules`.

---

### 2. Feriepenge-Beregning (9+ steder)

**Problem**: Feriepenge-satser er hardcoded på mindst 9 forskellige steder med varierende logik.

| Fil | Konstant | Værdi |
|-----|----------|-------|
| `useStaffHoursCalculation.ts` | `VACATION_PAY_RATE` | 0.125 (12.5%) |
| `useAssistantHoursCalculation.ts` | `ASSISTANT_VACATION_PAY_RATE` | 0.125 (12.5%) |
| `ClientDBTab.tsx` | `SELLER_VACATION_RATE` | 0.125 (12.5%) |
| `ClientDBTab.tsx` | `LEADER_VACATION_RATE` | 0.01 (1%) |
| `ClientDBDailyBreakdown.tsx` | `SELLER_VACATION_RATE` | 0.125 (12.5%) |
| `Home.tsx` | Inline beregning | 0.125 eller 0.01 |
| `MyProfile.tsx` | Inline beregning | 0.125 |
| `RevenueByClient.tsx` | Inline beregning | 0.125 |
| `useSellerSalariesCached.ts` | Via `salary_types` tabel | Dynamisk lookup |

**Inkonsistens**: Nogle steder bruger hardcoded værdier, andre bruger dynamiske lookups fra `salary_types` tabellen.

---

### 3. Timer-Beregning (6+ steder)

**Problem**: Logik for at beregne arbejdstimer fra vagter/stemplinger er duplikeret.

| Fil | Funktion | Logik |
|-----|----------|-------|
| `useStaffHoursCalculation.ts` | `calculateHoursFromShift()` | Parser HH:mm, 30 min pause ved >6t |
| `useAssistantHoursCalculation.ts` | `calculateHoursFromShift()` | Identisk kopi |
| `useKpiTest.ts` | `calculateHoursFromTimes()` | Lignende men med break_minutes param |
| `useEffectiveHourlyRate.ts` | Inline beregning | Bruger `differenceInMinutes` |
| `VagtplanFMContent.tsx` | Inline beregning | Direkte parse af tider |
| `ShiftOverview.tsx` | Inline beregning | Direkte parse af tider |

**Inkonsistens**: Pausehåndtering varierer mellem funktioner.

---

### 4. Periode-Beregning (26+ steder)

**Problem**: Payroll periode (15.-14.) og andre datoperioder beregnes på mange steder.

| Kategori | Antal steder |
|----------|--------------|
| `getPayrollPeriod()` i Edge Functions | 4 |
| `calculatePayrollPeriod()` i frontend | 5+ |
| `getDateRange()` funktioner | 10+ |
| `getStartOfDay/Week/Month` helpers | 15+ |

**Inkonsistens**: Alle Edge Functions har deres egen kopi af dato-helpers.

---

### 5. Formattering (33+ steder)

**Problem**: `formatCurrency()`, `formatValue()`, `formatNumber()` er defineret lokalt i 33+ filer.

```typescript
// Eksempel: Samme funktion i 33+ filer
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("da-DK", { 
    style: "currency", 
    currency: "DKK", 
    maximumFractionDigits: 0 
  }).format(amount);
```

---

### 6. Arbejdsdage-Beregning (8+ steder)

**Problem**: `countWorkDays()` og lignende funktioner er duplikeret.

| Fil | Funktion |
|-----|----------|
| `useStaffHoursCalculation.ts` | `countWorkDaysInPeriod()` |
| `TeamPerformanceTabs.tsx` | `getWorkDays()`, `getPossibleWorkDays()` |
| `useEffectiveHourlyRate.ts` | `isWeekend()` check i loop |
| `PayrollPeriodSelector.tsx` | Inline beregning |

---

## Løsningsarkitektur

### Fase 1: Shared Edge Function Modules

Opret centrale moduler i `supabase/functions/_shared/`:

```text
supabase/functions/_shared/
├── pricing-service.ts      ← Provision & omsætning
├── date-helpers.ts         ← Periode-beregninger
├── format-helpers.ts       ← Formattering
└── shift-helpers.ts        ← Timer-beregninger (fremtidig)
```

**Fil 1: `pricing-service.ts`**

```typescript
// Unified pricing lookup with fallback hierarchy
export async function getFmPricingMap(supabase: SupabaseClient) {
  const map = new Map<string, PricingInfo>();

  // 1. Load ALL products with base prices
  const { data: products } = await supabase
    .from("products")
    .select("id, name, commission_dkk, revenue_dkk");

  for (const product of products || []) {
    if (product.name && (product.commission_dkk || product.revenue_dkk)) {
      map.set(product.name.toLowerCase(), {
        commission: product.commission_dkk || 0,
        revenue: product.revenue_dkk || 0,
        source: 'product_base',
      });
    }
  }

  // 2. Override with active pricing rules (higher priority)
  const { data: rules } = await supabase
    .from("product_pricing_rules")
    .select("product:products!inner(name), commission_dkk, revenue_dkk")
    .eq("is_active", true);

  for (const rule of rules || []) {
    const name = (rule.product as any)?.name?.toLowerCase();
    if (name) {
      map.set(name, {
        commission: rule.commission_dkk || 0,
        revenue: rule.revenue_dkk || 0,
        source: 'pricing_rule',
      });
    }
  }

  return map;
}
```

**Fil 2: `date-helpers.ts`**

```typescript
export function getStartOfDay(date: Date): Date { ... }
export function getStartOfWeek(date: Date): Date { ... }
export function getStartOfMonth(date: Date): Date { ... }
export function getPayrollPeriod(date: Date): { start: Date; end: Date } { ... }
export function countWorkDaysInPeriod(start: Date, end: Date): number { ... }
```

**Fil 3: `format-helpers.ts`**

```typescript
export function formatCurrency(value: number): string { ... }
export function formatValue(value: number, category: string): string { ... }
export function formatDisplayName(fullName: string): string { ... }
```

---

### Fase 2: Frontend Utility Library

Opret `src/lib/calculations/`:

```text
src/lib/calculations/
├── index.ts               ← Re-exports
├── pricing.ts             ← Frontend pricing helpers
├── vacation-pay.ts        ← Feriepenge-konstanter og beregninger
├── dates.ts               ← Periode-helpers
├── hours.ts               ← Timer-beregninger
└── formatting.ts          ← Formattering
```

**Fil: `vacation-pay.ts`**

```typescript
// Central source of truth for vacation pay rates
export const VACATION_PAY_RATES = {
  SELLER: 0.125,        // 12.5% for sælgere
  ASSISTANT: 0.125,     // 12.5% for assistenter
  STAFF: 0.125,         // 12.5% for stab
  LEADER: 0.01,         // 1% for teamledere
} as const;

export function getVacationPayRate(
  vacationType: 'vacation_pay' | 'vacation_bonus' | null
): number {
  if (vacationType === 'vacation_pay') return VACATION_PAY_RATES.SELLER;
  if (vacationType === 'vacation_bonus') return VACATION_PAY_RATES.LEADER;
  return 0;
}

export function calculateVacationPay(
  commission: number, 
  rate: number = VACATION_PAY_RATES.SELLER
): number {
  return commission * rate;
}
```

**Fil: `hours.ts`**

```typescript
const BREAK_THRESHOLD_MINUTES = 360; // 6 timer
const BREAK_DURATION_MINUTES = 30;

export function calculateHoursFromShift(
  startTime: string, 
  endTime: string,
  breakMinutes?: number
): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  
  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);
  
  let totalMinutes = endMinutes - startMinutes;
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  
  // Apply break deduction
  const breakToApply = breakMinutes !== undefined 
    ? breakMinutes 
    : (totalMinutes > BREAK_THRESHOLD_MINUTES ? BREAK_DURATION_MINUTES : 0);
  
  return Math.round(((totalMinutes - breakToApply) / 60) * 100) / 100;
}
```

---

### Fase 3: Migration af Edge Functions

| Edge Function | Ændring |
|--------------|---------|
| `calculate-kpi-values` | Import fra `_shared/`, fjern lokal `fetchFmCommissionMap` |
| `calculate-kpi-incremental` | Import fra `_shared/`, fjern lokal kopi |
| `calculate-leaderboard-incremental` | Import fra `_shared/`, fjern lokal kopi |
| `tv-dashboard-data` | Import fra `_shared/`, fjern lokal `fmPricingMap` |

---

### Fase 4: Migration af Frontend Komponenter

**Høj prioritet (bruger deprecated tabel):**
- `HeadToHeadComparison.tsx`
- `RevenueByClient.tsx`
- `DailyRevenueChart.tsx`
- `useKpiTest.ts`

**Medium prioritet (duplikeret logik):**
- `useStaffHoursCalculation.ts`
- `useAssistantHoursCalculation.ts`
- `ClientDBTab.tsx`
- `ClientDBDailyBreakdown.tsx`

**Lav prioritet (formattering):**
- 33+ filer med `formatCurrency()` duplikering

---

## Teknisk Implementeringsplan

### Step 1: Opret shared modules (Backend)
1. Opret `supabase/functions/_shared/pricing-service.ts`
2. Opret `supabase/functions/_shared/date-helpers.ts`
3. Opret `supabase/functions/_shared/format-helpers.ts`

### Step 2: Migrer Edge Functions
1. Opdater `calculate-kpi-values` til at bruge shared modules
2. Opdater `calculate-kpi-incremental`
3. Opdater `calculate-leaderboard-incremental`
4. Opdater `tv-dashboard-data`
5. Deploy og test

### Step 3: Opret frontend utility library
1. Opret `src/lib/calculations/` mappe
2. Implementer `vacation-pay.ts`
3. Implementer `hours.ts`
4. Implementer `dates.ts`
5. Implementer `formatting.ts`

### Step 4: Migrer frontend komponenter
1. Opdater hooks der bruger deprecated `product_campaign_overrides`
2. Erstat hardcoded feriepenge-konstanter
3. Erstat duplikeret timer-beregning
4. Erstat duplikeret formattering (lav prioritet)

---

## Forventet Resultat

| Metrik | Før | Efter |
|--------|-----|-------|
| Yousee FM omsætning | 0 kr | ~68.400 kr |
| Pricing implementations | 17+ | 1 central |
| Vacation pay implementations | 9+ | 1 central |
| Hours calculation implementations | 6+ | 1 central |
| Date helper implementations | 26+ | 2 (backend + frontend) |
| Format implementations | 33+ | 2 (backend + frontend) |
| Vedligeholdelsestid | Mange timer | Minimal |

---

## Relation til Eksisterende KPI-System

Det nuværende KPI-system (`kpi_definitions`, `kpi_cached_values`, `dashboard_kpis`) er velstruktureret og bør **bevares**. Centraliseringen her handler om de underliggende **beregningsfunktioner** der bruges til at producere KPI-værdierne, ikke om at ændre KPI-arkitekturen.

**Synergi:**
- Shared pricing service bruges af KPI Edge Functions
- Shared date helpers bruges af alle periode-beregninger
- KPI-cache forbliver den primære kilde for dashboard-data

---

## Tidsestimat

| Fase | Estimat |
|------|---------|
| Fase 1: Shared Edge Function Modules | 1-2 timer |
| Fase 2: Frontend Utility Library | 1-2 timer |
| Fase 3: Migration af Edge Functions | 2-3 timer |
| Fase 4: Migration af Frontend (høj prioritet) | 2-3 timer |
| Test og verifikation | 1-2 timer |
| **Total** | **7-12 timer** |

---

## Anbefaling

Start med **Fase 1 + 3** (Backend) for at løse det akutte Yousee-problem. Dette vil umiddelbart vise korrekt omsætning på alle dashboards. Derefter kan frontend-migreringen (Fase 2 + 4) udføres inkrementelt.
