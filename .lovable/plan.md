# Hele Relatel-teamet får adgang til "Relatel Månedsmål"

## Bekræftet i dag

- Team **Relatel** har adgangsniveau `leadership` til `relatel-monthly-goal` (kun teamleder + assisterende).
- Team **TDC Erhverv** har `leadership` til `tdc-monthly-goal` — dette ændres ikke.

## Hvad der ændres

- Relatel ændres fra **Ledelse (TL + ATL)** til **Hele teamet** for boardet `relatel-monthly-goal`.
- Alle medlemmer af Relatel-teamet får dermed boardet i menuen under Boards.
- TDC Erhverv forbliver uændret på Ledelse.

## Teknisk

- Én dataopdatering: `UPDATE public.team_dashboard_permissions SET access_level = 'all' WHERE team_id = 'f4210d48-5062-4e3a-b945-7ff1d5a874dd' AND dashboard_slug = 'relatel-monthly-goal'`.
- Ingen kodeændringer, ingen skemaændring, ingen ændring i rettighedssystemet.
- `useAccessibleDashboards` rammer `case 'all'` for alle team-medlemmer.
- Verifikation: læs rækken tilbage. Brugere skal genindlæse siden (cache 30 sek.).
