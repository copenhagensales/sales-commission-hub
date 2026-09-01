# Fix: TV-link /t/ET79 viser "Dashboard ikke fundet"

## Årsag (bekræftet)
`/t/:code` renderes af `src/pages/tv-board/TvBoardDirect.tsx`. Dens slug→komponent-map (linje 28-39) indeholder ikke `"tdc-monthly-goal"`. Derfor bliver `DashboardComponent` null (linje 315) og fejlsiden vises. Selve koden ET79 valideres fint — det er kun komponent-opslaget der mangler.

Til sammenligning har `src/pages/tv-board/TvBoardView.tsx` (rute `/tv-board/:slug`) allerede `"tdc-monthly-goal": TdcMonthlyGoalBoard` — derfor virker boardet inde i systemet men ikke via TV-linket.

## Ændring
Kun `src/pages/tv-board/TvBoardDirect.tsx`:
1. Importér `TdcMonthlyGoalBoard` fra `@/pages/dashboards/TdcMonthlyGoalBoard`.
2. Tilføj `"tdc-monthly-goal": TdcMonthlyGoalBoard,` i `dashboardComponents`.

Ingen DB-ændringer, ingen rettigheds- eller lønberegningslogik berørt (grøn zone: præsentation).

## Verifikation
- Åbn `/t/ET79` i inkognito: boardet skal vise "TDC Månedsmål" med fælles mål og sælgerrækker.
- Bekræft at rotation/celebration-overlay stadig virker for de øvrige boards.
