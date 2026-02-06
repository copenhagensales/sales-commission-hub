

# Plan: Gør Switch-kolonnen grøn som Salg-kolonnen

## Oversigt
Ændrer styling på Switch-kolonnen (totalCrossSales) så den bruger samme grønne farve som Salg-kolonnen.

---

## Nuværende styling

| Kolonne | Nuværende klasse |
|---------|------------------|
| Salg | `text-primary font-semibold` (grøn) |
| Switch | `text-muted-foreground` (grå) |

---

## Ændringer

### RelatelDashboard.tsx

Opdater Switch-cellerne i alle tre tabeller fra grå til grøn:

| Linje | Før | Efter |
|-------|-----|-------|
| 333-334 | `text-muted-foreground` | `text-primary font-semibold` |
| 396-397 | `text-muted-foreground` | `text-primary font-semibold` |
| 459-460 | `text-muted-foreground` | `text-primary font-semibold` |

---

## Eksempelvisning efter ændring

```text
┌────┬─────────────┬──────┬────────┬───────────┐
│ #  │ Navn        │ Salg │ Switch │ Provision │
├────┼─────────────┼──────┼────────┼───────────┤
│ 1  │ Jonas J.    │  72  │   19   │ 84.375 kr │
│    │             │ grøn │  grøn  │           │
└────┴─────────────┴──────┴────────┴───────────┘
```

---

## Berørt fil

| Fil | Ændring |
|-----|---------|
| `src/pages/RelatelDashboard.tsx` | Skift `text-muted-foreground` til `text-primary font-semibold` på 3 steder |

