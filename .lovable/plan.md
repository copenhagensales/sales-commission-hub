
# Plan: Omdøb Bi-salg til Switch

## Oversigt
Ændrer "Bi-salg" til "Switch" i Relatel-dashboardet og tilføjer Switch-antal som sekundær info i CS Top 20.

---

## Ændringer

### 1. Relatel Dashboard (RelatelDashboard.tsx)

Omdøb kolonneoverskriften "Bi-salg" til "Switch" i alle tre leaderboard-tabeller:

| Lokation | Før | Efter |
|----------|-----|-------|
| Linje 289 | `Bi-salg` | `Switch` |
| Linje 352 | `Bi-salg` | `Switch` |
| Linje 415 | `Bi-salg` | `Switch` |

Tabelvisning efter ændring:
```text
┌────┬─────────────┬──────┬────────┬───────────┐
│ #  │ Navn        │ Salg │ Switch │ Provision │
├────┼─────────────┼──────┼────────┼───────────┤
│ 1  │ Jonas J.    │ 72   │ 19     │ 84.375 kr │
└────┴─────────────┴──────┴────────┴───────────┘
```

---

### 2. CS Top 20 Dashboard (CsTop20Dashboard.tsx)

Tilføj Switch-antal i parentes med lille tekst efter salg-tallet:

| Før | Efter |
|-----|-------|
| `72 salg` | `72 salg (+19 switch)` |

Switch vises kun hvis der er Switch > 0. Styling er nedtonet (mindre tekst, muted farve) for at holde fokus på salg.

Ændring i linje 400-404:
```tsx
<div className="text-xs text-muted-foreground/80">
  {sales} salg
  {seller.crossSaleCount > 0 && (
    <span className="text-muted-foreground/60"> (+{seller.crossSaleCount} switch)</span>
  )}
</div>
```

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/pages/RelatelDashboard.tsx` | Omdøb "Bi-salg" → "Switch" (3 steder) |
| `src/pages/CsTop20Dashboard.tsx` | Tilføj switch-antal i parentes |

---

## Eksempelvisning

### Relatel (tabel)
```text
Navn             Salg    Switch    Provision
Jonas Juhl J.    72      19        84.375 kr
Thorbjørn M.     64      27        70.837 kr
```

### CS Top 20 (kompakt)
```text
Jonas Juhl J.              TDC
72 salg (+19 switch)       84.375 kr
```

---

## Bemærkninger
- Switch vises kun i parentes på CS Top 20 hvis der er mindst 1 switch
- Salg forbliver det primære fokuspunkt som ønsket
- Styling er nedtonet for at undgå visuel støj
