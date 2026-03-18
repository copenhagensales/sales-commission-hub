# Lovable Plan

## AMO Compliance Hub — Fase 1 ✅

### Implementeret
1. ✅ Database: 12 tabeller oprettet (`amo_workplaces`, `amo_members`, `amo_amr_elections`, `amo_annual_discussions`, `amo_meetings`, `amo_apv`, `amo_kemi_apv`, `amo_training_courses`, `amo_documents`, `amo_tasks`, `amo_compliance_rules`, `amo_audit_log`).
2. ✅ 8 enums: `amo_role_type`, `amo_meeting_type`, `amo_meeting_status`, `amo_apv_reason`, `amo_training_type`, `amo_task_priority`, `amo_task_status`, `amo_rule_type`.
3. ✅ RLS: Alle authenticated kan læse; teamleder/ejer kan skrive.
4. ✅ Storage bucket: `amo-documents` (privat) med RLS.
5. ✅ Permissions: 12 nye permission keys i `permissionKeys.ts` under `menu_section_amo`.
6. ✅ Hooks: `usePositionPermissions` udvidet med 11 AMO-permissions.
7. ✅ Sidebar: AMO-sektion med Shield-ikon og 11 undermenu-items i `AppSidebar.tsx`.
8. ✅ Routes: 11 routes under `/amo/*` i `config.tsx`.
9. ✅ Dashboard: `AmoDashboard.tsx` med dynamisk compliance score, 8 statuskort (rød/gul/grøn), åbne opgaver, seneste uploads, AMO-medlemmer.
10. ✅ Placeholder: `AmoPlaceholder.tsx` for endnu ikke implementerede moduler.
11. ✅ Seed data: 3 medlemmer, 3 møder, 1 årlig drøftelse, 1 APV, 1 Kemi-APV, 2 uddannelseskrav, 7 compliance-regler, 1 datakvalitetsopgave.
12. ✅ Data quality warning: "William Seiding" vs "William Hoe" vises i dashboard og som åben opgave.

## AMO Compliance Hub — Fase 2 ✅

### Implementeret
1. ✅ **AMO Organisation** (`/amo/organisation`): CRUD for arbejdspladser og medlemmer, AMR-valg oversigt, compliance-beregning baseret på medarbejderantal (< 10, 10-34, 35+), tabs-baseret UI.
2. ✅ **Møder og referater** (`/amo/meetings`): CRUD for AMO-møder, agenda-skabelon generator, mødestatus (planlagt/gennemført/overskredet/aflyst), detaljevisning, statistik-kort.
3. ✅ **Årlig drøftelse** (`/amo/annual-discussion`): CRUD med alle påkrævede felter, auto-beregning af næste frist (12 mdr), påmindelsesbannere (60/30/7 dage), referat-status.
4. ✅ **APV** (`/amo/apv`): CRUD med handlingsplan, 3-års cyklus tracking, risikoniveau, detaljevisning, overdue-advarsler, statistik-kort.

## AMO Compliance Hub — Fase 3 ✅

### Implementeret
1. ✅ **Kemi-APV** (`/amo/kemi-apv`): Produktliste med CRUD, hazard flag, SDS-link, review-deadlines, statistik-kort, manglende-SDS-advarsler.
2. ✅ **Uddannelse og certifikater** (`/amo/training`): Kursuskrav CRUD, 4 kursustyper, auto deadline-beregning (3 mdr), certifikat-sporing, overdue-advarsler.
3. ✅ **Dokumentcenter** (`/amo/documents`): Upload til storage bucket, metadata og kategorisering, søgning og filtrering, version-tracking, DOKO-reference, udløbsadvarsler.

## AMO Compliance Hub — Fase 4 ✅

### Implementeret
1. ✅ **Opgavemotor** (`/amo/tasks`): Fuld CRUD, prioritet/status-styring, modul-filtrering, overdue-auto-detection, CSV-eksport.
2. ✅ **Audit Log** (`/amo/audit-log`): Log-viewer med søgning, tabel/handling-filtre, detaljevisning med gamle/nye værdier, CSV-eksport.
3. ✅ **Eksport**: CSV-eksport integreret i både Opgavemotor og Audit Log.

### Næste faser
- **Fase 5**: Indstillinger, Notifikationer, Dashboard-udvidelser
