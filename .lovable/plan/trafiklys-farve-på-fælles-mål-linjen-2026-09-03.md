# Trafiklys-farve på fælles mål-linjen

Progressbaren på "Fælles mål" bruger i dag `barColor(teamProgress)` — altså hvor stor en del af månedsmålet der er nået (grøn ≥100, blå ≥75, amber ≥50, ellers rød). Det er ikke indeks. Den skal i stedet følge indeks:

```text
indeks >= 105   -> grøn
indeks 95-104   -> gul
indeks < 95     -> rød
```

## Ændringer

`src/lib/boardProgress.ts`
- Ny hjælpefunktion `indeksBarClass(status)`: `foran` -> grøn, `on-track` -> gul, `efter` og `bagud` -> rød, `ukendt` -> neutral grå.
- Ingen ændring i `calcBoardProgress`, tærskler eller de eksisterende `statusTextClass` / `statusFillClass`, så indekstallet og sælgerbarerne beholder deres nuværende 4-trins skala (grøn/gul/orange/rød).

`src/pages/dashboards/TdcMonthlyGoalBoard.tsx`
- Faktisk fyld, ghost-fyld (forventet) og markør bruger `indeksBarClass(teamProgressInfo.status)` i stedet for `barColor(...)`.
- `barColor` fjernes, hvis den ikke bruges andre steder på siden.
- Bredden på baren er uændret (fortsat % af målet). Kun farven ændres.
- Når målet er 0 (`indeks = null`) forbliver baren neutral grå.

`src/lib/boardProgress.test.ts`
- Tilføj tests for `indeksBarClass` på de tre grænser (105, 95, under 95).

## Zone

Grøn zone: kun board-præsentation og en ren hjælpefunktion. Ingen ændringer i hooks, data, pricing eller lønlogik.
