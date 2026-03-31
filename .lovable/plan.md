

## FM Tjekliste-system

Et ugentligt tjeklistesystem for fieldmarketing-assistenten med dagspecifikke opgaver, afkrydsning, noter og motiverende UI.

### Database (2 tabeller)

**`fm_checklist_templates`** — de faste opgaver (admin kan tilføje/fjerne):
- `id`, `title` (text), `description` (text, nullable), `weekdays` (integer[] — 0=mandag..6=søndag), `sort_order` (int), `is_active` (boolean default true), `created_at`, `created_by` (uuid)

**`fm_checklist_completions`** — afkrydsninger pr. uge:
- `id`, `template_id` (FK → fm_checklist_templates), `completed_date` (date), `completed_by` (uuid FK → employee_master_data), `note` (text, nullable), `created_at`
- Unique constraint: `(template_id, completed_date)` — kun én afkrydsning pr. opgave pr. dag

RLS: Samme adgang som FM booking (`menu_fm_booking`-brugere kan læse/skrive).

### Predefinerede opgaver (seedes)

| Opgave | Dage |
|--------|------|
| Sørg for alle er informeret om standere | Man |
| Tjek dubletter igennem | Dagligt |
| Tjek difference fra PB til IM | Dagligt |
| Pak alle biler til sælgerne | Man |
| Pak standere til sælgere m. offentlig transport | Man |
| Alle biler afleveret + kvittering m. billede. Ring ud hvis mangler | Søn |
| Tag billeder af dashboards i biler (lamper) | Man |
| Ryd biler op | Man |
| Tjek standere ved sygdom (især ved 3 stk.) | Dagligt |
| Tjek om sælgere er kørt tidligere dagen før | Dagligt (morgen) |
| Send kannibalisering + Arpu ud (flag >40% / <110) | Dagligt |

### Ny side: `src/pages/vagt-flow/FmChecklistContent.tsx`

- Viser ugens opgaver i en ugekalender-visning (man-søn kolonner)
- Hver opgave viser: titel, checkbox, tidspunkt for afkrydsning, hvem der afkrydsede, note-felt
- **Motiverende UI**: Progressbar pr. dag ("5/8 udført"), grønt fyld-animation ved afkrydsning, konfetti/check-animation ved 100%, streak-counter ("3 dage i træk fuldført")
- Ugenavigation (frem/tilbage)
- Historisk overblik: kan se tidligere uger

### Admin-sektion (på samme side)

- Tilføj ny opgave: titel, beskrivelse, vælg dage
- Fjern/deaktiver opgave
- Rækkefølge (drag eller pile)

### Integration i eksisterende system

1. **Ny tab i BookingManagement**: Tilføj "Tjekliste" tab med `permissionKey: "tab_fm_checklist"`
2. **Permission key**: Tilføj `tab_fm_checklist` i `permissionKeys.ts` under `menu_fm_booking`
3. **Permission group**: Tilføj til `permissionGroups.ts` under `menu_fm_booking` children
4. **Sidebar**: Tilføj i `PreviewSidebar.tsx` VAGT_FLOW_ITEMS

### Teknisk opsummering

- 1 database-migration (2 tabeller + RLS + seed-data)
- 1 ny lazy-loaded tab-komponent
- Hooks: `useFmChecklist` (hent templates), `useFmChecklistCompletions` (hent/mutér afkrydsninger)
- Opdater: `BookingManagement.tsx` (ny tab), `permissionKeys.ts`, `permissionGroups.ts`, `PreviewSidebar.tsx`

