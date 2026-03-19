

# Plan: Redeploy send-closing-reminder

## Problem
Oscar Belcher (weekday 3 = onsdag) fik ikke sin lukkevagt-påmindelse i går. Data i `closing_shifts` tabellen er korrekt — Oscar er sat op på weekday 3 med email `oscar@copenhagensales.dk` og telefon `+4553383972`. Cron-jobbet kører kl. 15:00 UTC (16:00 dansk tid) på hverdage.

**Men der er ingen logs overhovedet** for `send-closing-reminder` funktionen, hvilket tyder på at funktionen ikke er deployet.

## Løsning
Redeploy `send-closing-reminder` edge function. Ingen kodeændringer nødvendige — kun deployment.

## Teknisk detalje
- Cron-jobbet `closing-shift-reminder` eksisterer og kalder funktionen korrekt med `{"auto": true}`
- Funktionens kode er korrekt: den mapper JavaScript `getDay()` til weekday 1-7 og slår op i `closing_shifts`
- Oscar er korrekt konfigureret på weekday 3 (onsdag)
- Eneste problem: funktionen er ikke deployet, så cron-kaldet fejler

