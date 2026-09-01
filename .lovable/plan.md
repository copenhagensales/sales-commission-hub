# TDC Månedsmål skal virke på TV uden login

## Problem (bekræftet)
`src/hooks/useTdcMonthlyGoal.ts` kalder `supabase.from("team_members")`, `employee_master_data` og `sales` direkte fra browseren. På et TV uden login kører kaldene som `anon`, og RLS afviser dem — derfor "Datafejl: Sælgerliste: permission denied".

De øvrige TV-boards (TDC Erhverv, CS Top 20, fiber-boards) løser det ved at hente data gennem edge functionen `tv-dashboard-data` via `src/utils/tvEdgeFetch.ts`. Den autentificerer med TV-adgangskoden fra `sessionStorage` (`tv_board_code`) og bruger service role internt, så RLS ikke er en blokering. Boardet er allerede registreret i både `TvBoardView.tsx` og `TvBoardDirect.tsx`, som sætter koden i sessionStorage.

## Løsning
Flyt dataudtrækket for TDC Månedsmål til den eksisterende TV-edge function — samme mønster som `fiber-board-stats`.

1. **Edge function** `supabase/functions/tv-dashboard-data/index.ts`
   - Ny action `tdc-monthly-goal` med samme cache-mønster som de andre actions.
   - Handler laver præcis de samme tre opslag som hooken i dag: team-medlemmer på TDC Erhverv-teamet, aktive medarbejdere, og TDC Erhverv-salg i den ønskede måned med `sale_items` (quantity + product_id).
   - Returnerer rå byggeklodser: `sellers` (id, navn, work_email) og `counts` pr. agent-email plus totalen — ingen mål eller vægtning i edge functionen.
   - Måned sendes som `start`/`end` query-parametre fra klienten, så nuværende måned-logik forbliver i frontend.

2. **Hook** `src/hooks/useTdcMonthlyGoal.ts`
   - Erstat de tre direkte Supabase-kald med ét `tvEdgeFetch("tv-dashboard-data?action=tdc-monthly-goal&start=...&end=...")`.
   - Behold uændret: fiber-vægtning via `FIBER_BOARD_POINTS`, mål fra `src/config/tdcMonthlyGoals.ts`, ekskluderede medarbejdere, sortering og `warning`-håndtering.

Ingen ændringer i mål, vægtning, pricing, løn eller RLS-policies. Ingen nye tabeller.

## Verifikation
- Åbn `/t/<kode>` i en browser uden session: fælles mål og alle sælgere vises uden fejlbesked.
- Åbn boardet som indlogget bruger: samme tal som i dag (JWT-vejen i edge functionen).
