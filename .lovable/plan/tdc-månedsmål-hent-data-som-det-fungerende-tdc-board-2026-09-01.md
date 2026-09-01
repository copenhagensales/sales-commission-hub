# TDC Månedsmål: hent data som det fungerende TDC-board

## Hvad jeg har bekræftet

- Måldata er korrekt i koden: `src/config/tdcMonthlyGoals.ts` har `2026-09` med `team: 850`, `defaultSeller: 30`.
- Data findes i basen: TDC Erhverv-teamet (`ee967dfd-…`) har 16 medlemmer, og der er 4 salgslinjer på TDC Erhverv i september.
- Boardet viser hverken mål eller sælgere, hvilket betyder at hook'ens forespørgsel kaster en fejl — så hele `data` bliver `undefined`, inkl. det hardkodede mål.
- Forskellen til det board der virker: `useTdcErhvervSales.ts:67-75` forespørger fra `sales` med `client_campaigns!inner` og henter `sale_items` som embed. `useTdcMonthlyGoal` forespørger omvendt fra `sale_items` og filtrerer på et to-niveau embed (`sales.client_campaigns.client_id`) — det mønster er ikke bevist virkende her og rammer også `sale_items`-RLS direkte.
- Ingen browser-signaler tilgængelige (ingen konsol-/netværkslogs, preview-JS svarer 404), så fejlteksten kan ikke læses direkte — derfor gøres fejl fremover synlig i UI'et.

## Ændringer

1. `src/hooks/useTdcMonthlyGoal.ts`
   - Forespørg fra `sales` med samme, bevist virkende mønster som `useTdcErhvervSales`:
     `select("agent_email, validation_status, sale_datetime, client_campaigns!inner(client_id), sale_items(quantity, product_id)")`
     filtreret på `client_campaigns.client_id` + `sale_datetime` i måneden.
   - Behold vægtningen (HAP/VOK 0,5 via `fiberBoardPoints`), frasortering af `cancelled`/`rejected`, og udelukkelse af `excludeEmployeeIds`.
   - Returnér mål (team + individuelle) uafhængigt af salgsdata: hvis salgsforespørgslen fejler, vises mål med 0 i tælleren i stedet for et helt tomt board.

2. `src/pages/dashboards/TdcMonthlyGoalBoard.tsx`
   - Vis en kort fejlbesked (`error.message`) hvis forespørgslen fejler, så årsagen kan læses direkte på skærmen.

Ingen ændringer i database, RLS eller målsatser.
