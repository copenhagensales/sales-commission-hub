/**
 * CENTRAL SOURCE OF TRUTH FOR ALL PERMISSION KEYS
 * 
 * This file defines ALL valid permission keys in the application.
 * All other files (useUnifiedPermissions, PermissionEditorV2, sidebars, routes)
 * MUST use keys from this file to ensure consistency.
 * 
 * TypeScript will enforce that only valid keys are used throughout the codebase.
 * 
 * IMPORTANT: When adding new permissions:
 * 1. Add the key here with label, section, and parent
 * 2. The UI will automatically show it in the correct category
 * 3. Auto-seeding will create database entries when a role is selected
 */

import { 
  Home, Users, Crown, Calendar, Briefcase, BarChart3, 
  GraduationCap, FileBarChart, Wrench, Video, ShoppingCart, Phone, FileText, Wallet
} from "lucide-react";

// ============================================================================
// PERMISSION KEY DEFINITIONS
// ============================================================================

export const PERMISSION_KEYS = {
  // ==================== MENU SEKTIONER (Parent permissions - top level) ====================
  menu_section_personal: { label: 'Mit Hjem', section: 'sections', parent: null },
  menu_section_some: { label: 'SOME sektion', section: 'sections', parent: null },
  menu_section_personale: { label: 'Personale', section: 'sections', parent: null },
  menu_section_ledelse: { label: 'Ledelse', section: 'sections', parent: null },
  menu_section_test: { label: 'Test', section: 'sections', parent: null },
  menu_section_mg: { label: 'MG', section: 'sections', parent: null },
  menu_section_vagtplan: { label: 'Vagtplan', section: 'sections', parent: null },
  menu_section_fieldmarketing: { label: 'Fieldmarketing', section: 'sections', parent: null },
  menu_section_rekruttering: { label: 'Rekruttering', section: 'sections', parent: null },
  menu_section_boards: { label: 'Boards', section: 'sections', parent: null },
  menu_section_salary: { label: 'Løn', section: 'sections', parent: null },
  menu_section_dashboards: { label: 'Dashboards', section: 'sections', parent: null },
  menu_section_onboarding: { label: 'Onboarding', section: 'sections', parent: null },
  menu_section_reports: { label: 'Rapporter', section: 'sections', parent: null },
  menu_section_admin: { label: 'Admin', section: 'sections', parent: null },
  menu_section_sales_system: { label: 'Salg & System', section: 'sections', parent: null },
  menu_section_spil: { label: 'Spil', section: 'sections', parent: null },
  menu_section_economic: { label: 'Økonomi', section: 'sections', parent: null },
  menu_section_amo: { label: 'Arbejdsmiljø (AMO)', section: 'sections', parent: null },

  // ==================== AMO (under menu_section_amo) ====================
  menu_amo_dashboard: { label: 'AMO Dashboard', section: 'amo', parent: 'menu_section_amo' },
  menu_amo_organisation: { label: 'AMO Organisation', section: 'amo', parent: 'menu_section_amo' },
  menu_amo_annual_discussion: { label: 'Årlig drøftelse', section: 'amo', parent: 'menu_section_amo' },
  menu_amo_meetings: { label: 'Møder og referater', section: 'amo', parent: 'menu_section_amo' },
  menu_amo_apv: { label: 'APV', section: 'amo', parent: 'menu_section_amo' },
  menu_amo_kemi_apv: { label: 'Kemi-APV', section: 'amo', parent: 'menu_section_amo' },
  menu_amo_training: { label: 'Uddannelse', section: 'amo', parent: 'menu_section_amo' },
  menu_amo_documents: { label: 'Dokumentcenter', section: 'amo', parent: 'menu_section_amo' },
  menu_amo_tasks: { label: 'Opgaver', section: 'amo', parent: 'menu_section_amo' },
  menu_amo_settings: { label: 'AMO Indstillinger', section: 'amo', parent: 'menu_section_amo' },
  menu_amo_audit_log: { label: 'AMO Audit Log', section: 'amo', parent: 'menu_section_amo' },

  // ==================== ØKONOMI (under menu_section_economic) ====================
  menu_economic_dashboard: { label: 'Økonomi Dashboard', section: 'economic', parent: 'menu_section_economic' },
  menu_economic_expenses: { label: 'Udgifter', section: 'economic', parent: 'menu_section_economic' },
  menu_economic_budget: { label: 'Budget 2026', section: 'economic', parent: 'menu_section_economic' },
  menu_economic_mapping: { label: 'Økonomi Mapping', section: 'economic', parent: 'menu_section_economic' },
  menu_economic_upload: { label: 'E-conomic Import', section: 'economic', parent: 'menu_section_economic' },
  

  // ==================== MIT HJEM (under menu_section_personal) ====================
  menu_home: { label: 'Hjem', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_home_goals: { label: 'Hjem mål', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_h2h: { label: 'Head-to-Head', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_commission_league: { label: 'Superligaen', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_league_admin: { label: 'Liga Administration', section: 'mit_hjem', parent: 'menu_commission_league' },
  menu_h2h_admin: { label: 'H2H Admin', section: 'mit_hjem', parent: 'menu_commission_league' },
  menu_team_h2h: { label: 'Team H2H', section: 'mit_hjem', parent: 'menu_commission_league' },
  menu_messages_personal: { label: 'Beskeder', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_my_schedule: { label: 'Min vagtplan', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_my_profile: { label: 'Min profil', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_my_goals: { label: 'Mine mål', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_team_goals: { label: 'Teammål', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_my_contracts: { label: 'Mine kontrakter', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_career_wishes: { label: 'Karriereønsker', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_my_feedback: { label: 'Min feedback', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_refer_a_friend: { label: 'Henvis en ven', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_immediate_payment_ase: { label: 'Straksbetaling (ASE)', section: 'mit_hjem', parent: 'menu_section_personal' },

  // ==================== SOME (under menu_section_some) ====================
  menu_some: { label: 'SOME', section: 'some', parent: 'menu_section_some' },
  menu_extra_work: { label: 'Ekstraarbejde', section: 'some', parent: 'menu_section_some' },
  menu_extra_work_admin: { label: 'Ekstra arbejde admin', section: 'some', parent: 'menu_section_some' },

  // SOME Tabs
  tab_some_overview: { label: 'Fane: SOME Oversigt', section: 'some', parent: 'menu_some' },
  tab_some_content: { label: 'Fane: SOME Indhold', section: 'some', parent: 'menu_some' },
  tab_some_goals: { label: 'Fane: SOME Mål', section: 'some', parent: 'menu_some' },
  tab_extra_work_my: { label: 'Fane: Mit ekstra arbejde', section: 'some', parent: 'menu_extra_work' },
  tab_extra_work_history: { label: 'Fane: Historik', section: 'some', parent: 'menu_extra_work' },

  // ==================== PERSONALE (under menu_section_personale) ====================
  menu_dashboard: { label: 'Dashboard', section: 'personale', parent: 'menu_section_personale' },
  menu_employees: { label: 'Medarbejdere', section: 'personale', parent: 'menu_section_personale' },
  menu_teams: { label: 'Teams', section: 'personale', parent: 'menu_section_personale' },
  menu_permissions: { label: 'Rettigheder', section: 'personale', parent: 'menu_section_personale' },
  menu_login_log: { label: 'Login log', section: 'personale', parent: 'menu_section_personale' },
  menu_upcoming_starts: { label: 'Kommende opstart', section: 'personale', parent: 'menu_section_personale' },

  // Employees Tabs
  tab_employees_all: { label: 'Fane: Alle medarbejdere', section: 'personale', parent: 'menu_employees' },
  tab_employees_staff: { label: 'Fane: Backoffice', section: 'personale', parent: 'menu_employees' },
  tab_employees_teams: { label: 'Fane: Teams', section: 'personale', parent: 'menu_employees' },
  tab_employees_positions: { label: 'Fane: Stillinger', section: 'personale', parent: 'menu_employees' },
  tab_employees_permissions: { label: 'Fane: Rettigheder', section: 'personale', parent: 'menu_employees' },
  tab_employees_dialer_mapping: { label: 'Fane: Dialer-mapping', section: 'personale', parent: 'menu_employees' },
  action_employee_deactivate: { label: 'Deaktiver medarbejder', section: 'personale', parent: 'menu_employees' },

  // ==================== LEDELSE (under menu_section_ledelse) ====================
  menu_company_overview: { label: 'Firmaoversigt', section: 'ledelse', parent: 'menu_section_ledelse' },
  menu_contracts: { label: 'Kontrakter', section: 'ledelse', parent: 'menu_section_ledelse' },
  menu_career_wishes_overview: { label: 'Karriereønsker overblik', section: 'ledelse', parent: 'menu_section_ledelse' },
  menu_email_templates_ledelse: { label: 'E-mail skabeloner (Ledelse)', section: 'ledelse', parent: 'menu_section_ledelse' },
  menu_security_dashboard: { label: 'Sikkerhedsoversigt', section: 'ledelse', parent: 'menu_section_ledelse' },
  menu_customer_inquiries: { label: 'Kundehenvendelser', section: 'ledelse', parent: 'menu_section_ledelse' },
  menu_client_forecast: { label: 'Kundeforecast', section: 'ledelse', parent: 'menu_section_ledelse' },

  // Contracts Tabs
  tab_contracts_all: { label: 'Fane: Alle kontrakter', section: 'ledelse', parent: 'menu_contracts' },
  tab_contracts_templates: { label: 'Fane: Skabeloner', section: 'ledelse', parent: 'menu_contracts' },

  // ==================== VAGTPLAN (under menu_section_vagtplan) ====================
  menu_shift_overview: { label: 'Vagtplan (leder)', section: 'vagtplan', parent: 'menu_section_vagtplan' },
  menu_absence: { label: 'Fravær', section: 'vagtplan', parent: 'menu_section_vagtplan' },
  menu_time_tracking: { label: 'Tidsregistrering', section: 'vagtplan', parent: 'menu_section_vagtplan' },
  menu_time_stamp: { label: 'Stempelur', section: 'vagtplan', parent: 'menu_section_vagtplan' },
  menu_closing_shifts: { label: 'Påmindelser', section: 'vagtplan', parent: 'menu_section_vagtplan' },

  // ==================== MG (under menu_section_mg) ====================
  menu_team_overview: { label: 'Team overblik', section: 'mg', parent: 'menu_section_mg' },
  menu_tdc_erhverv: { label: 'TDC Erhverv', section: 'mg', parent: 'menu_section_mg' },
  menu_tdc_erhverv_dashboard: { label: 'TDC Erhverv Dashboard', section: 'mg', parent: 'menu_section_mg' },
  menu_tdc_opsummering: { label: 'TDC Opsummering', section: 'mit_hjem', parent: 'menu_section_personal' },
  menu_relatel_dashboard: { label: 'Relatel Dashboard', section: 'mg', parent: 'menu_section_mg' },
  menu_codan: { label: 'Codan', section: 'mg', parent: 'menu_section_mg' },
  menu_mg_test: { label: 'MG Test', section: 'mg', parent: 'menu_section_mg' },
  menu_test_dashboard: { label: 'MG Test Dashboard', section: 'mg', parent: 'menu_section_mg' },
  menu_dialer_data: { label: 'Dialer data', section: 'mg', parent: 'menu_section_mg' },
  menu_calls_data: { label: 'Opkaldsdata', section: 'mg', parent: 'menu_section_mg' },
  menu_adversus_data: { label: 'Adversus data', section: 'mg', parent: 'menu_section_mg' },
  menu_payroll: { label: 'Lønkørsel', section: 'mg', parent: 'menu_section_mg' },
  menu_tryg_dashboard: { label: 'Tryg Dagsoverblik', section: 'mg', parent: 'menu_section_mg' },
  menu_ase_dashboard: { label: 'ASE Dagsoverblik', section: 'mg', parent: 'menu_section_mg' },
  menu_km_test: { label: 'KM test', section: 'mg', parent: 'menu_section_mg' },

  // MG Tabs
  tab_mg_salary_schemes: { label: 'Fane: Lønordninger', section: 'mg', parent: 'menu_mg_test' },
  tab_mg_relatel_status: { label: 'Fane: Relatel Status', section: 'mg', parent: 'menu_mg_test' },
  tab_mg_relatel_events: { label: 'Fane: Relatel Events', section: 'mg', parent: 'menu_mg_test' },
  tab_mg_products: { label: 'Fane: Produkter', section: 'mg', parent: 'menu_mg_test' },
  tab_mg_campaigns: { label: 'Fane: Kampagner', section: 'mg', parent: 'menu_mg_test' },
  tab_mg_customers: { label: 'Fane: Kunder', section: 'mg', parent: 'menu_mg_test' },
  tab_payroll_overview: { label: 'Fane: Lønoversigt', section: 'mg', parent: 'menu_payroll' },
  tab_payroll_history: { label: 'Fane: Lønhistorik', section: 'mg', parent: 'menu_payroll' },

  // ==================== TEST (under menu_section_test) ====================
  menu_car_quiz_admin: { label: 'Bilquiz admin', section: 'test', parent: 'menu_section_test' },
  menu_coc_admin: { label: 'COC admin', section: 'test', parent: 'menu_section_test' },
  menu_pulse_survey: { label: 'Pulsmåling', section: 'test', parent: 'menu_section_test' },

  // Test Tabs
  tab_car_quiz_questions: { label: 'Fane: Quiz spørgsmål', section: 'test', parent: 'menu_car_quiz_admin' },
  tab_car_quiz_submissions: { label: 'Fane: Besvarelser', section: 'test', parent: 'menu_car_quiz_admin' },
  tab_coc_questions: { label: 'Fane: CoC spørgsmål', section: 'test', parent: 'menu_coc_admin' },
  tab_coc_submissions: { label: 'Fane: CoC besvarelser', section: 'test', parent: 'menu_coc_admin' },
  tab_pulse_results: { label: 'Fane: Pulsmåling resultater', section: 'test', parent: 'menu_pulse_survey' },
  tab_pulse_template: { label: 'Fane: Pulsmåling skabelon', section: 'test', parent: 'menu_pulse_survey' },
  tab_pulse_teams: { label: 'Fane: Team sammenligning', section: 'test', parent: 'menu_pulse_survey' },

  // ==================== REKRUTTERING (under menu_section_rekruttering) ====================
  menu_recruitment_dashboard: { label: 'Rekruttering Dashboard', section: 'rekruttering', parent: 'menu_section_rekruttering' },
  menu_candidates: { label: 'Kandidater', section: 'rekruttering', parent: 'menu_section_rekruttering' },
  menu_upcoming_interviews: { label: 'Kommende samtaler', section: 'rekruttering', parent: 'menu_section_rekruttering' },
  menu_winback: { label: 'Winback', section: 'rekruttering', parent: 'menu_section_rekruttering' },
  menu_upcoming_hires: { label: 'Kommende ansættelser', section: 'rekruttering', parent: 'menu_section_rekruttering' },
  menu_messages: { label: 'Beskeder (rekruttering)', section: 'rekruttering', parent: 'menu_section_rekruttering' },
  menu_sms_templates: { label: 'SMS skabeloner', section: 'rekruttering', parent: 'menu_section_rekruttering' },
  menu_email_templates: { label: 'E-mail skabeloner', section: 'rekruttering', parent: 'menu_section_rekruttering' },
  menu_referrals: { label: 'Henvisninger', section: 'rekruttering', parent: 'menu_section_rekruttering' },

  // Rekruttering Tabs
  tab_recruitment_pipeline: { label: 'Fane: Pipeline', section: 'rekruttering', parent: 'menu_candidates' },
  tab_recruitment_all: { label: 'Fane: Alle kandidater', section: 'rekruttering', parent: 'menu_candidates' },
  tab_winback_ghostet: { label: 'Fane: Ghostet', section: 'rekruttering', parent: 'menu_winback' },
  tab_winback_takket_nej: { label: 'Fane: Takket nej', section: 'rekruttering', parent: 'menu_winback' },
  tab_winback_kundeservice: { label: 'Fane: Kundeservice', section: 'rekruttering', parent: 'menu_winback' },
  tab_messages_all: { label: 'Fane: Alle beskeder', section: 'rekruttering', parent: 'menu_messages' },
  tab_messages_sms: { label: 'Fane: SMS', section: 'rekruttering', parent: 'menu_messages' },
  tab_messages_email: { label: 'Fane: Email', section: 'rekruttering', parent: 'menu_messages' },
  tab_messages_call: { label: 'Fane: Opkald', section: 'rekruttering', parent: 'menu_messages' },
  tab_messages_sent: { label: 'Fane: Sendt', section: 'rekruttering', parent: 'menu_messages' },

  // ==================== LØN (under menu_section_salary) ====================
  menu_salary_types: { label: 'Løntyper', section: 'salary', parent: 'menu_section_salary' },

  // ==================== DASHBOARDS (under menu_section_dashboards) ====================
  // NOTE: Individual dashboard permissions are managed via team_dashboard_permissions table
  // in the dashboard environment. Only the general environment access is controlled here.
  menu_dashboards: { label: 'Dashboards (generelt)', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_admin: { label: 'Dashboard Administration', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_powerdag_input: { label: 'Powerdag Indtastning', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_tv_board_admin: { label: 'TV Board Administration', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_settings: { label: 'Dashboard Indstillinger', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_cph_sales: { label: 'Dagsboard CPH Sales', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_fieldmarketing: { label: 'Fieldmarketing', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_eesy_tm: { label: 'Eesy TM', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_tdc_erhverv: { label: 'TDC Erhverv', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_relatel: { label: 'Relatel', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_united: { label: 'United', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_test: { label: 'Test Dashboard', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_cs_top_20: { label: 'CS Top 20', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_sales_overview_all: { label: 'Salgsoversigt alle', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_commission_league: { label: 'Superliga Live', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_powerdag: { label: 'Powerdag', section: 'dashboards', parent: 'menu_section_dashboards' },
  menu_dashboard_mg_test: { label: 'MG Test', section: 'dashboards', parent: 'menu_section_dashboards' },

  // ==================== REPORTS (under menu_section_reports) ====================
  menu_reports_admin: { label: 'Admin rapporter', section: 'reports', parent: 'menu_section_reports' },
  menu_reports_daily: { label: 'Daglige rapporter', section: 'reports', parent: 'menu_section_reports' },
  menu_reports_management: { label: 'Ledelsesrapporter', section: 'reports', parent: 'menu_section_reports' },
  menu_reports_employee: { label: 'Medarbejderrapporter', section: 'reports', parent: 'menu_section_reports' },
  menu_reports_revenue_by_client: { label: 'Omsætning per opgave', section: 'reports', parent: 'menu_section_reports' },
  menu_cancellations: { label: 'Annulleringer', section: 'reports', parent: 'menu_section_reports' },
  tab_cancellations_manual: { label: 'Fane: Rediger kurv', section: 'reports', parent: 'menu_cancellations' },
  tab_cancellations_upload: { label: 'Fane: Upload/match', section: 'reports', parent: 'menu_cancellations' },
  tab_cancellations_duplicates: { label: 'Fane: Dubletter', section: 'reports', parent: 'menu_cancellations' },
  tab_cancellations_approval: { label: 'Fane: Godkendelseskø', section: 'reports', parent: 'menu_cancellations' },
  tab_cancellations_unmatched: { label: 'Fane: Ingen match', section: 'reports', parent: 'menu_cancellations' },

  // ==================== ONBOARDING (under menu_section_onboarding) ====================
  menu_onboarding_overview: { label: 'Onboarding overblik', section: 'onboarding', parent: 'menu_section_onboarding' },
  menu_onboarding_kursus: { label: 'Kursus', section: 'onboarding', parent: 'menu_section_onboarding' },
  menu_onboarding_ramp: { label: 'Ramp-up', section: 'onboarding', parent: 'menu_section_onboarding' },
  menu_onboarding_leader: { label: 'Leder-onboarding', section: 'onboarding', parent: 'menu_section_onboarding' },
  menu_onboarding_drills: { label: 'Drills', section: 'onboarding', parent: 'menu_section_onboarding' },
  menu_onboarding_admin: { label: 'Onboarding admin', section: 'onboarding', parent: 'menu_section_onboarding' },
  menu_onboarding: { label: 'Onboarding', section: 'onboarding', parent: 'menu_section_onboarding' },
  menu_coaching_templates: { label: 'Coaching skabeloner', section: 'onboarding', parent: 'menu_section_onboarding' },

  // Onboarding Tabs
  tab_onboarding_overview: { label: 'Fane: Onboarding oversigt', section: 'onboarding', parent: 'menu_onboarding_overview' },
  tab_onboarding_ramp: { label: 'Fane: Forventninger', section: 'onboarding', parent: 'menu_onboarding_overview' },
  tab_onboarding_leader: { label: 'Fane: Leder', section: 'onboarding', parent: 'menu_onboarding_overview' },
  tab_onboarding_drills: { label: 'Fane: Drill-bibliotek', section: 'onboarding', parent: 'menu_onboarding_overview' },
  tab_onboarding_template: { label: 'Fane: Skabelon', section: 'onboarding', parent: 'menu_onboarding_overview' },
  tab_onboarding_admin: { label: 'Fane: Onboarding admin', section: 'onboarding', parent: 'menu_onboarding_overview' },
  tab_onboarding_days: { label: 'Fane: Dage', section: 'onboarding', parent: 'menu_onboarding_overview' },
  tab_onboarding_expectations: { label: 'Fane: Forventninger', section: 'onboarding', parent: 'menu_onboarding_overview' },
  tab_onboarding_messages: { label: 'Fane: Beskeder', section: 'onboarding', parent: 'menu_onboarding_overview' },

  // ==================== ADMIN (under menu_section_admin) ====================
  menu_kpi_definitions: { label: 'KPI definitioner', section: 'admin', parent: 'menu_section_admin' },

  // ==================== FIELDMARKETING (under menu_section_fieldmarketing) ====================
  menu_fm_my_schedule: { label: 'Min FM vagtplan', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_overview: { label: 'Oversigt', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_booking: { label: 'Booking', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_vehicles: { label: 'Køretøjer', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_sales_registration: { label: 'Salgsregistrering', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_billing: { label: 'Fakturering', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_travel_expenses: { label: 'Rejsekort og diæter', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_edit_sales: { label: 'Ret salg', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_time_off: { label: 'Fraværsanmodninger', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_book_week: { label: 'Book uge', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_bookings: { label: 'Kommende bookinger', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },
  menu_fm_locations: { label: 'Lokationer', section: 'fieldmarketing', parent: 'menu_section_fieldmarketing' },

  // Fieldmarketing Tabs
  tab_fm_eesy: { label: 'Fane: Eesy FM Dashboard', section: 'fieldmarketing', parent: 'menu_fm_overview' },
  tab_fm_yousee: { label: 'Fane: Yousee Dashboard', section: 'fieldmarketing', parent: 'menu_fm_overview' },
  tab_fm_book_week: { label: 'Fane: Book uge', section: 'fieldmarketing', parent: 'menu_fm_booking' },
  tab_fm_bookings: { label: 'Fane: Kommende bookinger', section: 'fieldmarketing', parent: 'menu_fm_booking' },
  tab_fm_markets: { label: 'Fane: Kommende markeder', section: 'fieldmarketing', parent: 'menu_fm_booking' },
  tab_fm_locations: { label: 'Fane: Lokationer', section: 'fieldmarketing', parent: 'menu_fm_booking' },
  tab_fm_vagtplan: { label: 'Fane: Vagtplan FM', section: 'fieldmarketing', parent: 'menu_fm_booking' },
  tab_fm_hotels: { label: 'Fane: Hoteller', section: 'fieldmarketing', parent: 'menu_fm_booking' },
  tab_fm_training: { label: 'Fane: Oplæring', section: 'fieldmarketing', parent: 'menu_fm_booking' },

  // ==================== SALG & SYSTEM (under menu_section_sales_system) ====================
  menu_sales: { label: 'Salg', section: 'sales_system', parent: 'menu_section_sales_system' },
  menu_logics: { label: 'Logikker', section: 'sales_system', parent: 'menu_section_sales_system' },
  menu_live_stats: { label: 'Live Stats', section: 'sales_system', parent: 'menu_section_sales_system' },
  menu_settings: { label: 'Indstillinger', section: 'sales_system', parent: 'menu_section_sales_system' },
  menu_boards_sales: { label: 'Sales Dashboard', section: 'sales_system', parent: 'menu_section_sales_system' },

  // Settings Tabs
  tab_settings_api: { label: 'Fane: API Integrationer', section: 'sales_system', parent: 'menu_settings' },
  tab_settings_dialer: { label: 'Fane: Dialer Integrationer', section: 'sales_system', parent: 'menu_settings' },
  tab_settings_customer: { label: 'Fane: Kunde Integrationer', section: 'sales_system', parent: 'menu_settings' },
  tab_settings_webhooks: { label: 'Fane: Webhooks', section: 'sales_system', parent: 'menu_settings' },
  tab_settings_logs: { label: 'Fane: Logs', section: 'sales_system', parent: 'menu_settings' },
  tab_settings_excel_crm: { label: 'Fane: Excel CRM Import', section: 'sales_system', parent: 'menu_settings' },

  // ==================== SOFTPHONE & KOMMUNIKATION ====================
  softphone_outbound: { label: 'Softphone: Udgående opkald', section: 'softphone', parent: null },
  softphone_inbound: { label: 'Softphone: Indgående opkald', section: 'softphone', parent: null },
  employee_sms: { label: 'SMS til medarbejdere', section: 'softphone', parent: null },

  // ==================== LEGACY/ALIAS KEYS ====================
  // These are kept for backwards compatibility but should not be used for new features
  menu_leaderboard: { label: 'Leaderboard', section: 'legacy', parent: null },
  menu_my_sales: { label: 'Mine salg', section: 'legacy', parent: 'menu_section_personal' },
  menu_my_shifts: { label: 'Mine vagter', section: 'legacy', parent: 'menu_section_personal' },
  menu_my_absence: { label: 'Mit fravær', section: 'legacy', parent: 'menu_section_personal' },
  menu_my_coaching: { label: 'Min coaching', section: 'legacy', parent: 'menu_section_personal' },
  menu_refer_friend: { label: 'Henvis en ven (alias)', section: 'legacy', parent: 'menu_section_personal' },
  menu_messages_recruitment: { label: 'Beskeder (rekruttering, alias)', section: 'legacy', parent: 'menu_section_rekruttering' },
  menu_email_templates_recruitment: { label: 'E-mail skabeloner (rekruttering)', section: 'legacy', parent: 'menu_section_rekruttering' },
  menu_liga_test_board: { label: 'Liga Test Board', section: 'legacy', parent: 'menu_commission_league' },
  menu_mg_test_dashboard: { label: 'MG Test Dashboard (alias)', section: 'legacy', parent: 'menu_section_mg' },
  menu_dashboard_mg_test: { label: 'MG Test Dashboard (alias)', section: 'legacy', parent: 'menu_section_dashboards' },
} as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

/**
 * Type for all valid permission keys.
 * Using this type ensures TypeScript catches invalid keys at compile time.
 */
export type PermissionKey = keyof typeof PERMISSION_KEYS;

/**
 * Helper to validate if a string is a valid permission key.
 */
export function isValidPermissionKey(key: string): key is PermissionKey {
  return key in PERMISSION_KEYS;
}

/**
 * Get the label for a permission key.
 * Returns the key itself if not found.
 */
export function getPermissionLabel(key: string): string {
  if (isValidPermissionKey(key)) {
    return PERMISSION_KEYS[key].label;
  }
  return key;
}

/**
 * Get all permission keys as an array.
 */
export function getAllPermissionKeys(): PermissionKey[] {
  return Object.keys(PERMISSION_KEYS) as PermissionKey[];
}

/**
 * Generate a Record<string, string> of permission key → label for UI usage.
 * This replaces the old permissionKeyLabels in useUnifiedPermissions.
 */
export function generatePermissionKeyLabels(): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const [key, value] of Object.entries(PERMISSION_KEYS)) {
    labels[key] = value.label;
  }
  return labels;
}

// Pre-generated labels for direct import
export const permissionKeyLabels = generatePermissionKeyLabels();

// ============================================================================
// HIERARCHY AND CATEGORY GENERATION
// ============================================================================

/**
 * Generate the permission hierarchy from PERMISSION_KEYS.
 * Maps each permission key to its parent key (null = top-level).
 */
export function generatePermissionHierarchy(): Record<string, string | null> {
  const hierarchy: Record<string, string | null> = {};
  for (const [key, config] of Object.entries(PERMISSION_KEYS)) {
    hierarchy[key] = config.parent;
  }
  return hierarchy;
}

// Pre-generated hierarchy for direct import
export const PERMISSION_HIERARCHY = generatePermissionHierarchy();

/**
 * Section icons for UI rendering
 */
export const SECTION_ICONS: Record<string, typeof Home> = {
  menu_section_personal: Home,
  menu_section_personale: Users,
  menu_section_ledelse: Crown,
  menu_section_vagtplan: Calendar,
  menu_section_fieldmarketing: Briefcase,
  menu_section_mg: BarChart3,
  menu_section_rekruttering: Users,
  menu_section_dashboards: BarChart3,
  menu_section_onboarding: GraduationCap,
  menu_section_reports: FileBarChart,
  menu_section_some: Video,
  menu_section_sales_system: ShoppingCart,
  menu_section_salary: Briefcase,
  menu_section_admin: Wrench,
  menu_section_test: Wrench,
  menu_section_economic: Wallet,
  softphone_section: Phone,
  messages_section: FileText,
};

/**
 * Generate permission categories from PERMISSION_KEYS.
 * Groups permissions by their top-level parent section.
 */
export function generatePermissionCategories(): Record<string, { label: string; keys: string[] }> {
  const categories: Record<string, { label: string; keys: string[] }> = {};
  
  // Find all section parents (keys starting with menu_section_ that have no parent)
  for (const [key, config] of Object.entries(PERMISSION_KEYS)) {
    if (config.parent === null && key.startsWith('menu_section_')) {
      categories[key] = { label: config.label, keys: [] };
    }
  }
  
  // Add special sections for non-menu items
  categories['softphone_section'] = { label: 'Softphone & SMS', keys: [] };
  categories['messages_section'] = { label: 'Beskeder', keys: [] };
  
  // Find the root section for each permission
  const findRootSection = (key: string): string | null => {
    const config = PERMISSION_KEYS[key as PermissionKey];
    if (!config) return null;
    
    // If this is a section itself, return it
    if (config.parent === null && key.startsWith('menu_section_')) {
      return key;
    }
    
    // Handle softphone and employee_sms special cases
    if (key.startsWith('softphone_') || key === 'employee_sms') {
      return 'softphone_section';
    }
    
    // Handle message tabs (they belong to various sections but we group them)
    if (key.startsWith('tab_messages_')) {
      return 'messages_section';
    }
    
    // Traverse up the hierarchy to find the root section
    let currentKey = key;
    let depth = 0;
    const maxDepth = 10; // Prevent infinite loops
    
    while (currentKey && depth < maxDepth) {
      const currentConfig = PERMISSION_KEYS[currentKey as PermissionKey];
      if (!currentConfig) break;
      
      if (currentConfig.parent === null && currentKey.startsWith('menu_section_')) {
        return currentKey;
      }
      
      if (currentConfig.parent === null) {
        // This is a top-level item without a section
        return null;
      }
      
      currentKey = currentConfig.parent;
      depth++;
    }
    
    return null;
  };
  
  // Assign each permission to its root section
  for (const key of Object.keys(PERMISSION_KEYS)) {
    // Skip the section keys themselves
    if (key.startsWith('menu_section_')) continue;
    
    const rootSection = findRootSection(key);
    if (rootSection && categories[rootSection]) {
      categories[rootSection].keys.push(key);
    }
  }
  
  return categories;
}

// Pre-generated categories for direct import
export const PERMISSION_CATEGORIES = generatePermissionCategories();

/**
 * Get the permission type from a key.
 */
export type PermissionType = 'page' | 'tab' | 'action';

export function getPermissionTypeFromKey(key: string): PermissionType {
  if (key.startsWith('tab_')) return 'tab';
  if (key.startsWith('action_')) return 'action';
  return 'page';
}

/**
 * Get all children of a permission key.
 */
export function getPermissionChildren(parentKey: string): string[] {
  return Object.entries(PERMISSION_KEYS)
    .filter(([_, config]) => config.parent === parentKey)
    .map(([key]) => key);
}

/**
 * Check if a permission has any children.
 */
export function hasPermissionChildren(key: string): boolean {
  return Object.values(PERMISSION_KEYS).some(config => config.parent === key);
}
