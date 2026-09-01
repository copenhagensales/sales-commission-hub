# Individuelle mål: kolonne-læsning i stedet for zig-zag

## Problem
Sælgerlisten ligger i et `grid grid-cols-2`, som udfylder rækkevis: nr. 1 øverst til venstre, nr. 2 øverst til højre, nr. 3 på næste række til venstre. Rækkefølgen "hopper" derfor på tværs (z-mønster).

## Ønsket
Læserækkefølge nedad: den første halvdel af sælgerne i venstre kolonne fra top til bund, den anden halvdel i højre kolonne fra top til bund.

## Løsning
I `src/pages/dashboards/TdcMonthlyGoalBoard.tsx`:

- Del den sorterede sælgerliste i to halvdele (venstre får den ekstra række ved ulige antal).
- Render to `div`-kolonner side om side (`flex`/`grid` med to kolonner), hver med sine rækker i `space-y`.
- Sælgerrækken udtrækkes til en lille lokal render-funktion, så samme markup bruges i begge kolonner — ingen ændring i indhold, farver, status-logik eller mål.
- På mobil (under `md`) vises alt fortsat som én kolonne i original rækkefølge.

Ingen ændringer i data, hooks eller beregninger — kun præsentation.

## Filer
- `src/pages/dashboards/TdcMonthlyGoalBoard.tsx`
