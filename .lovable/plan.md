## Mål
Medarbejdere der ligger i `/employees`-oversigten, men hvis `employment_start_date` er i fremtiden, skal:
1. Vises med et tydeligt tag ("Ikke startet endnu") i rækken.
2. Ikke tælle med i "Aktive medarbejdere"-KPI'en, selv om `is_active = true`.

Grøn zone — kun UI/præsentation i `src/pages/EmployeeMasterData.tsx`. Ingen DB-ændringer, ingen ændring af `is_active`-logik (så løn, RLS, permissions etc. er urørt).

## Ændringer

**1. Helper i `EmployeeMasterData.tsx`**
- `isNotStartedYet(employee)` = `employee.is_active && employee.employment_start_date && employment_start_date > i dag` (dansk tid, sammenlign som `YYYY-MM-DD`).

**2. Badge i tabelrækken (linje ~974, ved siden af navnet)**
- Hvis `isNotStartedYet(employee)`: vis `<Badge variant="outline">Starter d. {formateret dato}</Badge>` efter navnet.
- Tooltip: "Ikke startet endnu — tælles ikke som aktiv medarbejder".

**3. KPI-tælling af aktive**
- Beregn lokalt: `notStartedYetCount = employees.filter(isNotStartedYet).length`.
- `displayActiveCount = activeCount - notStartedYetCount` (både for cached og lokal fallback).
- Send `displayActiveCount` til `EmployeeKpiCards` som `activeCount`.
- Under KPI-tallet vises lille undertekst: "+{notStartedYetCount} starter senere" hvis > 0. (Kan implementeres via ny prop eller ved at læse `notStartedYetCount` direkte i `EmployeeKpiCards` — jeg vælger den mindst invasive: passer en ekstra prop `pendingStartCount`.)

**4. Filter (valgfrit, medtages)**
- I "Aktiv/Inaktiv"-filteret bevares nuværende opførsel ("Aktive" viser stadig alle med `is_active=true` inkl. ikke-startede — så listen matcher badge-visningen). Ingen ny filterværdi tilføjes for at holde ændringen minimal.

## Filer der berøres
- `src/pages/EmployeeMasterData.tsx` (helper, badge, KPI-tælling)
- `src/components/employees/EmployeeKpiCards.tsx` (ny valgfri prop `pendingStartCount` + undertekst)

## Uden for scope
- Cached KPI-tabellen (`dashboard_kpis`) opdateres ikke — vi subtraherer i frontend for at undgå backend-ændring. Hvis andre steder i systemet også skal ekskludere ikke-startede, laves det som separat opgave.
- Ingen ændring af `is_active`, roller, permissions, løn eller shift-planlægning.
