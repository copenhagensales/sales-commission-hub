# Sælgere kan se deres eget hold-månedsmål

I dag kan kun teamleder og assisterende teamleder se månedsmål-boardet for deres hold. Undtagelsen er Relatel, hvor hele holdet allerede har adgang.

## Ændring
Hele holdet får adgang til sit eget månedsmål-board:

| Board | Hold | I dag | Bliver |
|---|---|---|---|
| Eesy FM Månedsmål | Fieldmarketing | Kun ledelse | Hele holdet |
| Yousee FM Månedsmål | Fieldmarketing | Kun ledelse | Hele holdet |
| Eesy TM Månedsmål | Eesy TM | Kun ledelse | Hele holdet |
| TDC Månedsmål | TDC Erhverv | Kun ledelse | Hele holdet |
| Relatel Månedsmål | Relatel | Hele holdet | uændret |

- Sælgerne ser kun boardet for deres eget hold, ikke andre holds boards.
- Fieldmarketing er ét samlet hold, så alle FM-sælgere ser både Eesy FM og Yousee FM.
- Sælgerne kan kun se boardet. Kun teamledere og opefter kan ændre målene, og det er uændret.
- Boardet viser alle sælgere på holdet med navn, antal salg og mål, ligesom Relatel gør i dag.

## Teknisk
- Kun dataændring: `team_dashboard_permissions.access_level` sættes fra `leadership` til `all` for de 4 rækker. Ingen kode, ingen skemaændring og ingen ændring i rettigheder.
- Kan rulles tilbage ved at sætte værdien tilbage til `leadership`.
- Kontrol: Bagefter logger jeg ind som en sælger på Eesy TM og tjekker, at boardet vises i oversigten og kan åbnes.
