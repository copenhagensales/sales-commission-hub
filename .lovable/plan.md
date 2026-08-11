# Tydeliggør opdateringstidspunkt på Superliga-tavlen

Frekvensen ændres ikke — standings genberegnes hvert 15. minut, hvilket matcher hvor ofte salgene kommer ind fra dialerne. I stedet gøres det tydeligt for sælgerne, hvornår næste opdatering kommer, så ingen tror tavlen er gået i stå.

## Hvad ændres

I stedet for:

```text
Opdateret 11:15
```

vises:

```text
Opdateret 11:15 · næste ca. 11:30
```

Beregnes ud fra det viste opdateringstidspunkt plus 15 minutter. Hvis tidspunktet er mere end 45 minutter gammelt (dvs. noget er gået galt i cron-kørslen), vises i stedet en dæmpet advarsel: "Opdateret 11:15 · opdatering forsinket".

## Teknisk

- Kun `src/pages/CommissionLeague.tsx` (linje ~709) ændres — ren visning, ingen ny datahentning.
- Kilden er fortsat `standings[0].last_calculated_at`.
- Intervallet på 15 minutter lægges i en konstant i samme fil med kommentar om, at den skal matche cron-jobbet `league-standings-refresh` (`*/15 * * * *`).
- Grøn zone: udelukkende UI-tekst.

## Ingen ændringer i

- Cron-jobs (`league-standings-refresh`, `league-process-round-hourly`, `league-auto-advance-seasons`).
- Edge functions og beregningslogik.
