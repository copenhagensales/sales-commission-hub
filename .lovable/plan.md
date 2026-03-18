

# AMO Compliance Hub - Implementeringsplan

## Overblik

Bygge et komplet AMO (Arbejdsmiljøorganisation) compliance-modul ind i den eksisterende Copenhagen Sales-app. Modulet får sin egen sektion i sidebaren, egne databasetabeller, storage bucket, og audit log.

Grundet omfanget anbefaler jeg at bygge dette i **4 faser**. Hver fase leverer funktionel værdi og kan testes selvstændigt.

---

## Fase 1 — Fundament (database, navigation, dashboard)

### Database (migration)
Oprette ~15 tabeller:

- `amo_workplaces` (id, name, address, employee_count, notes, created_at)
- `amo_members` (id, workplace_id, full_name, email, employee_id FK, role_type ENUM, start_date, end_date, active, training_required, prior_valid_training, notes)
- `amo_roles` ENUM: admin, ledelsesrepresentant, arbejdsleder, amr, readonly
- `amr_elections` (id, member_id, elected_date, election_period_months DEFAULT 24, next_election_due, election_document_url, notes)
- `amo_annual_discussions` (id, date, participants, previous_year_eval, goals, collab_model, meeting_cadence, minutes_url, follow_up_tasks, approved_by, next_due_date, status)
- `amo_meetings` (id, meeting_type ENUM, planned_date, actual_date, attendees, agenda, minutes_url, decisions, action_items, next_meeting_date, status ENUM, related_documents)
- `amo_apv` (id, title, workplace_id, start_date, completed_date, next_due_date, reason ENUM, physical_env, psychological_env, sickness_review, findings, risk_level, action_plan, responsible_owner, deadline, follow_up_status, evidence_documents)
- `amo_kemi_apv` (id, product_name, supplier, product_type, hazard_flag, sds_url, storage_notes, work_process, exposure_risk, protective_measures, instructions, responsible_owner, review_date, next_review_due, related_apv_id)
- `amo_training_courses` (id, member_id, training_type ENUM, requirement_applies, membership_start, deadline_date, offered_date, completed_date, provider, certificate_url, status, notes)
- `amo_documents` (id, title, category, related_module, related_member_id, related_workplace_id, upload_date, document_date, expiry_date, owner, version, tags, doko_reference, file_url, comments)
- `amo_tasks` (id, title, description, related_module, related_record_id, owner_id, due_date, priority ENUM, status ENUM, evidence_required, reminder_schedule)
- `amo_compliance_rules` (id, rule_name, rule_type ENUM lovpligtigt/anbefalet/intern, description, check_logic_key, interval_months, active)
- `amo_audit_log` (id, user_id, action, table_name, record_id, old_values JSONB, new_values JSONB, created_at)

Storage bucket: `amo-documents` (public: false)

RLS: Alle tabeller med RLS baseret på brugerens system_role (ejer/teamleder har fuld adgang; andre authenticated users har read-only).

### Permissions
Tilføj til `permissionKeys.ts`:
- `menu_section_amo` (sektion)
- `menu_amo_dashboard`, `menu_amo_organisation`, `menu_amo_annual_discussion`, `menu_amo_meetings`, `menu_amo_apv`, `menu_amo_kemi_apv`, `menu_amo_training`, `menu_amo_documents`, `menu_amo_tasks`, `menu_amo_settings`, `menu_amo_audit_log`

### Navigation
Tilføj AMO-sektion i `AppSidebar.tsx` med ikon (Shield) og undermenu.

### Routes
Alle under `/amo/*` med role-based access via positionPermission.

### Dashboard-side (`/amo`)
- Compliance score beregnet fra data (ikke hardcodet)
- Statuskort med rød/gul/grøn for: næste møde, årlig drøftelse, APV, Kemi-APV, AMR-valg, uddannelse, manglende dokumenter
- Widget: "Manglende dokumentation", "Seneste uploads", "Åbne opgaver"

### Seed data
Indsæt de angivne medlemmer, mødedatoer, APV/Kemi-APV datoer og data quality warning for "William Seiding" vs "William Hoe".

---

## Fase 2 — Kernemoduler (organisation, møder, APV)

### AMO Organisation (`/amo/organisation`)
- CRUD for arbejdspladser og medlemmer
- Automatisk compliance-beregning baseret på medarbejderantal (< 10, 10-34, 35+)
- AMR-valg med udløbsberegning
- Visuel organisationsstruktur

### Møder og referater (`/amo/meetings`)
- Opret/rediger møder med agenda, referat, beslutninger
- Auto-generér agendaskabelon
- Auto-opret opfølgningsopgaver fra beslutninger
- Status: planlagt/gennemført/overskredet/aflyst

### Årlig drøftelse (`/amo/annual-discussion`)
- Formular med alle påkrævede felter
- Due date-beregning (12 mdr)
- Påmindelser 60/30/7 dage før
- Krav om referat-upload for grøn status

### APV (`/amo/apv`)
- CRUD med alle felter inkl. handlingsplan
- 3-års cyklus tracking
- Overdue = rød
- Upload af evidensdokumenter

---

## Fase 3 — Kemi-APV, uddannelse, dokumentcenter

### Kemi-APV (`/amo/kemi-apv`)
- Produktliste med sikkerhedsdatablade
- Hazard flag trigger for kemisk risikovurdering
- Link til APV-handlingsplaner

### Uddannelse og certifikater (`/amo/training`)
- Kursustypeer: obligatorisk 3-dag, supplerende, internt, lovmæssig opdatering
- Deadline-beregning: 3 mdr efter start for AMR/arbejdsleder
- Advarsel ved manglende certifikat
- Data quality warning ved navneforskel

### Dokumentcenter (`/amo/documents`)
- Upload med metadata og kategori-tagging
- Versionshistorik
- DOKO-referencefelt
- Manglende dokument-detektion
- Preview og download

---

## Fase 4 — Opgaver, notifikationer, eksport, audit

### Opgaver og deadlines (`/amo/tasks`)
- Opgavemotor med prioritet, status, ejer
- Påmindelseslogik for alle moduler
- Eskalering af overskredte items

### Compliance regler (`/amo/settings`)
- Regelmotor med lovpligtigt/anbefalet/intern
- Default-regler seedet

### Audit log (`/amo/audit-log`)
- Fuld sporbarhed via database triggers
- Filtrérbar log

### Eksport
- PDF og CSV eksport af compliance-oversigt
- Print-venlig opsummering til tilsyn
- Tidslinje-visning af alle AMO-events

---

## Tekniske detaljer

- **Branding**: Bruger eksisterende dark theme + grøn accent (allerede i CSS custom properties)
- **Roller**: Mapper til eksisterende `system_roles` + permission-systemet — ingen nye auth-mekanismer
- **Audit**: Database trigger på alle `amo_*` tabeller der skriver til `amo_audit_log`
- **Påmindelser**: Edge function med cron job der checker deadlines dagligt
- **Filer**: Supabase Storage bucket med RLS

---

## Anbefalet fremgangsmåde

Start med **Fase 1** for at etablere databasen, navigationen og dashboard-siden. Det giver et funktionelt fundament der kan vises og testes, hvorefter vi bygger videre modul for modul.

Skal jeg starte med Fase 1?

