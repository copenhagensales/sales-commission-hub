/**
 * CENTRAL SOURCE OF TRUTH FOR ALL PERMISSION KEYS
 * 
 * This file defines ALL valid permission keys in the application.
 * All other files (useUnifiedPermissions, usePositionPermissions, sidebars, routes)
 * MUST use keys from this file to ensure consistency.
 * 
 * TypeScript will enforce that only valid keys are used throughout the codebase.
 */

// ============================================================================
// PERMISSION KEY DEFINITIONS
// ============================================================================

export const PERMISSION_KEYS = {
  // ==================== MENU SEKTIONER (Parent permissions) ====================
  menu_section_personal: { label: 'Mit Hjem', section: 'sections' },
  menu_section_some: { label: 'SOME sektion', section: 'sections' },
  menu_section_personale: { label: 'Personale', section: 'sections' },
  menu_section_ledelse: { label: 'Ledelse', section: 'sections' },
  menu_section_test: { label: 'Test', section: 'sections' },
  menu_section_mg: { label: 'MG', section: 'sections' },
  menu_section_vagtplan: { label: 'Vagtplan', section: 'sections' },
  menu_section_fieldmarketing: { label: 'Fieldmarketing', section: 'sections' },
  menu_section_rekruttering: { label: 'Rekruttering', section: 'sections' },
  menu_section_boards: { label: 'Boards', section: 'sections' },
  menu_section_salary: { label: 'Løn', section: 'sections' },
  menu_section_dashboards: { label: 'Dashboards', section: 'sections' },
  menu_section_onboarding: { label: 'Onboarding', section: 'sections' },
  menu_section_reports: { label: 'Rapporter', section: 'sections' },
  menu_section_admin: { label: 'Admin', section: 'sections' },
  menu_section_sales_system: { label: 'Salg & System', section: 'sections' },
  menu_section_spil: { label: 'Spil', section: 'sections' },
  menu_section_economic: { label: 'Økonomi', section: 'sections' },

  // ==================== ØKONOMI ====================
  menu_economic_dashboard: { label: 'Økonomi Dashboard', section: 'economic' },
  menu_economic_expenses: { label: 'Udgifter', section: 'economic' },
  menu_economic_budget: { label: 'Budget 2026', section: 'economic' },
  menu_economic_mapping: { label: 'Økonomi Mapping', section: 'economic' },
  menu_economic_upload: { label: 'E-conomic Import', section: 'economic' },

  // ==================== MIT HJEM ====================
  menu_home: { label: 'Hjem', section: 'mit_hjem' },
  menu_home_goals: { label: 'Hjem mål', section: 'mit_hjem' },
  menu_h2h: { label: 'Head-to-Head', section: 'mit_hjem' },
  menu_commission_league: { label: 'Salgsligaen', section: 'mit_hjem' },
  menu_league_admin: { label: 'Liga Administration', section: 'mit_hjem' },
  menu_h2h_admin: { label: 'H2H Admin', section: 'mit_hjem' },
  menu_team_h2h: { label: 'Team H2H', section: 'mit_hjem' },
  menu_messages_personal: { label: 'Beskeder', section: 'mit_hjem' },
  menu_my_schedule: { label: 'Min vagtplan', section: 'mit_hjem' },
  menu_my_profile: { label: 'Min profil', section: 'mit_hjem' },
  menu_my_goals: { label: 'Mine mål', section: 'mit_hjem' },
  menu_my_contracts: { label: 'Mine kontrakter', section: 'mit_hjem' },
  menu_career_wishes: { label: 'Karriereønsker', section: 'mit_hjem' },
  menu_my_feedback: { label: 'Min feedback', section: 'mit_hjem' },
  menu_refer_a_friend: { label: 'Henvis en ven', section: 'mit_hjem' },

  // ==================== SOME ====================
  menu_some: { label: 'SOME', section: 'some' },
  menu_extra_work: { label: 'Ekstraarbejde', section: 'some' },
  menu_extra_work_admin: { label: 'Ekstra arbejde admin', section: 'some' },

  // SOME Tabs
  tab_some_overview: { label: 'Fane: SOME Oversigt', section: 'some' },
  tab_some_content: { label: 'Fane: SOME Indhold', section: 'some' },
  tab_some_goals: { label: 'Fane: SOME Mål', section: 'some' },
  tab_extra_work_my: { label: 'Fane: Mit ekstra arbejde', section: 'some' },
  tab_extra_work_history: { label: 'Fane: Historik', section: 'some' },

  // ==================== PERSONALE ====================
  menu_dashboard: { label: 'Dashboard', section: 'personale' },
  menu_employees: { label: 'Medarbejdere', section: 'personale' },
  menu_teams: { label: 'Teams', section: 'personale' },
  menu_permissions: { label: 'Rettigheder', section: 'personale' },
  menu_login_log: { label: 'Login log', section: 'personale' },
  menu_upcoming_starts: { label: 'Kommende opstart', section: 'personale' },

  // Employees Tabs
  tab_employees_all: { label: 'Fane: Alle medarbejdere', section: 'personale' },
  tab_employees_staff: { label: 'Fane: Backoffice', section: 'personale' },
  tab_employees_teams: { label: 'Fane: Teams', section: 'personale' },
  tab_employees_positions: { label: 'Fane: Stillinger', section: 'personale' },
  tab_employees_permissions: { label: 'Fane: Rettigheder', section: 'personale' },
  tab_employees_dialer_mapping: { label: 'Fane: Dialer-mapping', section: 'personale' },

  // ==================== LEDELSE ====================
  menu_company_overview: { label: 'Firmaoversigt', section: 'ledelse' },
  menu_contracts: { label: 'Kontrakter', section: 'ledelse' },
  menu_career_wishes_overview: { label: 'Karriereønsker overblik', section: 'ledelse' },
  menu_email_templates_ledelse: { label: 'E-mail skabeloner (Ledelse)', section: 'ledelse' },
  menu_security_dashboard: { label: 'Sikkerhedsoversigt', section: 'ledelse' },

  // Contracts Tabs
  tab_contracts_all: { label: 'Fane: Alle kontrakter', section: 'ledelse' },
  tab_contracts_templates: { label: 'Fane: Skabeloner', section: 'ledelse' },

  // ==================== VAGTPLAN ====================
  menu_shift_overview: { label: 'Vagtplan (leder)', section: 'vagtplan' },
  menu_absence: { label: 'Fravær', section: 'vagtplan' },
  menu_time_tracking: { label: 'Tidsregistrering', section: 'vagtplan' },
  menu_time_stamp: { label: 'Stempelur', section: 'vagtplan' },
  menu_closing_shifts: { label: 'Påmindelser', section: 'vagtplan' },

  // ==================== MG ====================
  menu_team_overview: { label: 'Team overblik', section: 'mg' },
  menu_tdc_erhverv: { label: 'TDC Erhverv', section: 'mg' },
  menu_tdc_erhverv_dashboard: { label: 'TDC Erhverv Dashboard', section: 'mg' },
  menu_tdc_opsummering: { label: 'TDC Opsummering', section: 'mg' },
  menu_relatel_dashboard: { label: 'Relatel Dashboard', section: 'mg' },
  menu_codan: { label: 'Codan', section: 'mg' },
  menu_mg_test: { label: 'MG Test', section: 'mg' },
  menu_test_dashboard: { label: 'MG Test Dashboard', section: 'mg' },
  menu_dialer_data: { label: 'Dialer data', section: 'mg' },
  menu_calls_data: { label: 'Opkaldsdata', section: 'mg' },
  menu_adversus_data: { label: 'Adversus data', section: 'mg' },
  menu_payroll: { label: 'Lønkørsel', section: 'mg' },
  menu_tryg_dashboard: { label: 'Tryg Dagsoverblik', section: 'mg' },
  menu_ase_dashboard: { label: 'ASE Dagsoverblik', section: 'mg' },
  menu_km_test: { label: 'KM test', section: 'mg' },

  // MG Tabs
  tab_mg_salary_schemes: { label: 'Fane: Lønordninger', section: 'mg' },
  tab_mg_relatel_status: { label: 'Fane: Relatel Status', section: 'mg' },
  tab_mg_relatel_events: { label: 'Fane: Relatel Events', section: 'mg' },
  tab_mg_products: { label: 'Fane: Produkter', section: 'mg' },
  tab_mg_campaigns: { label: 'Fane: Kampagner', section: 'mg' },
  tab_mg_customers: { label: 'Fane: Kunder', section: 'mg' },
  tab_payroll_overview: { label: 'Fane: Lønoversigt', section: 'mg' },
  tab_payroll_history: { label: 'Fane: Lønhistorik', section: 'mg' },

  // ==================== TEST ====================
  menu_car_quiz_admin: { label: 'Bilquiz admin', section: 'test' },
  menu_coc_admin: { label: 'COC admin', section: 'test' },
  menu_pulse_survey: { label: 'Pulsmåling', section: 'test' },

  // Test Tabs
  tab_car_quiz_questions: { label: 'Fane: Quiz spørgsmål', section: 'test' },
  tab_car_quiz_submissions: { label: 'Fane: Besvarelser', section: 'test' },
  tab_coc_questions: { label: 'Fane: CoC spørgsmål', section: 'test' },
  tab_coc_submissions: { label: 'Fane: CoC besvarelser', section: 'test' },
  tab_pulse_results: { label: 'Fane: Pulsmåling resultater', section: 'test' },
  tab_pulse_template: { label: 'Fane: Pulsmåling skabelon', section: 'test' },
  tab_pulse_teams: { label: 'Fane: Team sammenligning', section: 'test' },

  // ==================== REKRUTTERING ====================
  menu_recruitment_dashboard: { label: 'Rekruttering Dashboard', section: 'rekruttering' },
  menu_candidates: { label: 'Kandidater', section: 'rekruttering' },
  menu_upcoming_interviews: { label: 'Kommende samtaler', section: 'rekruttering' },
  menu_winback: { label: 'Winback', section: 'rekruttering' },
  menu_upcoming_hires: { label: 'Kommende ansættelser', section: 'rekruttering' },
  menu_messages: { label: 'Beskeder (rekruttering)', section: 'rekruttering' },
  menu_sms_templates: { label: 'SMS skabeloner', section: 'rekruttering' },
  menu_email_templates: { label: 'E-mail skabeloner', section: 'rekruttering' },
  menu_referrals: { label: 'Henvisninger', section: 'rekruttering' },

  // Rekruttering Tabs
  tab_recruitment_pipeline: { label: 'Fane: Pipeline', section: 'rekruttering' },
  tab_recruitment_all: { label: 'Fane: Alle kandidater', section: 'rekruttering' },
  tab_winback_ghostet: { label: 'Fane: Ghostet', section: 'rekruttering' },
  tab_winback_takket_nej: { label: 'Fane: Takket nej', section: 'rekruttering' },
  tab_winback_kundeservice: { label: 'Fane: Kundeservice', section: 'rekruttering' },
  tab_messages_all: { label: 'Fane: Alle beskeder', section: 'rekruttering' },
  tab_messages_sms: { label: 'Fane: SMS', section: 'rekruttering' },
  tab_messages_email: { label: 'Fane: Email', section: 'rekruttering' },
  tab_messages_call: { label: 'Fane: Opkald', section: 'rekruttering' },
  tab_messages_sent: { label: 'Fane: Sendt', section: 'rekruttering' },

  // ==================== LØN ====================
  menu_salary_types: { label: 'Løntyper', section: 'salary' },

  // ==================== DASHBOARDS ====================
  menu_dashboards: { label: 'Dashboards (generelt)', section: 'dashboards' },
  menu_dashboard_cph_sales: { label: 'CPH Salg', section: 'dashboards' },
  menu_dashboard_cs_top_20: { label: 'CS Top 20', section: 'dashboards' },
  menu_dashboard_fieldmarketing: { label: 'Fieldmarketing', section: 'dashboards' },
  menu_dashboard_eesy_tm: { label: 'Eesy TM', section: 'dashboards' },
  menu_dashboard_tdc_erhverv: { label: 'TDC Erhverv', section: 'dashboards' },
  menu_dashboard_relatel: { label: 'Relatel', section: 'dashboards' },
  menu_dashboard_tryg: { label: 'Tryg Dashboard', section: 'dashboards' },
  menu_dashboard_ase: { label: 'ASE Dashboard', section: 'dashboards' },
  menu_dashboard_test: { label: 'MG Test', section: 'dashboards' },
  menu_dashboard_united: { label: 'United', section: 'dashboards' },
  menu_dashboard_design: { label: 'Design', section: 'dashboards' },
  menu_dashboard_settings: { label: 'Indstillinger', section: 'dashboards' },

  // Dashboard Settings Tabs
  tab_dashboard_widgets: { label: 'Fane: Widgets', section: 'dashboards' },
  tab_dashboard_kpis: { label: 'Fane: KPIer', section: 'dashboards' },
  tab_dashboard_designs: { label: 'Fane: Designs', section: 'dashboards' },

  // ==================== REPORTS ====================
  menu_reports_admin: { label: 'Admin rapporter', section: 'reports' },
  menu_reports_daily: { label: 'Daglige rapporter', section: 'reports' },
  menu_reports_management: { label: 'Ledelsesrapporter', section: 'reports' },
  menu_reports_employee: { label: 'Medarbejderrapporter', section: 'reports' },
  menu_reports_revenue_by_client: { label: 'Omsætning per opgave', section: 'reports' },

  // ==================== ONBOARDING ====================
  menu_onboarding_overview: { label: 'Onboarding overblik', section: 'onboarding' },
  menu_onboarding_kursus: { label: 'Kursus', section: 'onboarding' },
  menu_onboarding_ramp: { label: 'Ramp-up', section: 'onboarding' },
  menu_onboarding_leader: { label: 'Leder-onboarding', section: 'onboarding' },
  menu_onboarding_drills: { label: 'Drills', section: 'onboarding' },
  menu_onboarding_admin: { label: 'Onboarding admin', section: 'onboarding' },
  menu_onboarding: { label: 'Onboarding', section: 'onboarding' },
  menu_coaching_templates: { label: 'Coaching skabeloner', section: 'onboarding' },

  // Onboarding Tabs
  tab_onboarding_overview: { label: 'Fane: Onboarding oversigt', section: 'onboarding' },
  tab_onboarding_ramp: { label: 'Fane: Forventninger', section: 'onboarding' },
  tab_onboarding_leader: { label: 'Fane: Leder', section: 'onboarding' },
  tab_onboarding_drills: { label: 'Fane: Drill-bibliotek', section: 'onboarding' },
  tab_onboarding_template: { label: 'Fane: Skabelon', section: 'onboarding' },
  tab_onboarding_admin: { label: 'Fane: Onboarding admin', section: 'onboarding' },
  tab_onboarding_days: { label: 'Fane: Dage', section: 'onboarding' },
  tab_onboarding_expectations: { label: 'Fane: Forventninger', section: 'onboarding' },
  tab_onboarding_messages: { label: 'Fane: Beskeder', section: 'onboarding' },

  // ==================== ADMIN ====================
  menu_kpi_definitions: { label: 'KPI definitioner', section: 'admin' },

  // ==================== FIELDMARKETING ====================
  menu_fm_overview: { label: 'Oversigt', section: 'fieldmarketing' },
  menu_fm_my_week: { label: 'Min uge', section: 'fieldmarketing' },
  menu_fm_booking: { label: 'Booking', section: 'fieldmarketing' },
  menu_fm_vehicles: { label: 'Køretøjer', section: 'fieldmarketing' },
  menu_fm_dashboard: { label: 'Dashboard', section: 'fieldmarketing' },
  menu_fm_sales_registration: { label: 'Salgsregistrering', section: 'fieldmarketing' },
  menu_fm_billing: { label: 'Fakturering', section: 'fieldmarketing' },
  menu_fm_travel_expenses: { label: 'Rejseudgifter', section: 'fieldmarketing' },
  menu_fm_edit_sales: { label: 'Ret salg', section: 'fieldmarketing' },
  menu_fm_time_off: { label: 'Fraværsanmodninger', section: 'fieldmarketing' },
  menu_fm_book_week: { label: 'Book uge', section: 'fieldmarketing' },
  menu_fm_bookings: { label: 'Kommende bookinger', section: 'fieldmarketing' },
  menu_fm_locations: { label: 'Lokationer', section: 'fieldmarketing' },
  menu_fm_vagtplan_fm: { label: 'Vagtplan FM', section: 'fieldmarketing' },

  // Fieldmarketing Tabs
  tab_fm_book_week: { label: 'Fane: Book uge', section: 'fieldmarketing' },
  tab_fm_bookings: { label: 'Fane: Kommende bookinger', section: 'fieldmarketing' },
  tab_fm_markets: { label: 'Fane: Kommende markeder', section: 'fieldmarketing' },
  tab_fm_locations: { label: 'Fane: Lokationer', section: 'fieldmarketing' },
  tab_fm_vagtplan: { label: 'Fane: Vagtplan FM', section: 'fieldmarketing' },
  tab_fm_eesy: { label: 'Fane: Eesy FM', section: 'fieldmarketing' },
  tab_fm_yousee: { label: 'Fane: Yousee', section: 'fieldmarketing' },

  // ==================== SALG & SYSTEM ====================
  menu_sales: { label: 'Salg', section: 'sales_system' },
  menu_logics: { label: 'Logikker', section: 'sales_system' },
  menu_live_stats: { label: 'Live Stats', section: 'sales_system' },
  menu_settings: { label: 'Indstillinger', section: 'sales_system' },
  menu_boards_sales: { label: 'Sales Dashboard', section: 'sales_system' },

  // Settings Tabs
  tab_settings_api: { label: 'Fane: API Integrationer', section: 'sales_system' },
  tab_settings_dialer: { label: 'Fane: Dialer Integrationer', section: 'sales_system' },
  tab_settings_customer: { label: 'Fane: Kunde Integrationer', section: 'sales_system' },
  tab_settings_webhooks: { label: 'Fane: Webhooks', section: 'sales_system' },
  tab_settings_logs: { label: 'Fane: Logs', section: 'sales_system' },
  tab_settings_excel_crm: { label: 'Fane: Excel CRM Import', section: 'sales_system' },

  // ==================== SOFTPHONE & KOMMUNIKATION ====================
  softphone_outbound: { label: 'Softphone: Udgående opkald', section: 'softphone' },
  softphone_inbound: { label: 'Softphone: Indgående opkald', section: 'softphone' },
  employee_sms: { label: 'SMS til medarbejdere', section: 'softphone' },

  // ==================== LEGACY/ALIAS KEYS ====================
  // These are kept for backwards compatibility but should not be used for new features
  menu_leaderboard: { label: 'Leaderboard', section: 'legacy' },
  menu_my_sales: { label: 'Mine salg', section: 'legacy' },
  menu_my_shifts: { label: 'Mine vagter', section: 'legacy' },
  menu_my_absence: { label: 'Mit fravær', section: 'legacy' },
  menu_my_coaching: { label: 'Min coaching', section: 'legacy' },
  menu_refer_friend: { label: 'Henvis en ven (alias)', section: 'legacy' },
  menu_messages_recruitment: { label: 'Beskeder (rekruttering, alias)', section: 'legacy' },
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
