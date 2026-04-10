

## Lettere opgavetilføjelse: Engangs- og tilbagevendende opgaver

### Problem
I dag kræver det at åbne "Administrer"-panelet for at tilføje en opgave, og der er ingen skelnen mellem engangs- og tilbagevendende opgaver.

### Løsning

**1. Database: Tilføj `one_time_date` kolonne**
- Tilføj `one_time_date DATE NULL` til `fm_checklist_templates`
- Hvis sat: opgaven vises kun på den specifikke dato (engangopgave)
- Hvis NULL: opgaven fungerer som i dag med `weekdays`-arrayet (tilbagevendende)

**2. "+" knap under hver dag**
- Tilføj en lille `+`-knap i bunden af hver dags kolonne
- Klik åbner en inline popover/input direkte på dagen
- Bruger skriver blot en titel og trykker Enter eller "Tilføj"
- Opretter en template med `one_time_date = den pågældende dato` og `weekdays = []`
- Hurtig, minimal friktion

**3. Opdater visningslogik**
- `getTasksForDay()` viser nu også one-time tasks der matcher datoen (udover tilbagevendende via weekdays)
- One-time tasks vises med et lille engangsbadge så man kan skelne dem

**4. Admin-panelet: Tilbagevendende markering**
- Den eksisterende "Tilføj ny opgave" i admin forbliver for tilbagevendende opgaver
- Tydeliggør at admin-flowet er til tilbagevendende (ugedage-vælgeren er allerede der)

### Teknisk opsummering
- 1 migration: `ALTER TABLE fm_checklist_templates ADD COLUMN one_time_date date NULL`
- Opdater `useFmChecklistTemplates` query til også at hente one-time tasks for den aktuelle uge
- Opdater `FmChecklistContent.tsx`: tilføj `+`-knap per dag, popover med titel-input, og opdater `getTasksForDay()`
- Tilføj `useAddOneTimeTask` hook der kalder `addTemplate` med `one_time_date` og `weekdays: []`

