

# Fix: Proratér individuelle stabslønninger i summary-kortet

## Problem
"Samlet Oversigt" viser det proraterede total for Stabslønninger (-46.500 kr), men de individuelle medarbejdere (Oscar, Lone, Laura osv.) viser deres **fulde** månedsbeløb. Det giver ikke mening at totalen er prorateret, men de individuelle linjer ikke er det.

Oscar Belchers 39.375 kr er hans fulde staff-løn for hele måneden — den burde vises prorateret (~21.000 kr) på samme måde som totalen.

## Løsning
Anvend `prorationFactor` på hver medarbejders `totalSalary` i staffSalaryList, når listen sendes til `ClientDBSummaryCard`.

## Tekniske ændringer

### Fil: `src/components/salary/ClientDBTab.tsx`
**Linje ~1260**: Når `staffSalaryList` sendes til `ClientDBSummaryCard`, map den med prorationFactor:

```tsx
staffSalaryList={staffSalaryList.map(s => ({
  ...s,
  totalSalary: s.totalSalary * prorationFactor,
}))}
```

Ingen andre filer ændres. De fulde beløb vises stadig i parentes via `fullStaffSalaries`.

