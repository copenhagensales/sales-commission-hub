

## Tilføj "Ghost procent" KPI-kort til rekrutterings-dashboardet

### Hvad der bygges
Et nyt KPI-kort under konverterings-kortene der viser ghost-procenten for de seneste 30 dage — beregnet som antal kandidater med status `ghosted` divideret med totalt antal kandidater i perioden.

### Beregning
- **30-dages ghost%**: `(ghosted count / total candidates) * 100` — for både Salgskonsulent og Fieldmarketing
- Vises med samme layout som konverteringskortene (procent som stort tal, "X af Y ghostet (30d)" som undertekst, historisk rate som sekundær linje)

### Ændringer

| Fil | Ændring |
|-----|---------|
| `src/pages/recruitment/RecruitmentDashboard.tsx` | Udvid `calcForCategory` til at beregne `ghosted`, `recentGhosted`, `ghostRate`, `recentGhostRate`. Tilføj et nyt grid med 2 ghost%-kort under konverteringskortene. |

### Teknisk detalje
I `calcForCategory` tilføjes:
```ts
const ghosted = filtered.filter(c => c.status === "ghosted").length;
const ghostRate = total > 0 ? Math.round((ghosted / total) * 1000) / 10 : 0;
const recentGhosted = recent.filter(c => c.status === "ghosted").length;
const recentGhostRate = recentTotal > 0 ? Math.round((recentGhosted / recentTotal) * 1000) / 10 : 0;
```

Kortet vises med `Ghost` ikon og samme `Percent`-ikon som konverteringskortene.

