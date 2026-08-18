# Saml FM-holdene i hold-konkurrencen (kun der)

## Hvorfor rækken dukkede op i dag

Ingen kode er ændret. "YouSee FM" har ligget i databasen siden 15. marts uden medlemmer, og hold-konkurrencen viser kun hold der har medlemmer. I dag kl. 13:53–13:59 blev 4 medlemsrækker oprettet på holdet (Yasmin ×2, Nicolai Holst Vinther, Nellie Voldby Rau — alle med start 24. august), fordi opstartsholdet "Opstart 24. august 2026" har YouSee FM som tilknyttet hold. Derfor kom rækken frem — med 0 kr, fordi holdet ikke har klienter.

## Hvad der ændres

Kun visningen/beregningen i hold-konkurrencen under Superligaen:

- Medlemmer af "YouSee FM" og "Eesy FM" tælles med under **Fieldmarketing** i hold-konkurrencen.
- Holdene "YouSee FM" og "Eesy FM" vises ikke som selvstændige rækker i hold-konkurrencen (som Stab i dag).
- Provisions-matchningen mod holdets klienter bruger Fieldmarketing, så FM-salg (Eesy FM + Yousee) tæller korrekt for de flyttede medlemmer.

Resultat: 5 hold i tabellen — Fieldmarketing, TDC Erhverv, United, Eesy TM, Relatel.

## Hvad der IKKE ændres

- Ingen data ændres: `team_members`, `teams`, `onboarding_cohorts` og `team_clients` står som de er.
- Individuel liga, point, divisioner, rapporter, løn og øvrige moduler er urørt.
- Konsekvens: den samme situation kan opstå igen andre steder end hold-konkurrencen, hvis nye FM-ansatte lander på "YouSee FM"-holdet. Det tages op separat hvis I ønsker det.

## Teknisk

- `src/hooks/useLeagueTeamCompetition.ts`: alias-mapping i aggregeringen, så `team_id` for "YouSee FM" og "Eesy FM" oversættes til Fieldmarketing-holdets id før gruppering og før klient-matchningen i `get_league_team_provision`.
- `src/components/league/TeamStandingsTable.tsx`: de to hold ekskluderes fra rækkelisten (samme mønster som Stab-udelukkelsen).
- Ingen migration, ingen data-ændring, ingen ændring i RPC'en.
