# Yousee FM Månedsmål – nyt board

Kopi af "Eesy FM Månedsmål" for Yousee FM. Alle solgte Yousee FM-produkter tæller som ét salg pr. produkt, ligesom på Eesy FM.

## Mål for oktober (1/10–31/10)
| Sælger | Mål |
|---|---|
| Yasmin | 96 |
| Nikolaj | 96 |
| Nellie | 104 |
| Adam | 92 |
| Noah | 92 |
| Lukas | 125 |
| Jonatan (ny, starter senere) | 25 |
| **Fælles mål** | **630** |

Bemærk: de individuelle mål giver tilsammen 630, så det passer.

## Det bygges
1. Nyt board "Yousee FM Månedsmål" under Dashboards med fælles og individuelle progressbarer.
2. Kan vises på TV-boards som de andre månedsmål-boards.
3. Målene lægges i databasen for oktober. Sælgerne matches til deres medarbejderprofil på fornavn blandt Yousee FM-sælgerne. Er et navn ikke entydigt, spørger jeg før det gemmes.
4. Jonatan får målet 25 med det samme. Han vises først med salg, når han sælger.

## Teknisk
- Ny `src/config/youseeFmMonthlyGoals.ts` (board-nøgle `yousee-fm-monthly-goal`, alle produkter tæller).
- Ny hook `useYouseeFmMonthlyGoal` via eksisterende `useVoiceMonthlyGoal`; klientfilter Yousee FM (verificeres: Yousee-klient + FM-kampagner, jf. `fmBasketNumberProducts.ts`).
- Ny side `YouseeFmMonthlyGoalBoard.tsx`, route i `routes/config.tsx`, lazy page, TV-mapping i `TvBoardView`/`TvBoardDirect`, post i `dashboards.ts`.
- Den eksisterende edge-action for TV-mode tilføjes `yousee-fm-monthly-goal` (samme mønster som Eesy FM).
- Ny rettighed `menu_dashboard_yousee_fm_monthly_goal` i `permissionKeys.ts` (rød zone – godkendes med denne plan). Adgang tildeles samme hold som Eesy FM Månedsmål har i dag.
- Mål indsættes i `board_monthly_goals` (data-insert, ingen skemaændring).
- Ingen ændringer i løn, pricing eller eksisterende boards.
