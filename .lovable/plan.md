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

### Næste faser
- **Fase 2**: AMO Organisation CRUD, Møder & referater, Årlig drøftelse, APV modul
- **Fase 3**: Kemi-APV, Uddannelse & certifikater, Dokumentcenter
- **Fase 4**: Opgavemotor, Notifikationer, Eksport (PDF/CSV), Audit log triggers
