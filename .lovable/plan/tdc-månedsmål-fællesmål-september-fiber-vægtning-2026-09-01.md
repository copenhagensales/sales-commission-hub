# TDC Månedsmål: fællesmål september + fiber-vægtning

## Mål
Fællesmål for 1/9–30/9 2026: **850 samlede salg**. Individuelle mål tilføjes senere (boardet viser dem først, når de er oplyst).

## Tælleregel
Alle salgslinjer på TDC Erhverv i måneden tæller 1 pr. stk., med undtagelse af fiber (HAP/VOK), som vægtes som på det eksisterende TDC Erhverv-board:

| Produktlinje | Vægt |
| --- | --- |
| Lukket salg HAP | 0,5 |
| Lead Provi HAP | 0,5 |
| Fuldt salg HAP | 1,0 |
| Lukket salg VOK | 0,5 |
| Lead Provi VOK | 0,5 |
| Fuldt salg VOK | 1,0 |

Vægtene genbruges fra `src/config/fiberBoardPoints.ts` — ingen nye tal hardkodes, så de to boards ikke kan drifte fra hinanden.

## Ændringer
1. `src/config/tdcMonthlyGoals.ts` — sæt `2026-09` team-mål til 850. `defaultSeller` forbliver 0 (individuelle mål kommer senere).
2. `src/hooks/useTdcMonthlyGoal.ts` — hent også `product_id` på salgslinjerne og gang antal med fiber-vægten når produktet findes i `FIBER_BOARD_POINTS`; ellers vægt 1. Gælder både teamtotal og sælgertotal.
3. `src/pages/dashboards/TdcMonthlyGoalBoard.tsx` — vis totalen med op til én decimal (fx 412,5), da vægtningen kan give halve tal. Individuelle rækker vises uden progressbar/mål så længe målet er 0.

## Teknisk
Ingen database- eller rettighedsændringer. Salg med `validation_status = rejected/cancelled` tælles fortsat ikke.
