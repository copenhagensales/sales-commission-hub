## Årsag

I `src/components/dashboard/TvDashboardComponents.tsx` linje 58 renderer `TvKpiCard` kun `suffix` når `!tvMode`. Derfor er `(+X fiber)` (og `(+X switch)`) skjult på TV, selvom data hentes korrekt.

## Fix — kun TDC Erhverv fiber

For at undgå at Relatels `(+X switch)` også begynder at dukke op på TV, tilføjer vi en ny, separat prop i stedet for at åbne den eksisterende `suffix`:

### 1. `src/components/dashboard/TvDashboardComponents.tsx`
- Tilføj ny valgfri prop `tvSuffix?: React.ReactNode` på `TvKpiCard`.
- Bevar `{!tvMode && suffix}` uændret (så switch fortsat kun vises i normal mode).
- Under værdi-blokken: hvis `tvMode && tvSuffix` → render `tvSuffix` som en separat linje under det store tal (fx `text-[28px] font-normal text-muted-foreground -mt-1`).

### 2. `src/components/dashboard/ClientDashboard.tsx`
- Behold nuværende `suffix: combineSuffix(switchSuffix(...), fiberSuffix(...))` på alle KPI-kort (uændret opførsel i normal mode).
- Tilføj `tvSuffix: fiberSuffix(fiberCount…)` KUN på de fire fiber-relevante kort ("Salg i dag", "Salg denne uge", "Salg denne måned", "Salg lønperiode"). Ingen `tvSuffix` på "Salg/time".
- `fiberSuffix` returnerer allerede kun noget når `showFiber === true`, så Relatel/Eesy/andre klienter får automatisk `undefined` → ingen ændring på deres TV-boards.

Ingen ændringer i hooks, edge functions, config, RLS eller data-lag. Kun præsentation. Grøn zone.

## Verifikation

- TV-link TDC Erhverv → `(+X fiber)` vises under tallet på de 4 salgs-kort (ikke Salg/time).
- TV-link Relatel → uændret, ingen `(+X switch)` dukker op.
- Normal (auth) visning af alle klient-dashboards → uændret.