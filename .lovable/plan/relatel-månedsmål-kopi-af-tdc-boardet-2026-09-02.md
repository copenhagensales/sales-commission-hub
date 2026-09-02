# Relatel Månedsmål — kopi af TDC-boardet

Nyt board "Relatel Månedsmål" bygget som en 1:1 kopi af "TDC Månedsmål", men med Relatel-klienten og Relatel-teamets sælgere.

## Hvad boardet viser
Samme layout som TDC-boardet: fælles progressbar med indeks, "foran/bagud på dagen", dagsbokse pr. dag i måneden og individuelle mål i to kolonner.

- Fælles mål september 2026: **850 salg**
- Individuelle mål: **vilkårlige startværdier** (justeres senere), fordelt på de 11 aktive Relatel-sælgere:

| Sælger | Foreløbigt mål |
| --- | --- |
| Anders Schjødt Kristensen | 90 |
| Benjamin Nickolaj Andersen | 90 |
| Emillio Pedersen | 80 |
| Frederik Bülow Donner | 80 |
| Gustav Fyrstenborg Diebel | 80 |
| Jacob Lykke Nielson | 80 |
| Noah Zylber | 75 |
| Rasmus Quiding Fricke | 75 |
| Samuel Juul | 70 |
| Simon Sejer Linddal Sørensen | 70 |
| Thorbjørn Mindedal Weichert | 60 |

## Tælleregel
Sum af `sale_items.quantity` på Relatel-salg i måneden. Annullerede/afviste salg tælles ikke. Ingen fiber-vægtning (den er TDC-specifik) — hver linje tæller sin quantity.

## Filer
Nye:
- `src/config/relatelMonthlyGoals.ts` — mål pr. måned (samme struktur som `tdcMonthlyGoals.ts`)
- `src/hooks/useRelatelMonthlyGoal.ts` — kopi af TDC-hooket uden fiber-vægtning
- `src/pages/dashboards/RelatelMonthlyGoalBoard.tsx` — kopi af TDC-boardet med ny titel

Ændres (kun registrering):
- `supabase/functions/tv-dashboard-data/index.ts` — ny action `relatel-monthly-goal` (genbruger samme handler, parametriseret med klient-id `0ff8476d…` og team-id `f4210d48…`)
- `src/config/dashboards.ts` — slug `relatel-monthly-goal`, permission `menu_dashboard_relatel_monthly_goal`
- `src/config/permissionKeys.ts` — ny nøgle
- `src/routes/pages.ts` + `src/routes/config.tsx` — rute `/dashboards/relatel-monthly-goal`
- `src/pages/tv-board/TvBoardView.tsx` + `TvBoardDirect.tsx` — så boardet kan vælges på en TV-skærm

## Teknisk
Ingen databaseændringer, ingen ændringer i eksisterende TDC-board, hooks eller lønlogik. `boardProgress.ts` genbruges uændret, så indeks/farvelogik er identisk på de to boards.
