

## Problem: Salg MTD tæller kun nuværende teammedlemmer

### Årsag
`useClientForecast` henter medarbejdere fra `team_members` (linje 56-59), som kun indeholder **aktive** teammedlemmer. Medarbejdere der er stoppet fjernes fra `team_members` (via `remove_deactivated_employee_from_teams` triggeren).

Når salg derefter hentes via `get_sales_report_detailed`, matches de kun mod navne/emails fra de nuværende teammedlemmer (linje 107-116). Salg lavet af stoppede medarbejdere ignoreres → **Salg MTD er for lavt**.

### Løsning: Tæl ALLE klient-salg + vis stoppede medarbejdere

#### 1. Beregn total Salg MTD direkte fra RPC
I stedet for kun at summere salg fra matchede medarbejdere, brug `get_sales_report_detailed`-resultatet direkte til at beregne `actualSalesMtd` (sum af ALL rows, ikke kun matchede).

#### 2. Inkludér stoppede medarbejdere med salg i perioden
- Hent `salesReport` FØRST
- For navne/emails der IKKE matcher et nuværende teammedlem, slå op i `employee_master_data` (inkl. inaktive) og `historical_employment`
- Vis dem i tabellen (evt. med "Stoppet" badge i stedet for "Ny"/"Etableret")

#### 3. Ændringer i `useClientForecast.ts`

```
Nuværende flow:
  team_members → employeeIds → salesReport filtered by employeeIds

Nyt flow:
  team_members → employeeIds (aktive)
  salesReport → totalActualFromAllRows (ufiltreret sum)
  salesReport umatched rows → opslag i employee_master_data → tilføj som "stoppet" rækker
```

Konkret:
- **totalActual**: Sum af ALLE `salesReport` rows' `quantity` (ikke kun matchede)
- **Umatchede salg**: Forsøg at finde medarbejder via `employee_master_data` med navn/email match. Tilføj dem til employee-listen med `projected: 0` og en ny type-markering
- **EmployeeForecastRow**: Tilføj `isStopped: boolean` til interfacet
- **UI**: Vis "Stoppet" badge for stoppede medarbejdere, og sæt deres projected/forecast til kun actual (ingen fremtidig projektion)

### Berørte filer
- `src/hooks/useClientForecast.ts` — hovedlogik
- Forecast detail-side (tabelvisning) — vis "Stoppet" badge

