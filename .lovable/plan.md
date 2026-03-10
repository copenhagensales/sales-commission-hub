

# Tilføj "Gns. anciennitet" kolonne i Per måned-tabellen

## Hvad
En ny kolonne i "Per måned"-tabellen der viser den gennemsnitlige anciennitet (i dage) for alle medarbejdere der startede i den pågældende måned. Dette giver mulighed for at sammenligne hvor længe folk fra en given kohorte har været ansat.

## Ændring

**Fil:** `src/pages/OnboardingAnalyse.tsx`

### 1. Udvid `monthlyCohorts` beregningen
Tilføj `avgTenureDays` til hvert cohort-objekt:
```typescript
avgTenureDays: cohort.length > 0
  ? Math.round(cohort.reduce((sum, r) => sum + r.tenureDays, 0) / cohort.length)
  : 0,
```

### 2. Tilføj kolonne i tabellen
- Ny `<TableHead>` "Gns. anciennitet" efter 60d Churn-kolonnen
- Ny `<TableCell>` der viser fx "142d" eller formateret som måneder/dage

Simpel ændring — ca. 10 linjer kode.

