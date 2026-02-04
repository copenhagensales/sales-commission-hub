
# Plan: Proratér teamlederløn baseret på valgt periode

## Problem

I `ClientDBTab.tsx` (linje 580) beregnes teamlederlønnen som:
```typescript
const finalTeamLeaderSalary = Math.max(calculatedLeaderSalary, teamInfo.minimumSalary);
```

Når perioden er "I dag", bruges hele `minimumSalary` (f.eks. 25.000 kr) i stedet for 1/30 (~833 kr). Dette giver en misvisende høj lederomkostning for korte perioder.

## Løsning

Proratér `minimumSalary` baseret på antal dage i den valgte periode sammenlignet med en standard måned (30 dage):

```typescript
// Calculate period length for proration
const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd }).length;
const STANDARD_MONTH_DAYS = 30;
const prorationFactor = daysInPeriod / STANDARD_MONTH_DAYS;

// Prorate minimum salary to match period length
const proratedMinimumSalary = teamInfo.minimumSalary * prorationFactor;
const finalTeamLeaderSalary = Math.max(calculatedLeaderSalary, proratedMinimumSalary);
```

## Tekniske ændringer

**Fil:** `src/components/salary/ClientDBTab.tsx`

### Trin 1: Tilføj proraterings-konstant (omkring linje 32)
```typescript
const STANDARD_MONTH_DAYS = 30;
```

### Trin 2: Beregn proration i clientDBData useMemo (linje 556-580)
Før team-allokeringerne, beregn periodens længde og prorationsfaktor:
```typescript
// Calculate proration factor for leader minimum salary
const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd }).length;
const prorationFactor = daysInPeriod / STANDARD_MONTH_DAYS;
```

### Trin 3: Anvend prorateret minimumløn (linje 580)
Ændre fra:
```typescript
const finalTeamLeaderSalary = Math.max(calculatedLeaderSalary, teamInfo.minimumSalary);
```
Til:
```typescript
const proratedMinimumSalary = teamInfo.minimumSalary * prorationFactor;
const finalTeamLeaderSalary = Math.max(calculatedLeaderSalary, proratedMinimumSalary);
```

## Forventet resultat

| Periode       | Dage | Prorationsfaktor | Min.løn (25.000 kr) |
|---------------|------|------------------|---------------------|
| I dag         | 1    | 1/30 ≈ 0.033     | ~833 kr             |
| Uge           | 7    | 7/30 ≈ 0.233     | ~5.833 kr           |
| Måned         | ~30  | ~30/30 = 1.0     | ~25.000 kr          |
| Lønperiode    | ~30  | ~30/30 = 1.0     | ~25.000 kr          |

## Konsistens med andre løntyper

- **Assistentløn**: Beregnes allerede korrekt pr. dag via `useAssistantHoursCalculation` (timer × timeløn)
- **Sælgerløn**: Provision baseret på faktiske salg i perioden (automatisk korrekt)
- **Teamlederløn**: Vil nu også være korrekt prorateret
