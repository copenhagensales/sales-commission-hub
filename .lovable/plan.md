## Fix: Beregn manglende R6-data for Sæson 2

### Årsag
Runde 6 blev aldrig processeret af `league-process-round`. Den havde tidligere end_date = `2026-06-22 00:00:00 UTC` og var stadig `active`, men S2 nåede status `completed` før cron'en fik nået at processere runden. Da `league-process-round` kun arbejder på sæsoner med `status='active'`, blev R6 sprunget over — derfor 0 rækker i `league_round_standings` for R6.

Min sidste ændring satte R6 til `completed` direkte uden at beregne standings, hvilket forværrede tilstanden.

### Fix
1. Sæt R6 tilbage til `status='active'` (data-update).
2. Sæt S2 midlertidigt til `status='active'` (data-update).
3. Kald edge function `league-process-round` med `{ seasonId: <S2.id> }`. Den finder R6 (nu active + end_date i fortid), beregner provision via `get_sales_aggregates_v2` for vinduet **11.–21. juni** (R6's `start_date` til `end_date 2026-06-21 21:59:59+00`), skriver `league_round_standings`, opdaterer `league_season_standings` og sætter R6 til `completed`.
4. Sæt S2 tilbage til `status='completed'`.

### Verifikation
- `SELECT count(*) FROM league_round_standings WHERE round_id = R6` skal returnere 47 (samme som de øvrige S2-runder).
- UI viser R6-data på `/commission-league`.

### Tekniske noter
- Ingen kodeændringer.
- R6's end_date forbliver `2026-06-21 21:59:59+00` så salg fra 22. juni IKKE tælles med.
- S3 berøres ikke.
