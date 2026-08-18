# Saml alt FM under ét "Fieldmarketing"-hold + luk kilden

## Hvorfor det skete i dag

"YouSee FM" er ikke en kode-ændring — holdet har ligget i databasen siden 15. marts, men uden medlemmer, og holdkonkurrencen viser kun hold der har medlemmer. I dag kl. 13:53–13:59 blev der oprettet 4 medlemsrækker på holdet, og derfor dukkede rækken op i tabellen (0 kr, fordi holdet ikke har klienter i `team_clients`).

Kilden er opstartsholdet **"Opstart 24. august 2026"** (`onboarding_cohorts`), som har `team_id` = YouSee FM. Da holdets medarbejdere blev aktiveret/oprettet i dag (Yasmin ×2, Nicolai Holst Vinther, Nellie Voldby Rau — alle med start 24. august), tilknyttede den automatiske team-tilknytning dem til YouSee FM.

To andre opstartshold peger samme sted: "Opstart 21. september 2026" og "Opstart 10. august 2026" — samme problem vil gentage sig ved næste aktivering.

## Hvad der ændres

1. De 4 medlemsrækker flyttes fra YouSee FM til Fieldmarketing (dubletter slettes hvis personen allerede er på Fieldmarketing — én-hold-reglen holdes).
2. De tre opstartshold der peger på YouSee FM (`Opstart 24. august 2026`, `Opstart 21. september 2026`, `Opstart 10. august 2026`) sættes til Fieldmarketing, så nye aktiveringer ikke skaber problemet igen.
3. De nu tomme hold "YouSee FM" og "Eesy FM" slettes, så de ikke kan bruges ved en fejl.

## Resultat

- Holdkonkurrencen viser 5 hold: Fieldmarketing, TDC Erhverv, United, Eesy TM, Relatel.
- FM-provision på både Eesy FM og Yousee tæller under Fieldmarketing (klienterne er allerede bundet dertil).
- Ingen ændring i individuel liga, point, divisioner eller løn.

## Teknisk

- Data-migration, ingen skemaændring, ingen kodeændring:
  - `UPDATE team_members SET team_id = <Fieldmarketing> WHERE team_id = <YouSee FM>` (dubletter fjernes først pga. unik-constraint på (team_id, employee_id)).
  - `UPDATE onboarding_cohorts SET team_id = <Fieldmarketing> WHERE team_id = <YouSee FM>`.
  - `DELETE FROM teams WHERE id IN (<YouSee FM>, <Eesy FM>)` — begge er uden medlemmer og uden `team_clients` efter trin 1–2.
- Ingen ændring i `useLeagueTeamCompetition.ts`, `get_league_team_provision` eller `team_clients`.
- Bemærkning: Yasmin Isabel Jakobsen findes som to medarbejder-records (`52a760ac…`, `8ba55760…`). Ikke rørt her — bør ryddes op separat.
