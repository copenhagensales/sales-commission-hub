

# Ekstra nøgletal til Onboarding Analyse

God pointe — churn-raten alene fortæller kun halv historien. Hvis mange churner tidligt, men dem der overlever 60 dage faktisk bliver i lang tid, er det et helt andet billede end hvis folk også dropper af efter 6 måneder.

## Foreslåede nye KPI'er og visualiseringer

### 1. Gennemsnitlig anciennitet for "survivors" (pr. team, over tid)
- **Hvad**: For medarbejdere der *ikke* stoppede inden 60 dage — hvad er deres gennemsnitlige anciennitet?
- **Hvorfor**: Viser om dem der overlever onboarding faktisk bliver i lang tid. Stigende trend = forbedret fastholdelse efter onboarding.
- **Visning**: Linjediagram med én linje per team, viser gns. anciennitet (måneder) for survivors over de valgte måneder.

### 2. Median anciennitet trend (pr. måned kohorte)
- **Hvad**: For hver måneds kohorte — hvad er median anciennitet for alle medarbejdere (inkl. stoppede)?
- **Hvorfor**: Median er mere robust end gennemsnit. Viser om nyere kohorter holder længere end ældre.
- **Visning**: Bar chart per måned-kohorte med median anciennitet.

### 3. "Survival rate" KPI-kort
- **Hvad**: Andel der har passeret 60 dage OG stadig er aktive vs. andel der stoppede efter 60 dage.
- **Hvorfor**: Skelner mellem tidlig churn (onboarding-problem) og sen churn (engagement/kultur-problem).
- **Visning**: Nyt KPI-kort med "Post-60d retention" procent + lille breakdown.

### 4. Anciennitet-distribution (histogram)
- **Hvad**: Fordeling af anciennitet i buckets: 0-30d, 31-60d, 61-90d, 91-180d, 6-12 mdr, 1-2 år, 2+ år.
- **Hvorfor**: Viser tydeligt *hvor* folk falder fra — er det kun i de første 60 dage, eller er der også et drop ved 3-6 måneder?
- **Visning**: Stacked bar chart (aktive vs. stoppede) per anciennitet-bucket.

## Teknisk plan

- **Fil**: `src/pages/OnboardingAnalyse.tsx`
- Data er allerede tilgængeligt via `filteredData` (EmployeeRecord[]) — alle nye beregninger kan laves som `useMemo` hooks uden ekstra API kald.
- Tilføj 3 nye `useMemo` hooks: `survivorTenure`, `tenureDistribution`, `postOnboardingRetention`.
- Tilføj 1 nyt KPI-kort (Post-60d retention) i eksisterende grid (ændre til 5 kolonner eller beholde 4 med udskiftning).
- Tilføj 2 nye Card-sektioner med charts efter team-sammenligningsgrafen.
- Brug eksisterende Recharts imports (`BarChart`, `Bar`) + tilføj `LineChart`, `Line` for survivor-trend.
- Ca. 120 linjer nye beregninger + 100 linjer nye UI-sektioner.

