

# Tilfoej sammenfatningsbokse oeverst i Loen-fanen

## Oversigt

Tilfoej opsummeringskort oeverst i Loen-fanen med totaler for den valgte loenperiode.

## Bokse (altid synlige)

1. **Provision** -- Sum af `mapped_commission` fra `sale_items` i perioden
2. **Feriepenge** -- Provision x feriepengesats (fra `employee_master_data.vacation_type`)
3. **Annullering** -- Sum af `mapped_commission` fra salg med `validation_status = 'cancelled'`

## Betingede bokse (kun synlige hvis > 0)

4. **Diet** -- Sum af `booking_diet.amount` for medarbejderen i perioden
5. **Dagsbonus** -- Sum af `daily_bonus_payouts.amount` for medarbejderen i perioden
6. **Henvisningsbonus** -- `employee_master_data.referral_bonus` (fast beloeb)

## Tekniske detaljer

### Fil: `src/components/my-profile/PayrollDayByDay.tsx`

**Nye queries:**
- `employee_master_data` for `vacation_type` og `referral_bonus`
- `sales` + `sale_items` med `validation_status = 'cancelled'` for annulleringssum
- `booking_diet` summeret paa `amount` i perioden
- `daily_bonus_payouts` summeret paa `amount` i perioden

**Feriepenge:** Importer `getVacationPayRate` og beregn `periodTotal * rate`

**UI:** Responsiv grid (`grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3`) med Card-komponenter placeret mellem periodeselector og dagsoversigt. Alle beloeb formateres som "X kr" uden antal.

**Raekkefoelge:** Provision | Feriepenge | Annullering | Diet* | Dagsbonus* | Henvisningsbonus*

