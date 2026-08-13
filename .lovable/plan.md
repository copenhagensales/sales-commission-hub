# Læs hele karriereønsket

## Hvorfor teksten er afkortet i dag
På Karriereønsker-oversigten er motivationsteksten sat til én linje med `truncate` (`src/pages/CareerWishesOverview.tsx:291` og `:296`). Rækken har ingen klik-handling — det eneste klikbare element er "Markér"-knappen (linje 246). Derfor kan man ikke åbne og læse hele teksten; kun browserens tooltip (`title`) viser den, og den er svær at læse.

## Hvad der bygges
1. Rækkerne bliver klikbare (cursor-pointer + hover-markering). Klik åbner en dialog med hele indsendelsen:
   - Medarbejder, afdeling, dato, status
   - Ønsket team + fuld motivation for teamskifte
   - Ledelsesinteresse, rolletype + fuld motivation
   - Øvrige kommentarer
   - Knap i dialogen til at markere som behandlet/ubehandlet
2. "Markér"-knappen i rækken beholdes og stopper klik-propagering, så den ikke åbner dialogen.
3. I tabellen vises detaljer stadig kortet af, men over to linjer (`line-clamp-2`) så man får mere med i overblikket.

## Teknisk
- Kun `src/pages/CareerWishesOverview.tsx` ændres (grøn zone, ren UI).
- Bruger eksisterende shadcn `Dialog` + lokal `useState` til valgt ønske. Ingen nye queries, ingen databaseændringer.
