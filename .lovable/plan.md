# Holdkonkurrence: kun salg på eget holds klienter tæller

## Problem (verificeret)

I holdkonkurrencen hentes provision pr. medarbejder uden hensyn til hvilken klient salget ligger på (`src/hooks/useLeagueTeamCompetition.ts:64-79` kalder `get_sales_aggregates_v2` med `p_group_by: "employee"` og ingen klient-afgrænsning). Medarbejderens totale provision lægges derefter til det hold han står på i `team_members`.

Thorbjørn Mindedal Weichert (`thor@cph-relatel.dk`, hold Relatel), 10/8 → i dag, fordelt på det hold der ejer klienten:

| Ejer-hold | Klient | Antal linjer | Provision |
|---|---|---|---|
| Relatel | Relatel | 31 | 36.602 kr |
| Fieldmarketing | Eesy FM (Eesy marked, 15.-16./8) | 40 | 13.965 kr |
| Eesy TM | Eesy TM (12/8) | 4 | 1.375 kr |

Sum = 51.942 kr = præcis det tal tavlen viser under Relatel. (Tidligere nævnte TDC Erhverv-salg tilhører en anden person, Thorbjørn Hansen-Larsen — ikke relevant her.)

Sidebemærkning: de 4 Eesy TM-linjer den 12/8 kan være fejlattribuerede salg. Det er et separat datasspørgsmål — sig til hvis de skal undersøges.

## Ændring

Et holds provision må kun bestå af salg på klienter der er tilknyttet holdet via `team_clients`:

- Relatel-holdet: Thorbjørn tæller kun med sine 36.602 kr fra Relatel.
- Hans Eesy FM- og Eesy TM-salg tæller ikke for noget hold i konkurrencen.

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
