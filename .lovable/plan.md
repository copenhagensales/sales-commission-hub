

# Fix: Stande/roll-ups påmindelser kun på første og sidste dag

## Problem
Påmindelsen om stande og roll-ups vises i dag på mellemliggende dage i en booking, i stedet for kun den absolut forste og sidste dag.

## Arsag
Queryen der henter alle booking-datoer (`allBookingDates`) filtrerer pa `employee_id`, hvilket betyder den kun finder datoer hvor den specifikke medarbejder er tildelt. Hvis medarbejderen ikke er tildelt alle dage i bookingen, kan "forste" og "sidste" dag beregnes forkert. Derudover kan timing-problemer betyde at `allBookingDates` ikke er loadet endnu nar `dayData` beregnes, sa `range` bliver `undefined` og logikken falder igennem.

## Losning
Andre queryen til at hente alle datoer for bookingen uafhaengigt af medarbejder -- sa vi far den rigtige forste og sidste dag for hele bookingen (ikke kun for den enkelte medarbejder). Derudover tilfojes en ekstra sikkerhed sa callouts aldrig vises nar data mangler.

## Tekniske aendringer

### `src/pages/vagt-flow/MyBookingSchedule.tsx`
1. **Ret `allBookingDates` queryen** -- fjern `.eq("employee_id", employeeId)` filteret, sa den henter ALLE assignment-datoer for de relevante bookings (uanset medarbejder). Dette giver den korrekte forste/sidste dag for hele bookingen.

2. **Opdater query key** -- fjern `employeeId` fra query key da det ikke laengere bruges som filter.

3. **Tilfoej guard i renderingen** -- Vis kun callouts nar `allBookingDates` er loaded (ikke `undefined`), sa der aldrig vises forkerte paemindelser mens data hentes.

4. **Behold UI uaendret** -- Gronne og orange callouts forbliver som de er, bare med korrekt logik bag.
