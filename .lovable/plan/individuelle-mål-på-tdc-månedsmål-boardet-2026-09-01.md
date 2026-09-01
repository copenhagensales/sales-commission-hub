# Individuelle mål på TDC Månedsmål-boardet

Sæt individuelt mål til 30 pr. sælger for september 2026 og udelad Oliver fra listen.

## Ændringer

1. `src/config/tdcMonthlyGoals.ts`
   - `defaultSeller: 30` for `2026-09` (team-målet på 850 uændret).
   - Ny valgfri liste `excludeEmployeeIds` i målkonfigurationen, med Olivers medarbejder-id (`80aac0dd-794c-4a68-97ed-374dc6b4cfea` — "Oliver Gonsalves Vatting Arentoft", olar@copenhagensales.dk).

2. `src/hooks/useTdcMonthlyGoal.ts`
   - Filtrér de ekskluderede medarbejder-id'er ud af sælgerlisten, så Oliver ikke vises og ikke får eget mål.
   - Team-totalen på 850 beregnes fortsat på alle TDC Erhverv-salg (uændret) — bekræft dette er ønsket.

Ingen ændringer i vægtning (HAP/VOK 0,5), UI-layout eller database.

## Bemærkning

Der findes kun én Oliver på TDC Erhverv-teamet: "Oliver Gonsalves Vatting Arentoft". Jeg antager, det er ham du mener med "Oliver Gonzales".
