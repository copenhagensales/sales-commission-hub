

# Tilføj "Gns. anciennitet" kolonne i Per team-tabellen

## Ændring

**Fil:** `src/pages/OnboardingAnalyse.tsx`

### 1. Udvid `teamStats` beregningen (linje 260-270)
Tilføj `avgTenureDays` til hvert team-objekt:
```typescript
avgTenureDays: Math.round(s.employees.reduce((sum, r) => sum + r.tenureDays, 0) / s.total),
```

### 2. Tilføj kolonne i tabellen (linje 726-753)
- Ny `<TableHead>` "Gns. anciennitet" efter 60d Churn-kolonnen
- Ny `<TableCell>` der viser værdien i dage (fx `142d`)

Ca. 5 linjer ændring total.

