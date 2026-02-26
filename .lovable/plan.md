

# Reducer Enreach sync-frekvens for at komme under delt API-kvote

## Problem

Alle 3 Enreach-integrationer (ASE, Tryg, Eesy) deler en global API-kvote hos Enreach/HeroBase. Den nuvaerende konfiguration sender ~180 API-kald/time, hvilket er langt over kvoten. Resultatet er 100% rate-limiting i 6+ timer.

## Nuvaerende vs. ny frekvens

```text
                    NU                          NY
Sales-sync:     hvert 5 min (12x/time/int)  -> hvert 15 min (4x/time/int)
Meta-sync:      hvert 30 min (2x/time/int)  -> hvert 60 min (1x/time/int)

Runs/time:      42 runs (180 API-kald)       -> 15 runs (~45 API-kald)
Reduktion:      ~75% faerre API-kald
```

## Nye cron-schedules (staggered)

| Job                   | Ny schedule              | Minut-offsets       |
|-----------------------|--------------------------|---------------------|
| enreach-eesy-sales    | 0,15,30,45 * * * *       | :00, :15, :30, :45  |
| enreach-tryg-sales    | 2,17,32,47 * * * *       | :02, :17, :32, :47  |
| enreach-ase-sales     | 4,19,34,49 * * * *       | :04, :19, :34, :49  |
| enreach-eesy-meta     | 10 * * * *               | :10                 |
| enreach-tryg-meta     | 25 * * * *               | :25                 |
| enreach-ase-meta      | 40 * * * *               | :40                 |

Stagger: Sales-jobs er forskudt 2 minutter. Meta-jobs er forskudt 15 minutter. Ingen overlap.

## Implementering

### Trin 1: Opdater cron-jobs i databasen

Kald `cron.unschedule()` for alle 6 eksisterende Enreach-jobs og `cron.schedule()` / `schedule_integration_sync()` med de nye schedules.

### Trin 2: Opdater integration-config

Opdater `sync_frequency_minutes` fra 3 til 15 og `sync_schedule` i `dialer_integrations.config` for alle 3 Enreach-integrationer, saa dashboard og ScheduleEditor viser korrekt frekvens.

### Trin 3: Nulstil circuit breaker

Reset `integration_circuit_breaker` for alle 3 integrationer, saa de kan begynde at synce med det samme efter opdateringen.

### Trin 4: Verificer

Vent 15-20 minutter og kør en forespørgsel for at se om 429-raten falder. Hvis Enreach stadig blokerer, kan det vaere nødvendigt at reducere yderligere (fx hvert 30. minut for sales).

## Risiko

- Lav risiko: Data opdateres hvert 15. minut i stedet for hvert 5. minut. For de fleste use cases er dette acceptabelt.
- Hvis kvoten stadig overskrides, kan vi reducere til hvert 30. minut som naeste trin.
- Ideel løsning paa sigt: Kontakt Enreach og bed om separate kvoter per integration eller højere samlet kvote.

