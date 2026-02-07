
# Plan: Proratér ATP + Barsel baseret på arbejdsdage

## Baggrund
ATP + Barsel (381 kr/medarbejder/md) vises i øjeblikket som det fulde månedsbeløb uanset periode. For konsistens med andre udgifter skal det prorateres baseret på **arbejdsdage**, så 1 dag viser ~1/22 af det månedlige beløb.

## Løsning

### Beregningslogik
I stedet for:
```
teamAtpBarsselCost = teamMemberCount × 381 kr (fuldt beløb)
```

Ændres til:
```
workdaysInPeriod = antal arbejdsdage (man-fre) i den valgte periode
workdaysInMonth ≈ 22 (standard arbejdsdage per måned)
teamAtpBarsselCost = teamMemberCount × 381 kr × (workdaysInPeriod / workdaysInMonth)
```

### Eksempel
- **1 dag**: 18 medarbejdere × 381 kr × (1/22) = **312 kr** (i stedet for 6.858 kr)
- **1 uge (5 dage)**: 18 medarbejdere × 381 kr × (5/22) = **1.559 kr**
- **1 måned (22 dage)**: 18 medarbejdere × 381 kr × (22/22) = **6.858 kr** (fuldt beløb)

### Tekniske ændringer

**Fil:** `src/components/salary/ClientDBTab.tsx`

1. **Import `countWorkDaysInPeriod`** fra `@/lib/calculations/dates`

2. **Beregn arbejdsdage i perioden:**
```typescript
const workdaysInPeriod = countWorkDaysInPeriod(periodStart, periodEnd);
const WORKDAYS_PER_MONTH = 22;
const atpProrationFactor = workdaysInPeriod / WORKDAYS_PER_MONTH;
```

3. **Opdater ATP/Barsel beregningen:**
```typescript
// Linje 668-670 ændres fra:
const teamAtpBarsselCost = teamMemberCount * atpRate;

// Til:
const teamAtpBarsselCost = teamMemberCount * atpRate * atpProrationFactor;
```

4. **Opdater kommentar:**
```typescript
// Calculate ATP + Barsel cost for this team (prorated by workdays in period)
```

## Fordele
- Konsistent visning på tværs af alle perioder
- 1 dag viser den faktiske daglige omkostning
- Fulde månedsperioder viser stadig det samlede beløb
- Bruger arbejdsdage (man-fre) som giver mere præcis fordeling
