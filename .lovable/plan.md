# Eesy TM boards – opdaterer de ikke?

## Fund indtil nu (read-only, intet ændret)

- Hentningen fra Eesy TM-dialeren kører hvert ca. 15. min og melder "success" (seneste 15:28 dansk tid). Ingen fejl.
- Seneste Eesy TM-salg i Stork: salgstid 14:25, registreret 14:43 dansk tid. Derefter er der ikke kommet nye salg ind (de sidste tre hentninger fandt 0 nye).
- Boardet opdaterer selv: det beregner Eesy TM-tal for i dag på ny hvert minut (seneste 15:34).
- I dag 31 salg i alt mod 57–69 på en normal hverdag; mellem 13 og 16 er der 10 mod normalt 17–25.

Konklusion indtil videre: boardet og hentningen virker. Der kommer bare ingen nye salg ind fra dialeren. Enten er der reelt ikke lukket salg siden 14:25, eller også ligger der salg i dialeren, som Stork ikke får fat i.

## Næste skridt (read-only)

1. Spørg dialeren direkte (kun læsning) om lukkede Eesy TM-salg i dag efter kl. 14:00 og tæl dem.
2. Sammenlign antallet med Storks 31. Vis kun antal pr. time og pr. kampagne – ingen kundedata.
3. Hvis dialeren har flere: find årsagen (fx ny kampagne uden kobling, ændret status eller felt), og rapportér. Der rettes intet uden godkendelse.

## Teknisk

- `dialer_integrations` "Eesy TM" (adversus) last_status success; `integration_sync_runs` 13:28 UTC records 0, 13:16 UTC 136 (fuld genhentning, ingen nye).
- Opslaget sker i den eksisterende read-only diagnose-funktion mod Adversus; ingen skrivning i databasen.
