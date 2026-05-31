## Problem

I `Dagsrapporter` viser kundefilteret kun de 7 første kunder (A&Til → Eesy FM). De resterende 7 (Eesy TM, Finansforbundet, Just Eat, Relatel, TDC Erhverv, Tryg, Yousee) findes i DB og hentes korrekt af `["daily-report-clients"]`-querien, men de er gemt under en usynlig scroll.

Root cause: `src/components/reports/MultiSelectFilter.tsx:87` bruger `<ScrollArea max-h-[280px]>`. shadcn's `ScrollArea` viser kun scrollbar ved hover, og 280px rummer præcis ~7 rækker. Listen ser derfor afsluttet ud.

## Fix

Én fil: `src/components/reports/MultiSelectFilter.tsx`

1. Hæv `max-h` fra `280px` til `360px` (≈9 rækker) så de fleste use cases får hele listen frem direkte.
2. Vis altid en diskret scrollbar når indholdet overflyder, så det er tydeligt at man kan scrolle. Enten:
   - skift `ScrollArea` ud med en simpel `<div className="max-h-[360px] overflow-y-auto pr-2">` (native scrollbar = altid synlig), eller
   - behold `ScrollArea` og style `ScrollBar` til altid synlig.
   Anbefaling: native `overflow-y-auto` — enklere, ingen hover-gotcha, samme mønster bruges andre steder.

## Zone

Grøn zone — ren UI-komponent uden forretningslogik. Komponenten bruges også af team-/medarbejder-/kampagne-filtrene på samme side, så de får samme forbedring (ønsket bivirkning).

## Verifikation

Åbn `/reports/daily`, klik Kunder-dropdown, bekræft alle 14 kunder kan ses/scrolles til og vælges.
