

## Løntilføjelser direkte på tabelkolonner

### Ændring fra tidligere plan
Ingen kobling til `salary_types`-tabellen. I stedet vælger brugeren direkte den kolonne (Provision, Annulleringer, Feriepenge, Diet, Sygdom, Dagsbonus, Henvisning) som beløbet skal lægges til/trækkes fra.

### 1. Ny databasetabel: `salary_additions`

```sql
create table public.salary_additions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employee_master_data(id) on delete cascade,
  column_key text not null check (column_key in (
    'commission','cancellations','vacationPay','diet','sickDays','dailyBonus','referralBonus'
  )),
  amount numeric not null,
  period_start date not null,
  period_end date not null,
  note text,
  created_at timestamptz default now()
);
alter table public.salary_additions enable row level security;
create policy "Auth users manage salary_additions"
  on public.salary_additions for all to authenticated using (true) with check (true);
```

`column_key` matcher de eksisterende SortKey-værdier fra tabellen.

### 2. Ny komponent: `AddSalaryAdditionDialog.tsx`

- Søgbar medarbejder-dropdown (fra sellerData eller employees)
- Dropdown med kolonne-valg: Provision, Annulleringer, Feriepenge, Diet, Sygdom, Dagsbonus, Henvisning
- Beløb-input (positivt eller negativt)
- Valgfri note
- Periode arves fra den valgte lønperiode

### 3. Opdater `SellerSalariesTab.tsx`

- Tilføj "Løntilføjelse" knap i header ved siden af `PayrollPeriodSelector`
- Knappen åbner dialogen

### 4. Opdater `useSellerSalariesCached.ts`

- Ny query: hent `salary_additions` for perioden
- I useMemo: aggregér per employee + column_key
- Læg beløbene oven i de eksisterende værdier (fx `commission += additions.commission`)
- Tilføj `salaryAdditions` objekt til SellerData så man kan se hvad der er tilføjet

### Berørte filer
- Ny migration
- Ny: `src/components/salary/AddSalaryAdditionDialog.tsx`
- Ændret: `src/components/salary/SellerSalariesTab.tsx`
- Ændret: `src/hooks/useSellerSalariesCached.ts`

