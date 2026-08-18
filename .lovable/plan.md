# Saml alt FM under ét "Fieldmarketing"-hold

"YouSee FM" er ikke en kode-ændring — det er et rigtigt hold i databasen, oprettet 15. marts sammen med "Eesy FM". Holdkonkurrencen viser alle hold der har medlemmer (undtagen Stab), og YouSee FM har 4 medlemsrækker, så det dukker op i tabellen. "Eesy FM" har 0 medlemmer og vises derfor ikke.

Holdet står med 0 kr, fordi det ikke har nogen klienter i `team_clients` — Eesy FM og Yousee er bundet til Fieldmarketing-holdet, og holdkonkurrencen tæller kun salg på eget holds klienter.

## Hvad der ændres

- De 4 medlemsrækker på YouSee FM flyttes til Fieldmarketing:
  - Yasmin Isabel Jakobsen (to medarbejder-records, `52a760ac…` og `8ba55760…`)
  - Nicolai Holst Vinther
  - Nellie Voldby Rau
- Findes personen allerede på Fieldmarketing, slettes dubletten i stedet for at oprette en ny række (én-hold-reglen respekteres).
- De to nu tomme hold "YouSee FM" og "Eesy FM" slettes, så de ikke kan dukke op igen.

## Resultat

- Holdkonkurrencen viser 5 hold: Fieldmarketing, TDC Erhverv, United, Eesy TM, Relatel.
- FM-sælgernes provision på både Eesy FM og Yousee tæller under Fieldmarketing (klienterne er allerede bundet dertil).
- Ingen ændring i individuel liga, point, divisioner eller løn.

## Teknisk

- Data-migration (ingen skemaændring, ingen kodeændring):
  - `UPDATE team_members SET team_id = <Fieldmarketing> WHERE team_id = <YouSee FM>` med `ON CONFLICT`/forudgående dubletsletning afhængigt af unik-constraint på (team_id, employee_id).
  - `DELETE FROM teams WHERE name IN ('YouSee FM','Eesy FM')` efter flytningen.
- Ingen ændring i `useLeagueTeamCompetition.ts`, `get_league_team_provision` eller `team_clients`.
- Bemærkning til senere: Yasmin har to medarbejder-records — ikke rørt her, men bør ryddes op separat.
