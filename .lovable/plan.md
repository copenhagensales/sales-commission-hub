## Start Sæson 3 + luk Sæson 2 korrekt

### Problem med Sæson 2
- S2 er markeret `completed`, men **runde 6 er stadig `active`** og slutter `2026-06-22 00:00:00 UTC` (= 02:00 dansk tid d. 22.). Salg fra d. 22. juni risikerer at blive talt med i S2's sidste runde.

### Fix Sæson 2 (data-update)
- Sæt runde 6's `end_date` til `2026-06-21 21:59:59+00` (= 23:59:59 dansk tid søn 21. jun).
- Sæt runde 6's `status = 'completed'`.
- Bekræft S2's `end_date = 2026-06-21` (allerede korrekt).
- Resultat: alt salg fra 22. juni og frem hører ikke længere til S2.

### Opret Sæson 3 (data-insert)
- **Provision/kvalifikation:** man 22. jun – søn 28. jun 2026
- **Tilmeldingsperiode:** man 22. jun – søn 28. jun 2026
- **Sæson:** man 29. jun – søn 9. aug 2026 (6 uger)
- Indsæt række i `league_seasons` med `season_number=3`, `status='qualification'`, `config` kopieret fra S2.
- Status skifter automatisk til `active` mandag 29. jun via cron.

### Tekniske noter
- Ingen kodeændringer.
- Eksekveres som `UPDATE` på `league_rounds` + `INSERT` i `league_seasons` via `supabase--insert`.
- S2 Hall of Fame bevares uændret.
- `league-calculate-standings` finder S3 automatisk når status er `qualification`.
