# Start Sæson 4 i Superligaen

## Datoer og indstillinger

| Punkt | Værdi |
|---|---|
| Kvalifikation (salg tælles) | man 10/8 – søn 16/8 2026 |
| Tilmeldingsperiode | man 10/8 – søn 16/8 2026 |
| Sæsonperiode | man 17/8 – søn 27/9 2026 (6 runder à 1 uge) |
| Status ved oprettelse | `qualification` — live med det samme |
| players_per_division | 10 (som Sæson 3) |
| division_bonus_base | 18 |
| division_bonus_step | 5 |
| round_end_hour | 23 med minut 55 (23:55) — ændret fra 18 |
| round_multipliers | 1 · 1,2 · 1,4 · 1,6 · 1,8 · 2 (som Sæson 1) |

Runderne bliver: 17–23/8, 24–30/8, 31/8–6/9, 7–13/9, 14–20/9, 21–27/9.

Kvalifikationen starter 10/8 kl. 00:00 dansk tid, så mandagens og gårsdagens salg tæller med.

## Teknisk

- Én dataindsættelse i `league_seasons` (season_number 4) med datoerne og config ovenfor. Ingen skemaændring, ingen ændring af cron/edge functions.
- `round_end_hour` er i dag et heltal (18). For at ramme 23:55 tilføjes `round_end_minute: 55` i config, og `league-process-round` + de steder der læser `round_end_hour` udvides til at bruge minuttet med fallback til 0. Det er en lille kodeændring i rundeafslutningslogikken — den påvirker kun liga-modulet.
- Sæson 1–3 (completed) røres ikke.

## Efter oprettelse

1. Sæsonen står i kvalifikation 10/8–16/8, hvor spillere tilmelder sig og salg tælles.
2. Cron skifter status til `active` den 17/8 og opretter divisioner + Runde 1.
3. `league-process-round` lukker hver runde og opretter den næste til og med Runde 6.

## Næste skridt (separat opgave)

Montere `SeasonManagerCard` på liga-siden bag rettighedstjek, så fremtidige sæsoner kan oprettes fra UI.
