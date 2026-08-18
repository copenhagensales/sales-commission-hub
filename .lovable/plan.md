# Holdkonkurrence: kun salg på eget holds klienter tæller

## Problem (verificeret)

I holdkonkurrencen hentes provision pr. medarbejder uden hensyn til hvilken klient salget ligger på (`src/hooks/useLeagueTeamCompetition.ts:64-79` kalder `get_sales_aggregates_v2` med `p_group_by: "employee"` og ingen klient-afgrænsning). Medarbejderens totale provision lægges derefter til det hold han står på i `team_members`.

Konkret for Thorbjørn (10/8 → i dag), provision fordelt på det hold der ejer klienten:

| Ejer-hold | Provision |
|---|---|
| Relatel | 36.602 kr |
| TDC Erhverv | 16.405 kr |
| Fieldmarketing | 13.965 kr |
| Eesy TM | 1.375 kr |

Tavlen viser 51.942 kr under Relatel — altså inkl. FM, TDC og Eesy TM.

## Ændring

Et holds provision må kun bestå af salg på klienter der er tilknyttet holdet via `team_clients`:

- Relatel-holdet: Thorbjørn tæller kun med sine Relatel-salg.
- Salg han laver på Fieldmarketing/TDC/Eesy TM tæller ikke for noget hold i konkurrencen (han deltager kun under sit eget hold).
- Top-5-udvælgelsen pr. hold sker efter den nye, holdafgrænsede provision — så rangeringen internt på holdet kan ændre sig.
- "I dag"-tilvækst og pladsændring beregnes på samme afgrænsede tal.
- Den individuelle konkurrence, point, divisioner og løn ændres ikke.

## Teknisk

1. Ny `SECURITY DEFINER` RPC `get_league_team_provision(p_start timestamptz, p_end timestamptz)` som returnerer `team_id, employee_id, total_commission`:
   - `sales` + `sale_items` → `client_campaigns` → `team_clients` giver ejer-holdet.
   - Medarbejder-identitet med samme 4-trins fallback som `get_sales_aggregates_v2` (`employee_agent_mapping` → `work_email`).
   - Samme filtre: `validation_status` ikke `rejected`/`cancelled`, tidszone Europe/Copenhagen.
   - Kun rækker hvor medarbejderen faktisk er medlem af ejer-holdet (`team_members`) — så kun eget-hold-salg tælles.
   - `GRANT EXECUTE` til `authenticated`.
2. `src/hooks/useLeagueTeamCompetition.ts`: erstat `fetchProvisionByEmployee` med kald til den nye RPC (to kald: hele perioden og perioden minus i dag). Resten af logikken (top 5, totaler, rangering, pladsændring) er uændret.
3. Ingen ændringer i UI-komponenterne (`TeamPodium`, `TeamDistanceChart`, `TeamStandingsTable`).

Zone: gul (UI + ny read-only RPC). Ingen ændring af pricing, løn eller eksisterende RPC'er.
