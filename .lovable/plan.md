# Oliver ud af kronekonkurrencen — 💩 og brun linje, låst sidst

Kronelogikken bevares uændret for alle andre: den første der rammer 100% af sit individuelle mål låses i databasen og kan ikke overhales. Oliver deltager ikke, fordi hans mål kun er 5 salg.

## Ændringer

1. **Oliver frigøres fra kronen**
   Hans registrerede plads som "månedens første målopnåer" for september fjernes, så kronen i stedet tilfalder den næste sælger der rammer 100%. Ingen andre data røres.

2. **Oliver kan ikke vinde kronen igen**
   Han udelades som kandidat, når systemet afgør hvem der låses som første målopnåer.

3. **Oliver låses nederst**
   Uanset procent placeres han altid som sidste linje på listen. Alle andre sorteres som i dag.

4. **Brun linje + 💩**
   Hans progress-bar bliver brun (i stedet for guld/grøn/gul/rød), og der vises 💩 til højre for navnet i stedet for kronen/medaljen. Navnet får brun tekstfarve.

Kronen (guld-bar + ikon) vises fortsat kun for den låste vinder.

## Teknisk

- `src/config/tdcMonthlyGoals.ts`: ny valgfri liste `crownExemptEmployeeIds` i månedskonfigurationen med Olivers employee-id (`80aac0dd-794c-4a68-97ed-374dc6b4cfea`). Han bliver IKKE lagt i `excludeEmployeeIds` — han skal stadig vises.
- `src/hooks/useTdcMonthlyGoal.ts`:
  - sæt `isCrownExempt` på sælgere i den liste,
  - filtrér dem ud af `candidates` der sendes til `monthly-goal-first-achiever`,
  - sortér til sidst: undtagne sælgere placeres efter alle andre (stabil sortering af resten uændret).
- `src/pages/dashboards/TdcMonthlyGoalBoard.tsx`: hvis `isCrownExempt` → brun bar (`bg-gradient-to-r from-amber-900 to-yellow-800`-agtigt brunt token-frit tailwind-udtryk i samme stil som resten af boardet), brun navnefarve, og `<span>💩</span>` i stedet for `Medal`.
- Databaseoprydning: `DELETE FROM public.monthly_goal_first_achievers WHERE board_key = 'tdc-monthly-goal' AND month_key = '2026-09'` (kun denne ene række — tabellen er kun en visnings-lås for boardet, ikke løn- eller salgsdata).
- Ingen ændringer i tællelogik, pricing, provision, løn, RLS eller salgsdata. Relatel-boardet påvirkes ikke.
