# Udeluk to medarbejdere fra "Sæsonens Talent"

William Sean (wh@cph-relatel.dk) og Jacob Nielson (jani@cph-relatel.dk) fjernes kun fra Talent-prisen. De forbliver med i stillinger, point, divisioner, Top 3, Bedste Runde, Comeback og TV-boards.

## Sådan virker det
- Ny lille liste i databasen over medarbejdere, der ikke kan vinde Talent. De to tilføjes (slået op via deres arbejdsmail til medarbejder-id).
- Talent-beregningen springer dem over; næste kvalificerede nyansatte rykker op som vinder.
- Gælder alle sæsoner fremover, indtil de fjernes fra listen. Ingen historiske data ændres.

## Teknisk
- Migration: `public.league_talent_exclusions (employee_id uuid PK -> employee_master_data, reason text, created_at)`, GRANT SELECT til authenticated + ALL til service_role, RLS: SELECT for authenticated; skrivning kun service_role.
- Data: indsæt de to medarbejder-id'er (via run_sql, opslag på `work_email`). Stop og rapportér, hvis en mail ikke matcher præcis én medarbejder.
- `src/hooks/useLeaguePrizeData.ts`: hent eksklusionslisten og filtrér begge Talent-grene (point- og provision-variant, linje ~177 og ~207).
- `supabase/functions/tv-league-data/index.ts`: samme filter i begge Talent-grene (~linje 497 og 614), så TV viser det samme. Deploy.
- Ingen hardkodede mails/id'er i koden. Ingen ændring i point, provision, løn eller tilmeldinger.
- Kontrol: ligasiden viser ny Talent-vinder; William står stadig i Top 3 og stillinger.
