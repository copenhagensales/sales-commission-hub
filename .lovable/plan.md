## Konklusion

Thorbjørn har `can_work_fm = true` og har en bekræftet Eesy FM-vagt, men adgangen til selve menupunktet/ruten “Salgsregistrering” styres stadig primært af rolle/permissions.

Evidens:
- `employee_master_data`: Thorbjørn Mindedal Weichert har `job_title = Salgskonsulent`, `can_work_fm = true`, aktiv bruger og booking på Eesy FM 2026-07-04/05.
- `src/pages/vagt-flow/Bookings.tsx:146-154` og `src/pages/vagt-flow/BookingsContent.tsx:210-269` inkluderer allerede `can_work_fm = true` når man skal kunne bookes på FM-vagter.
- `src/routes/config.tsx:242-245` beskytter `/vagt-flow/sales-registration` med `menu_fm_sales_registration`.
- `src/components/layout/AppSidebar.tsx:432-437` kræver også `menu_section_fieldmarketing`, og rollen `medarbejder` har `menu_section_fieldmarketing = false` i databasen.

## Plan

1. **Lav én samlet FM-opt-in-regel**
   - Udvid den eksisterende `useIsFieldmarketingEmployee`-hook, så den returnerer `true` når medarbejderen enten:
     - har `job_title = Fieldmarketing`, eller
     - har `can_work_fm = true`.
   - Det matcher allerede booking-logikken, så “kan bookes på FM-vagter” betyder det samme på tværs af systemet.

2. **Åbn salgsregistrering-ruten for FM-opt-in**
   - Justér route guard for netop `/vagt-flow/sales-registration`, så adgang gives hvis brugeren enten har permission `menu_fm_sales_registration` eller er FM-opt-in via `can_work_fm`.
   - Behold alle andre FM-admin-sider bag nuværende permissions.

3. **Vis salgsregistrering i menuen for FM-opt-in**
   - Justér sidebarens Fieldmarketing-sektion, så `Salgsregistrering` vises for FM-opt-in-brugere, uden at give dem adgang til booking management, lokationer, fakturering osv.

4. **Sørg for at dagens/tidligere booking stadig styrer salgsformularen**
   - `SalesRegistration.tsx` skal fortsat kræve en faktisk booking_assignment for dagens dato eller callback-dato.
   - Der ændres ikke på pricing, løn, sale_items eller RLS.

5. **Verificér**
   - Bekræft i preview/logik at Thorbjørn kan se/åbne Salgsregistrering.
   - Bekræft at formularen finder hans Eesy FM-booking ved callback-dato 2026-07-05.
   - Bekræft at andre FM-admin-sider ikke åbnes af `can_work_fm` alene.

## Zone

Dette er gul zone: sidebar/navigation + FM-booking/salgsregistrering UI/adgang. Ingen rød-zone filer, ingen DB-skemaændring, ingen løn/pricing-ændring.