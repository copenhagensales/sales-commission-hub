# Hvorfor der stadig står 112 tilmeldte

Årsagen er fundet, med bevis i loggen: cron-kørslen kl. 11:30 (dansk tid) kørte **den gamle jobtitel-baserede** tilmelding igen.

Log fra `league-calculate-standings` kl. 09:30 UTC:

```text
[sync-enrollments] 112 eligible employees found for season 8ae8eec6-...
[sync-enrollments] Upserted 112 enrollments (existing rows preserved)
```

Den tekst findes ikke i den nye kode (som skriver "nye tilmeldinger fra salg"). Funktionen kører altså fortsat en ældre udgave — koden er rettet i repoet, men den nye version er ikke aktiv i driften.

Konsekvens i data lige nu (Sæson 4):

| Tal | Værdi |
|---|---|
| Tilmeldte i alt | 113 |
| Tilmeldte med salg siden 10/8 | 55 |
| Tilføjet uden salg kl. 11:20–11:30 | 58 |

Oprydningen i går/tidligere virkede — de 58 er nye rækker, cron lagde ind igen bagefter.

## Hvad der skal gøres

1. Genudrul `league-calculate-standings`, så den salgs-baserede opsamling faktisk kører i driften. Verificeres i loggen ved næste kørsel: teksten skal være "nye tilmeldinger fra salg".
2. Kør oprydningen igen for Sæson 4: fjern tilmeldinger uden salg i sæsonens periode (fra 10/8), som ikke er oprettet manuelt bagefter. Forventet resultat: 113 → 55.
3. Kør `league_enroll_from_sales` for Sæson 4 fra 10/8 som kontrol, så ingen med salg mangler.
4. Bekræft tallet på ligasiden efter næste cron-kørsel (max 15 min), så vi ser at det holder — ikke kun lige efter oprydningen.

## Teknisk

- Ingen ny logik. Trigger `trg_league_enroll_on_sale`, `league_enroll_from_sales` og `league_resolve_employee_from_agent_email` er allerede oprettet og virker (55 sælgere med salg er koblet korrekt).
- Den jobtitel-baserede sti (`_shared/leagueEligibility.ts` i standings-funktionen) skal ikke længere kunne tilmelde. Efter genudrulning er det kaldested væk; filen bliver ubrugt her.
- Oprydning sker som datasletning i `league_enrollments` for Sæson 4 alene. Tidligere sæsoner røres ikke.

## Rører ikke

- Point, runder, standings-beregning eller cron-frekvens.
- Manuelle tilmeldinger og fan-status oprettet efter den nye logik.
