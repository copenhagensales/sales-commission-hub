

## Anciennitets-indkomst analyse — "Jo længere du er her, jo mere tjener du"

### Koncept
En ny sektion på `/onboarding-analyse` der viser gennemsnitlig provision per anciennitetsmåned. For alle aktive sælgere beregnes: hvad tjente de i deres 1. måned, 2. måned, 3. måned osv.? Resultatet vises som et søjlediagram med en trendlinje.

### Dataflow
1. Hent aktive ikke-stab medarbejdere med `employment_start_date` og deres agent-mappings (emails)
2. Hent salg grupperet per medarbejder per måned via `get_sales_aggregates_v2` (group_by = "both") for de seneste 12 måneder
3. For hver medarbejder: beregn hvilken anciennitetsmåned (1, 2, 3…) hver kalendermåned svarer til ud fra `employment_start_date`
4. Aggreger: gennemsnitlig provision per anciennitetsmåned (sum commission / antal medarbejdere der har data for den måned)
5. Vis som BarChart + trendlinje + antal datapunkter per søjle

### Implementation
**Ny komponent**: `src/components/onboarding-analyse/TenureEarningsChart.tsx`
- Standalone komponent med egen data-fetching (React Query)
- Henter employees + agent mappings + sales data
- Beregner tenure-month buckets client-side
- Viser: Søjlediagram (avg provision per måned), antal medarbejdere bag hver søjle, procentvis stigning fra måned 1

**Ændring i**: `src/pages/OnboardingAnalyse.tsx`
- Tilføj `<TenureEarningsChart />` som ny Card-sektion efter de eksisterende KPI-kort

### UI
- Card med titel "Indtjening per anciennitetsmåned"
- Søjlediagram: X = "Måned 1", "Måned 2" osv., Y = gns. provision i DKK
- Under hver søjle: antal medarbejdere (n=X)
- Trendlinje der viser den opadgående tendens
- Valgfri team-filter der genbruger eksisterende team-state

### Tekniske detaljer
- Bruger eksisterende `get_sales_aggregates_v2` RPC med group_by="both" for at få per-employee per-month data
- Beregner `tenureMonth = differenceInMonths(saleMonth, employmentStartDate) + 1`
- Filtrerer til maks 12 anciennitetsmåneder for læsbarhed
- Ingen nye database-tabeller eller migrationer nødvendige

