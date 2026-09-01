# "Bagud på dagen"-counter på TDC Månedsmål

Tilføj en tæller til venstre for det store tal (`20,5 / 850`) i boksen "Fælles mål", som viser hvor mange salg vi er foran eller bagud i forhold til dagens forventede niveau.

## Hvad den viser

Beregningen findes allerede i `src/lib/boardProgress.ts` (`gab = forventet - faktisk`). Counteren viser `-gab` afrundet til 1 decimal:

- Foran/på: `+12,5` i grøn (samme grøn som on-track)
- Bagud: `-5,0` i rød/amber efter samme status-farve som resten af boardet
- Under tallet en lille label: `foran på dagen` / `bagud på dagen`

Ved mål = 0 vises counteren ikke.

## Placering

I `src/pages/dashboards/TdcMonthlyGoalBoard.tsx` bliver højre side af "Fælles mål"-headeren et vandret par: counter til venstre, det eksisterende `20,5 / 850` + metadatalinje til højre. Skriftstørrelse gøres TV-læsbar (lidt mindre end hovedtallet), tabular-nums, uden ekstra tooltips eller legende.

## Filer
- `src/pages/dashboards/TdcMonthlyGoalBoard.tsx` (præsentation, grøn zone)

Ingen ændringer i beregningslogik, hooks eller data.
