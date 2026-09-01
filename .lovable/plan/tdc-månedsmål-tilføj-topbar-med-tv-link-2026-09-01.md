# TDC Månedsmål — tilføj topbar med TV-link

Boardet mangler den fælles dashboard-topbar, som de øvrige boards har (fx Dagsboard CPH Sales). Derfor er der ingen dashboard-vælger, TV-link-generator eller fuldskærm-knap.

## Ændring

- Indsæt `DashboardHeader` øverst i `src/pages/dashboards/TdcMonthlyGoalBoard.tsx`, kun når boardet vises normalt (ikke i TV-mode).
  - Titel: "TDC Månedsmål"
  - Undertitel: månedslabel (fx "September 2026")
- Headeren giver automatisk: dashboard-dropdown, TV-link-knap (for ejer/teamleder) og fuldskærm — samme adfærd som de andre boards.
- I TV-mode returneres indholdet uændret uden header (som i dag).
- Den nuværende store overskrift inde i det mørke panel beholdes, så TV-visningen ser ens ud; alternativt kan den fjernes i dashboard-visning hvis du vil undgå dobbelt titel — sig til.

## Teknisk

Kun én fil ændres: `src/pages/dashboards/TdcMonthlyGoalBoard.tsx` (grøn zone, ren præsentation). Ingen ændringer i hooks, config, rettigheder eller database.
