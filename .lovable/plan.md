

## Fjern stande/roll-ups påmindelser fra "Min kalender"

### Problem
Sælgerne får vist påmindelser om at medbringe og tage stande/roll-ups med hjem i deres kalender. Denne funktion skal fjernes helt.

### Ændring

**Fil: `src/pages/vagt-flow/MyBookingSchedule.tsx`**

1. **Fjern render-blokken** (linje 519-531) — de to conditional divs der viser "Husk at medbringe stande og roll-ups" og "Husk at tage stande og roll-ups med hjem"

2. **Fjern beregningen** af `isFirstBookingDay` og `isLastBookingDay` (linje 305-308, 334-335) samt fjern dem fra det mappede objekt, da de ikke bruges andre steder

3. **Fjern `Package`-ikonet** fra imports hvis det ikke bruges andetsteds i filen

