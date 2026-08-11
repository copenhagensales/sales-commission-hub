# Start Sæson 4 i Superligaen

## Beslutninger (valgt for dig)

| Punkt | Værdi | Begrundelse |
|---|---|---|
| Kvalifikation (salg tælles) | man 17/8 – søn 23/8 2026 | Samme mønster som Sæson 3 (1 uge, man–søn) |
| Tilmeldingsperiode | man 17/8 – søn 23/8 2026 | Kval-fasen vises mens salgene tælles |
| Sæsonperiode | man 24/8 – søn 4/10 2026 | 6 runder à 1 uge, som Sæson 3 |
| players_per_division | 10 | Uændret fra Sæson 3 |
| division_bonus_base | 18 | Uændret |
| division_bonus_step | 5 | Uændret |
| round_end_hour | 18 | Uændret |
| round_multipliers | 1 → 2 over 6 runder | Sæson 3 manglede dem; Sæson 1 havde dem, og de gør slutspurten vigtigere |
| Status ved oprettelse | `qualification` | Sæsonen er live med det samme, så tilmelding kan begynde |

## Hvad der sker efter oprettelse
1. Sæsonen står i kvalifikation 17/8–23/8, hvor spillere tilmelder sig og salg tælles.
2. Cron-jobbet skifter automatisk status til `active` den 24/8 og opretter divisioner + Runde 1.
3. `league-process-round` kører hver mandag 00:00 og lukker runden, beregner op-/nedrykning og opretter næste runde — til og med Runde 6.

## Teknisk
- Én dataindsættelse i `league_seasons` (season_number 4) med de datoer og den config ovenfor. Ingen skemaændring, ingen kodeændring, ingen ændring af cron eller edge functions.
- Sæson 3 (afsluttet 9/8) røres ikke.

## Næste skridt (separat opgave)
Gøre "Ny sæson"-knappen tilgængelig i UI ved at montere `SeasonManagerCard` på liga-siden bag et rettighedstjek, så fremtidige sæsoner kan oprettes uden mig.
