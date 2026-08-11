# Gør "Ny sæson" tilgængelig i Superligaen

## Problem
`src/components/league/SeasonManagerCard.tsx` indeholder "Ny sæson"-knappen (linje 123), men komponenten er ikke importeret eller brugt nogen steder i koden. Der findes ingen liga-admin side (kun ruten `/n` → `CommissionLeague.tsx`, som ikke viser sæson-administration). Sæson 4 kan derfor ikke oprettes fra brugerfladen i dag.

## Løsning
Vis sæson-administrationen på liga-siden `/n`, øverst, kun for brugere med adgang:

1. Monter `SeasonManagerCard` i `src/pages/CommissionLeague.tsx` bag et adgangstjek.
2. Adgang styres via permission-systemet (ikke hardkodet rolle-key) — redigeringsrettighed til `menu_commission_league`, dvs. ejer og de ledere der har edit-adgang.
3. Ingen ændringer i sæson-logik, cron-jobs eller `league-process-round`. Kortet bruger de eksisterende hooks, så det automatiske flow (divisioner + Runde 1 ved aktivering) fungerer uændret.

## Teknisk
- Fil: `src/pages/CommissionLeague.tsx` (grøn/gul zone — UI only)
- Import af `SeasonManagerCard` + `useUnifiedPermissions`/`usePositionPermissions` edit-tjek på `menu_commission_league`
- `SeasonSettingsDialog.tsx` og `SeasonManagerCard.tsx` genbruges uændret; verificeres at oprettelses-mutationen invaliderer `league-seasons`-cachen
- Ingen DB-migration, ingen edge function-ændring

## Efter godkendelse
Når knappen er synlig, kan Sæson 4 oprettes med datoer for kvalifikation, tilmelding og sæsonperiode — hvorefter cron-flowet tager over.
