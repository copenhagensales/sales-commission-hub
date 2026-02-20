

# Fix: KPI `active_employees` og leaderboard skal inkludere inaktive medarbejdere med data

## Problem

I dag taller `active_employees` KPI'et kun medarbejdere hvor `is_active = true`. Hvis en medarbejder har salgsdata i perioden men er blevet deaktiveret, taller de ikke med. Det samme galder leaderboardet, som kun henter navne for aktive medarbejdere.

## Berarte steder

### Backend (Edge Functions)

1. **`calculate-kpi-values/index.ts`** (linje 2009-2019)
   - `calculateActiveEmployees()` taller pt. kun `is_active = true, is_staff_employee = false`
   - Skal aendres til at talle unikke medarbejdere der har salgsdata i perioden PLUS aktive medarbejdere
   - Funktionen modtager ikke periode-parametre i dag -- skal tilfojes

2. **`calculate-kpi-incremental/index.ts`**
   - Allerede aggregerer salg per employee -- kan udlede "sellers on board" fra `empSales` map'et
   - Skal tilfoeje et nyt cached KPI `sellers_with_data` eller aendre `active_employees` til at inkludere inaktive med data

3. **`calculate-leaderboard-incremental/index.ts`** (linje 261-264)
   - Henter kun `is_active = true` medarbejdere til navneopslag
   - Inaktive medarbejdere med salg faar ingen navn i leaderboardet
   - Skal fjerne `is_active`-filteret saa alle medarbejdere kan slaaes op

### Frontend (Dashboards)

4. **`SalesOverviewAll.tsx`**, **`CphSalesDashboard.tsx`**, **`EmployeeMasterData.tsx`**
   - Bruger `usePrecomputedKpis(["active_employees"])` -- disse faar automatisk korrekte tal naar backend er rettet
   - Fallback-queries i SalesOverviewAll og CphSalesDashboard filtrerer ogsaa paa `is_active = true` -- skal opdateres

## Loesning

### 1. Ret `calculateActiveEmployees` i `calculate-kpi-values`

Aendr funktionen til at tage periode-parametre og talle unikke medarbejdere med salg i perioden:

```text
Nuvaerende:
  SELECT count(*) FROM employee_master_data WHERE is_active = true AND is_staff_employee = false

Ny logik:
  1. Hent aktive medarbejdere (is_active = true, is_staff_employee = false) -> Set A
  2. Hent unikke employee_ids fra sale_items/sales i perioden -> Set B
  3. Return størrelsen af A UNION B (unikke medarbejdere)
```

### 2. Tilfoej `sellers_with_data` i `calculate-kpi-incremental`

Efter aggregeringen af `empSales` map'et, tilfoej et nyt KPI der taller antallet af unikke medarbejdere med mindst 1 salg:

```text
const sellersWithData = empSales.size;
// Tilfoej som cached value med slug "sellers_with_data"
```

### 3. Fjern `is_active`-filter i leaderboard

I `calculate-leaderboard-incremental.ts` linje 264, fjern `.eq("is_active", true)` saa inaktive medarbejdere ogsaa kan slaaes op med navn og avatar.

### 4. Opdater frontend fallback-queries

I `SalesOverviewAll.tsx` og `CphSalesDashboard.tsx`, fjern `is_active = true` filteret fra fallback-queries der taller medarbejdere.

## Filer der aendres

1. `supabase/functions/calculate-kpi-values/index.ts` -- ny logik i `calculateActiveEmployees()`
2. `supabase/functions/calculate-kpi-incremental/index.ts` -- tilfoej `sellers_with_data` KPI
3. `supabase/functions/calculate-leaderboard-incremental/index.ts` -- fjern `is_active` filter
4. `src/pages/dashboards/SalesOverviewAll.tsx` -- opdater fallback query
5. `src/pages/dashboards/CphSalesDashboard.tsx` -- opdater fallback query

## Risiko

- Lav: Aendringen er additiv -- vi tilfojer medarbejdere, fjerner ingen
- Leaderboard-navneopslag bliver lidt stoerre (alle medarbejdere i stedet for kun aktive), men ubetydeligt for performance
- Eksisterende KPI-slug `active_employees` beholder sit navn for kompatibilitet, men logikken bag aendres

