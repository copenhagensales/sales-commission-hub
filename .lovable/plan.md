

# Plan: Synkroniser booking-bekræftelsessiden med redigerbar tekst

## Problem
1. **BookingPagesTab** (admin-preview) har hardcoded "Hvad sker der nu?"-sektion med faste tekster
2. **PublicCandidateBooking** (den rigtige kandidatside) har sine egne hardcoded tekster
3. Kun `title` og `tip_text` bruges fra databasen — `body_lines` ignoreres begge steder
4. Preview og kandidatside viser forskellige tekster

## Løsning
Gør `body_lines` fra `booking_page_content`-tabellen til den autoritative kilde for bullet-punkterne, og brug dem både i preview og på den rigtige side.

## Ændringer

### 1. `src/pages/recruitment/PublicCandidateBooking.tsx` (booking success-visning, linje 163-196)
- Hent `body_lines` fra `pageContent` (allerede loaded)
- Erstat de 3 hardcoded `<li>`-elementer med en loop over `body_lines`
- Behold fallback-defaults hvis `body_lines` er tomme

### 2. `src/components/recruitment/BookingPagesTab.tsx` (BookingSuccessPreview, linje 183-213)
- Erstat den hardcoded "Hvad sker der nu?"-sektion med `page.body_lines`
- Vis `body_lines` som bullet points i stedet for faste tekster
- Behold den hardcoded eksempel-tekst ("Oscar ringer dig tirsdag d. 22. april…") som demo af den dynamiske dato/tid

### 3. Ingen databaseændringer
`body_lines` eksisterer allerede i `booking_page_content`-tabellen. De skal blot populeres med de rigtige tekster hvis de er tomme.

## Resultat
- Admin ser det samme som kandidaten
- Ændringer i editoren slår igennem på den rigtige side
- Bullet-punkterne kan tilpasses uden kodeændringer

