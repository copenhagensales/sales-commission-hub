# Fjern "Daglig omsætning (sidste 30 dage)"

Grafen nederst på CPH Sales-dashboardet fjernes fra visningen.

## Ændring
- `src/pages/dashboards/CphSalesDashboard.tsx`: fjern blokken der rendrer `<DailyRevenueChart daysBack={30} />` (linje 1277-1280) samt det tilhørende import-statement (linje 13).
- Komponentfilen `src/components/dashboard/DailyRevenueChart.tsx` bevares (ingen sletning), så den kan genbruges senere. Efter fjernelsen har den ingen forbrugere — sig til hvis den også skal slettes.

Ingen ændringer i data, hooks eller forretningslogik. Grøn zone (ren UI).
