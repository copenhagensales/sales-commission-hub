-- =====================================================
-- KOMPLET SYNKRONISERING AF PERMISSION-STRUKTUR
-- Tilføjer alle manglende sektioner og sidebar-menuer
-- =====================================================

-- 1. SEKTIONER (page-niveau) - Tilføj manglende
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description)
SELECT role_key, key, 'page', 
  CASE WHEN role_key = 'ejer' THEN true 
       WHEN role_key = 'teamleder' AND key IN ('menu_section_dashboards', 'menu_section_onboarding', 'menu_section_reports') THEN true
       WHEN role_key = 'rekruttering' AND key = 'menu_section_rekruttering' THEN true
       WHEN role_key = 'some' AND key = 'menu_section_some' THEN true
       WHEN role_key = 'medarbejder' AND key = 'menu_section_dashboards' THEN true
       ELSE false 
  END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text
FROM (
  SELECT 'menu_section_dashboards' as key, 'Dashboards sektion' as desc_text
  UNION ALL SELECT 'menu_section_onboarding', 'Onboarding sektion'
  UNION ALL SELECT 'menu_section_reports', 'Rapporter sektion'
  UNION ALL SELECT 'menu_section_admin', 'Admin sektion'
  UNION ALL SELECT 'menu_section_some', 'SOME sektion'
) sections
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = sections.key
);

-- 2. MIT HJEM sidebar-menuer (under menu_section_personal)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'teamleder', 'medarbejder', 'rekruttering', 'some') THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_personal'
FROM (
  SELECT 'menu_home' as key, 'Hjem' as desc_text
  UNION ALL SELECT 'menu_h2h', 'Head-to-Head'
  UNION ALL SELECT 'menu_commission_league', 'Provisionsliga'
  UNION ALL SELECT 'menu_messages', 'Beskeder'
  UNION ALL SELECT 'menu_my_schedule', 'Min vagtplan'
  UNION ALL SELECT 'menu_my_profile', 'Min profil'
  UNION ALL SELECT 'menu_my_goals', 'Mine mål'
  UNION ALL SELECT 'menu_my_contracts', 'Mine kontrakter'
  UNION ALL SELECT 'menu_career_wishes', 'Karriereønsker'
  UNION ALL SELECT 'menu_my_feedback', 'Min feedback'
  UNION ALL SELECT 'menu_refer_friend', 'Henvis en ven'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 3. PERSONALE ekstra menuer (under menu_section_personale)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'teamleder') THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_personale'
FROM (
  SELECT 'menu_login_log' as key, 'Login log' as desc_text
  UNION ALL SELECT 'menu_upcoming_starts', 'Kommende opstart'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 4. LEDELSE sidebar-menuer (under menu_section_ledelse)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'teamleder') THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_ledelse'
FROM (
  SELECT 'menu_company_overview' as key, 'Firmaoversigt' as desc_text
  UNION ALL SELECT 'menu_contracts', 'Kontrakter'
  UNION ALL SELECT 'menu_career_wishes_overview', 'Karriereønsker overblik'
  UNION ALL SELECT 'menu_email_templates_ledelse', 'E-mail skabeloner'
  UNION ALL SELECT 'menu_security_dashboard', 'Sikkerhedsoversigt'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 5. VAGTPLAN ekstra menuer (under menu_section_vagtplan)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'teamleder') THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_vagtplan'
FROM (
  SELECT 'menu_time_tracking' as key, 'Tidsregistrering' as desc_text
  UNION ALL SELECT 'menu_time_stamp', 'Tidsstempling'
  UNION ALL SELECT 'menu_closing_shifts', 'Lukkevagter'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 6. MG sidebar-menuer (under menu_section_mg)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'teamleder') THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_mg'
FROM (
  SELECT 'menu_team_overview' as key, 'Team overblik' as desc_text
  UNION ALL SELECT 'menu_tdc_erhverv', 'TDC Erhverv'
  UNION ALL SELECT 'menu_tdc_erhverv_dashboard', 'TDC Erhverv Dashboard'
  UNION ALL SELECT 'menu_relatel_dashboard', 'Relatel Dashboard'
  UNION ALL SELECT 'menu_tryg_dashboard', 'Tryg Dashboard'
  UNION ALL SELECT 'menu_ase_dashboard', 'ASE Dashboard'
  UNION ALL SELECT 'menu_codan', 'Codan'
  UNION ALL SELECT 'menu_mg_test', 'MG Test'
  UNION ALL SELECT 'menu_mg_test_dashboard', 'MG Test Dashboard'
  UNION ALL SELECT 'menu_dialer_data', 'Dialer data'
  UNION ALL SELECT 'menu_calls_data', 'Opkaldsdata'
  UNION ALL SELECT 'menu_adversus_data', 'Adversus data'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 7. TEST sidebar-menuer (under menu_section_test)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'teamleder') THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_test'
FROM (
  SELECT 'menu_car_quiz_admin' as key, 'Bilquiz admin' as desc_text
  UNION ALL SELECT 'menu_coc_admin', 'COC admin'
  UNION ALL SELECT 'menu_pulse_survey', 'Pulsmåling'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 8. REKRUTTERING sidebar-menuer (under menu_section_rekruttering)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'rekruttering') THEN true 
       WHEN role_key = 'teamleder' AND key IN ('menu_candidates', 'menu_upcoming_interviews', 'menu_referrals') THEN true
       ELSE false END,
  CASE WHEN role_key IN ('ejer', 'rekruttering') THEN true ELSE false END,
  desc_text, 'menu_section_rekruttering'
FROM (
  SELECT 'menu_candidates' as key, 'Kandidater' as desc_text
  UNION ALL SELECT 'menu_upcoming_interviews', 'Kommende samtaler'
  UNION ALL SELECT 'menu_winback', 'Winback'
  UNION ALL SELECT 'menu_upcoming_hires', 'Kommende ansættelser'
  UNION ALL SELECT 'menu_messages_recruitment', 'Beskeder (rekruttering)'
  UNION ALL SELECT 'menu_sms_templates', 'SMS skabeloner'
  UNION ALL SELECT 'menu_email_templates_recruitment', 'E-mail skabeloner'
  UNION ALL SELECT 'menu_referrals', 'Henvisninger'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 9. LØN ekstra menuer (under menu_section_salary)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_salary'
FROM (
  SELECT 'menu_salary_types' as key, 'Løntyper' as desc_text
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 10. SOME sidebar-menuer (under menu_section_some)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'some') THEN true ELSE false END,
  CASE WHEN role_key IN ('ejer', 'some') THEN true ELSE false END,
  desc_text, 'menu_section_some'
FROM (
  SELECT 'menu_some' as key, 'SOME' as desc_text
  UNION ALL SELECT 'menu_extra_work', 'Ekstraarbejde'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 11. DASHBOARDS sidebar-menuer (under menu_section_dashboards)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'teamleder') THEN true 
       WHEN role_key = 'medarbejder' AND key IN ('menu_dashboard_cph_sales', 'menu_dashboard_cs_top_20') THEN true
       ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_dashboards'
FROM (
  SELECT 'menu_dashboard_cph_sales' as key, 'CPH Salg' as desc_text
  UNION ALL SELECT 'menu_dashboard_cs_top_20', 'CS Top 20'
  UNION ALL SELECT 'menu_dashboard_fieldmarketing', 'Fieldmarketing'
  UNION ALL SELECT 'menu_dashboard_fm_goals', 'FM Mål'
  UNION ALL SELECT 'menu_dashboard_eesy_tm', 'Eesy TM'
  UNION ALL SELECT 'menu_dashboard_tdc_erhverv', 'TDC Erhverv'
  UNION ALL SELECT 'menu_dashboard_tdc_goals', 'TDC Mål'
  UNION ALL SELECT 'menu_dashboard_relatel', 'Relatel'
  UNION ALL SELECT 'menu_dashboard_tryg', 'Tryg'
  UNION ALL SELECT 'menu_dashboard_ase', 'ASE'
  UNION ALL SELECT 'menu_dashboard_mg_test', 'MG Test'
  UNION ALL SELECT 'menu_dashboard_united', 'United'
  UNION ALL SELECT 'menu_dashboard_design', 'Design'
  UNION ALL SELECT 'menu_dashboard_settings', 'Indstillinger'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 12. REPORTS sidebar-menuer (under menu_section_reports)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'teamleder') THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_reports'
FROM (
  SELECT 'menu_reports_admin' as key, 'Admin rapporter' as desc_text
  UNION ALL SELECT 'menu_reports_daily', 'Daglige rapporter'
  UNION ALL SELECT 'menu_reports_management', 'Ledelsesrapporter'
  UNION ALL SELECT 'menu_reports_employee', 'Medarbejderrapporter'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 13. ONBOARDING sidebar-menuer (under menu_section_onboarding)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key IN ('ejer', 'teamleder') THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_onboarding'
FROM (
  SELECT 'menu_onboarding_overview' as key, 'Onboarding overblik' as desc_text
  UNION ALL SELECT 'menu_onboarding_kursus', 'Kursus'
  UNION ALL SELECT 'menu_onboarding_ramp', 'Ramp-up'
  UNION ALL SELECT 'menu_onboarding_leader', 'Leder-onboarding'
  UNION ALL SELECT 'menu_onboarding_drills', 'Drills'
  UNION ALL SELECT 'menu_onboarding_admin', 'Onboarding admin'
  UNION ALL SELECT 'menu_coaching_templates', 'Coaching skabeloner'
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);

-- 14. ADMIN sidebar-menuer (under menu_section_admin)
INSERT INTO role_page_permissions (role_key, permission_key, permission_type, can_view, can_edit, description, parent_key)
SELECT role_key, key, 'tab',
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  CASE WHEN role_key = 'ejer' THEN true ELSE false END,
  desc_text, 'menu_section_admin'
FROM (
  SELECT 'menu_kpi_definitions' as key, 'KPI definitioner' as desc_text
) items
CROSS JOIN (VALUES ('ejer'), ('teamleder'), ('rekruttering'), ('medarbejder'), ('some')) AS roles(role_key)
WHERE NOT EXISTS (
  SELECT 1 FROM role_page_permissions rpp 
  WHERE rpp.role_key = roles.role_key AND rpp.permission_key = items.key
);