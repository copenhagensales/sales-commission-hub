# Rul labelen tilbage til "bagud på dagen"

Labelen blev ændret som del af Claudes forslag (punktet om at gab-tallet er akkumuleret måned-til-dato, ikke dagens tal). Det var en ren tekstændring — beregningen er den samme før og efter.

## Ændring

I `src/pages/dashboards/TdcMonthlyGoalBoard.tsx` sættes labelen under gab-tallet tilbage til:

- `gab > 0` → `bagud på dagen`
- `gab <= 0` → `foran på dagen`

Alt andet beholdes som nu: tallet står neutralt lyst uden fortegn, indeksprocenten i midten er det eneste farvede tal, og sælgerbarerne følger indeks-status.

## Filer
- `src/pages/dashboards/TdcMonthlyGoalBoard.tsx`
