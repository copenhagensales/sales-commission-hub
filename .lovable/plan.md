

# Plan: Lønperiode-vælger + nye kolonner i Sælgerlønninger

## Overblik

Udvid `SellerSalariesTab` med:
1. En lønperiode-vælger (genbruge `PayrollPeriodSelector`)
2. Fire nye kolonner: **Diet**, **Sygdom** (sygedage), **Dagsbonus**, **Henvisningsbonus**

---

## Ændringer

### 1. `useSellerSalariesCached.ts` - Udvid hook med periode-parametre og nye data

**Nuværende:** Hook'en har ingen periode-parameter - den henter kun `payroll_period` fra KPI cache.

**Ændringer:**
- Tilfoej `periodStart` og `periodEnd` parametre
- Tilfoej queries for:
  - **Diet**: Sum af `booking_diet.amount` per medarbejder i perioden
  - **Sygdom**: Antal godkendte fravaersanmodninger med type `sick` fra `absence_request_v2` i perioden
  - **Dagsbonus**: Sum af `daily_bonus_payouts.amount` per medarbejder i perioden
  - **Henvisningsbonus**: `employee_master_data.referral_bonus` (allerede tilgaengelig, er en fast vaerdi)
- Udvid `SellerData` interface med: `diet: number`, `sickDays: number`, `dailyBonus: number`, `referralBonus: number`

### 2. `SellerSalariesTab.tsx` - Tilfoej periodeselector og kolonner

**Ændringer:**
- Tilfoej state for `periodStart`/`periodEnd` med default fra `getPayrollPeriod()`
- Indsaet `PayrollPeriodSelector` oeverst ved filtere
- Send `periodStart`/`periodEnd` til `useSellerSalariesCached`
- Tilfoej 4 nye `TableHead`/`TableCell` kolonner i tabellen: Diet, Sygdom, Dagsbonus, Henvisning
- Opdater mobile list-view med de nye felter
- Opdater total-raekken med sum af de nye kolonner

---

## Tekniske detaljer

### Nye data-queries i hook'en

```text
Diet:         SELECT amount FROM booking_diet WHERE employee_id IN (...) AND date BETWEEN start AND end
Sygdom:       SELECT employee_id, date FROM absence_request_v2 WHERE status='approved' AND type='sick' AND date BETWEEN start AND end
Dagsbonus:    SELECT amount FROM daily_bonus_payouts WHERE employee_id IN (...) AND date BETWEEN start AND end
Henvisning:   Allerede i employee_master_data.referral_bonus (enkelt vaerdi, ikke periode-baseret)
```

### Filændringer

| Fil | Ændring |
|-----|---------|
| `src/hooks/useSellerSalariesCached.ts` | Tilfoej periode-parametre, 3 nye queries, udvid SellerData |
| `src/components/salary/SellerSalariesTab.tsx` | Tilfoej PayrollPeriodSelector, 4 nye tabel-kolonner |

### Ingen database-ændringer

Alle tabeller eksisterer allerede (`booking_diet`, `daily_bonus_payouts`, `absence_request_v2`, `employee_master_data`).

