# Sebastian kan se, men ikke rette vagtplanen

## Hvad er bekræftet
- Sebastian (Assisterende Teamleder TM) har rollen `assisterendetm` og systemrollen `teamleder`.
- Rollen har `menu_shift_overview` = se + rette, `menu_section_vagtplan` = se + rette.
- Databasen tillader ham at ændre vagter (`shift`-politik `is_manager_or_above` → teamleder).
- Han har ingen personlige blokeringer.
- Knappen "Opret vagt" vises ud fra `canEdit("menu_shift_overview")` (`ShiftOverview.tsx:81, 1156`).

Rettighederne ser altså korrekte ud. Årsagen er endnu ikke fundet.

## Plan
1. Åbn vagtplanen i preview som Sebastian og se præcist, hvad der blokerer (manglende knap, fejl ved gem, eller en anden side, fx standardvagter).
2. Find den konkrete årsag (fil + linje eller databasefejl).
3. Ret kun den årsag – på rolle-niveau hvis det er rollen, ellers som personlig undtagelse for Sebastian.
4. Tjek bagefter, at han kan oprette og ændre en vagt, uden at andre roller ændres.

## Teknisk
- Kræver login som Sebastian i preview (godkendelseskort vises).
- Ingen ændringer i løn, provision eller timeberegning.
- Hvis det blot er gammel cache: han skal logge ud og ind, ingen ændring.
