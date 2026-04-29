// Single source of truth for all permissions in the application
// Used by both routes (config.tsx) and PositionsTab.tsx

export type DataScope = "egen" | "team" | "alt";

export interface Permission {
  key: string;
  label: string;
  description: string;
  hasEditOption?: boolean;
  scopeKey?: string;
}

export interface PermissionCategory {
  key: string;
  label: string;
  icon: string;
  permissions: Permission[];
}

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  // ==================== MENU SEKTIONER (Parent permissions for sidebars) ====================
  {
    key: "menu_sections",
    label: "Menu sektioner",
    icon: "📁",
    permissions: [
      { key: "menu_section_personal", label: "Mit Hjem sektion", description: "Adgang til Mit Hjem menuen", hasEditOption: false },
      { key: "menu_section_some", label: "SOME sektion", description: "Adgang til SOME menuen", hasEditOption: false },
      { key: "menu_section_personale", label: "Personale sektion", description: "Adgang til Personale menuen", hasEditOption: false },
      { key: "menu_section_ledelse", label: "Ledelse sektion", description: "Adgang til Ledelse menuen", hasEditOption: false },
      { key: "menu_section_test", label: "Test sektion", description: "Adgang til Test menuen", hasEditOption: false },
      { key: "menu_section_mg", label: "MG sektion", description: "Adgang til MG menuen", hasEditOption: false },
      { key: "menu_section_vagtplan", label: "Vagtplan sektion", description: "Adgang til Vagtplan menuen", hasEditOption: false },
      { key: "menu_section_fieldmarketing", label: "Fieldmarketing sektion", description: "Adgang til Fieldmarketing menuen", hasEditOption: false },
      { key: "menu_section_rekruttering", label: "Rekruttering sektion", description: "Adgang til Rekruttering menuen", hasEditOption: false },
      { key: "menu_section_boards", label: "Boards sektion", description: "Adgang til Boards menuen", hasEditOption: false },
      { key: "menu_section_salary", label: "Løn sektion", description: "Adgang til Løn menuen", hasEditOption: false },
      { key: "menu_section_reports", label: "Rapporter sektion", description: "Adgang til Rapporter menuen", hasEditOption: false },
      { key: "menu_section_onboarding", label: "Onboarding sektion", description: "Adgang til Onboarding menuen", hasEditOption: false },
      { key: "menu_section_spil", label: "Spil sektion", description: "Adgang til Spil menuen (H2H og Liga)", hasEditOption: false },
      { key: "menu_section_economic", label: "Økonomi sektion", description: "Adgang til Økonomi menuen", hasEditOption: false },
    ],
  },

  // ==================== ØKONOMI ====================
  {
    key: "menu_economic",
    label: "Økonomi menu",
    icon: "💰",
    permissions: [
      { key: "menu_economic_dashboard", label: "Økonomi Dashboard", description: "Adgang til økonomi overblik", hasEditOption: false },
      { key: "menu_economic_expenses", label: "Udgifter", description: "Adgang til udgiftsoversigt", hasEditOption: false },
      { key: "menu_economic_budget", label: "Budget 2026", description: "Adgang til budget planlægning", hasEditOption: true },
      { key: "menu_economic_mapping", label: "Økonomi Mapping", description: "Adgang til konto/kategori mapping", hasEditOption: true },
      { key: "menu_economic_upload", label: "E-conomic Import", description: "Adgang til at importere e-conomic data", hasEditOption: false },
    ],
  },

  // ==================== MIT HJEM ====================
  {
    key: "menu_mit_hjem",
    label: "Mit Hjem menu",
    icon: "🏠",
    permissions: [
      { key: "menu_home", label: "Hjem", description: "Adgang til hjem oversigt", hasEditOption: false },
      {
        key: "menu_home_goals",
        label: "Hjem mål",
        description: "Ret til at ændre virksomhedens kundemål på hjemsiden",
        hasEditOption: true,
      },
      { key: "menu_h2h", label: "Head to Head", description: "Adgang til Head to Head", hasEditOption: false },
      { key: "menu_commission_league", label: "Superligaen", description: "Adgang til provisionsligaen", hasEditOption: false },
      { key: "menu_messages_personal", label: "Beskeder", description: "Adgang til beskeder", hasEditOption: false },
      { key: "menu_my_schedule", label: "Min kalender", description: "Adgang til egen kalender", hasEditOption: false },
      { key: "menu_my_profile", label: "Min profil", description: "Adgang til egen profil", hasEditOption: true },
      { key: "menu_my_goals", label: "Mine Mål", description: "Adgang til personlige mål", hasEditOption: false },
      { key: "menu_team_goals", label: "Teammål", description: "Adgang til teammål", hasEditOption: false },
      {
        key: "menu_my_contracts",
        label: "Mine kontrakter",
        description: "Adgang til egne kontrakter",
        hasEditOption: false,
      },
      {
        key: "menu_career_wishes",
        label: "Teamønsker & karriere",
        description: "Adgang til at udfylde karriereønsker",
        hasEditOption: false,
      },
      { key: "menu_my_feedback", label: "Min Feedback", description: "Adgang til feedback", hasEditOption: false },
      {
        key: "menu_refer_a_friend",
        label: "Anbefal en ven",
        description: "Adgang til at dele referral link og se egne anbefalinger",
        hasEditOption: false,
      },
      {
        key: "menu_immediate_payment_ase",
        label: "Straksbetaling (ASE)",
        description: "Adgang til at se ASE-salg med mulighed for straksbetaling",
        hasEditOption: false,
      },
      {
        key: "menu_tdc_opsummering",
        label: "TDC Opsummering",
        description: "Adgang til TDC opsummeringsværktøj",
        hasEditOption: false,
      },
    ],
  },

  // ==================== EKSTRAARBEJDE MENU ====================
  {
    key: "menu_extra_work_group",
    label: "Ekstraarbejde menu",
    icon: "🛠️",
    permissions: [
      {
        key: "menu_extra_work",
        label: "Ekstra arbejde",
        description: "Adgang til ekstra arbejde",
        hasEditOption: true,
        scopeKey: "scope_extra_work",
      },
      {
        key: "menu_extra_work_admin",
        label: "Ekstra arbejde admin",
        description: "Adgang til ekstra arbejde administration",
        hasEditOption: true,
      },
    ],
  },
  {
    key: "tabs_extra_work",
    label: "Ekstra arbejde faner",
    icon: "📑",
    permissions: [
      {
        key: "tab_extra_work_my",
        label: "Mit ekstra arbejde",
        description: "Adgang til eget ekstra arbejde fane",
        hasEditOption: false,
      },
      {
        key: "tab_extra_work_history",
        label: "Historik",
        description: "Adgang til ekstra arbejde historik fane",
        hasEditOption: true,
      },
    ],
  },

  // ==================== PERSONALE MENU ====================
  {
    key: "menu_personnel",
    label: "Personale menu",
    icon: "👥",
    permissions: [
      {
        key: "menu_employees",
        label: "Medarbejdere",
        description: "Adgang til medarbejdersiden",
        hasEditOption: true,
        scopeKey: "scope_employees",
      },
      { key: "menu_login_log", label: "Login Log", description: "Adgang til login log", hasEditOption: false },
      {
        key: "menu_upcoming_starts",
        label: "Kommende Opstarter",
        description: "Adgang til kommende opstartshold",
        hasEditOption: true,
      },
    ],
  },
  {
    key: "tabs_employees",
    label: "Medarbejdere faner",
    icon: "📑",
    permissions: [
      {
        key: "tab_employees_all",
        label: "Alle medarbejdere",
        description: "Adgang til alle medarbejdere fane",
        hasEditOption: true,
      },
      {
        key: "tab_employees_staff",
        label: "Funktionærer",
        description: "Adgang til funktionærer fane",
        hasEditOption: true,
      },
      {
        key: "tab_employees_dialer_mapping",
        label: "Dialer mapping",
        description: "Adgang til dialer mapping fane",
        hasEditOption: true,
      },
      { key: "tab_employees_teams", label: "Teams fane", description: "Adgang til teams fane", hasEditOption: true },
      {
        key: "tab_employees_positions",
        label: "Stillinger",
        description: "Adgang til stillinger fane",
        hasEditOption: true,
      },
    ],
  },

  // ==================== LEDELSE MENU ====================
  {
    key: "menu_management",
    label: "Ledelse menu",
    icon: "👑",
    permissions: [
      {
        key: "menu_contracts",
        label: "Kontrakter",
        description: "Adgang til kontraktmodul",
        hasEditOption: true,
        scopeKey: "scope_contracts",
      },
      {
        key: "menu_permissions",
        label: "Rettigheder",
        description: "Adgang til rettighedsstyring",
        hasEditOption: true,
      },
      {
        key: "menu_career_wishes_overview",
        label: "Karriereønsker",
        description: "Adgang til karriereønsker overblik",
        hasEditOption: true,
        scopeKey: "scope_career_wishes",
      },
      {
        key: "menu_security_dashboard",
        label: "Sikkerhedsoversigt",
        description: "Adgang til sikkerhedsdashboard (MFA reset, kontolåsning)",
        hasEditOption: false,
      },
    ],
  },
  {
    key: "tabs_contracts",
    label: "Kontrakter faner",
    icon: "📑",
    permissions: [
      {
        key: "tab_contracts_all",
        label: "Alle kontrakter",
        description: "Adgang til alle kontrakter fane",
        hasEditOption: true,
      },
      {
        key: "tab_contracts_templates",
        label: "Skabeloner",
        description: "Adgang til kontraktskabeloner fane",
        hasEditOption: true,
      },
    ],
  },

  // ==================== VAGTPLAN MENU ====================
  {
    key: "menu_shift_planning",
    label: "Vagtplan menu",
    icon: "📅",
    permissions: [
      {
        key: "menu_shift_overview",
        label: "Vagtplan",
        description: "Adgang til vagtplan oversigt",
        hasEditOption: true,
        scopeKey: "scope_shifts",
      },
      {
        key: "menu_absence",
        label: "Fravær",
        description: "Adgang til fraværsmodul",
        hasEditOption: true,
        scopeKey: "scope_absence",
      },
      {
        key: "menu_time_tracking",
        label: "Tidsregistrering",
        description: "Adgang til tidsregistrering",
        hasEditOption: true,
        scopeKey: "scope_time_tracking",
      },
      { key: "menu_time_stamp", label: "Stempelur", description: "Adgang til stempel ind/ud", hasEditOption: false },
      { key: "menu_closing_shifts", label: "Påmindelser", description: "Adgang til påmindelser", hasEditOption: true },
    ],
  },

  // ==================== FIELDMARKETING MENU ====================
  {
    key: "menu_fieldmarketing",
    label: "Fieldmarketing menu",
    icon: "🚗",
    permissions: [
      { key: "menu_fm_my_schedule", label: "Min vagtplan", description: "Adgang til personlig vagtplan", hasEditOption: false },
      {
        key: "menu_fm_overview",
        label: "Dashboard",
        description: "Adgang til fieldmarketing dashboard",
        hasEditOption: true,
        scopeKey: "scope_fieldmarketing",
      },
      { key: "menu_fm_booking", label: "Booking Management", description: "Adgang til booking management side", hasEditOption: true },
      { key: "menu_fm_book_week", label: "Book uge", description: "Adgang til book uge", hasEditOption: true },
      { key: "menu_fm_bookings", label: "Bookinger", description: "Adgang til bookinger", hasEditOption: true },
      { key: "menu_fm_locations", label: "Lokationer", description: "Adgang til lokationer", hasEditOption: true },
      { key: "menu_fm_vehicles", label: "Køretøjer", description: "Adgang til køretøjer", hasEditOption: true },
      { key: "menu_fm_billing", label: "Fakturering", description: "Adgang til fakturering", hasEditOption: true },
      {
        key: "menu_fm_time_off",
        label: "Fraværsanmodninger",
        description: "Adgang til fraværsanmodninger",
        hasEditOption: true,
      },
      {
        key: "menu_fm_sales_registration",
        label: "Salgsregistrering",
        description: "Adgang til salgsregistrering",
        hasEditOption: true,
      },
      {
        key: "menu_fm_edit_sales",
        label: "Ret salgsregistrering (Leder)",
        description: "Adgang til at redigere alle fieldmarketing salgsregistreringer",
        hasEditOption: true,
      },
      {
        key: "menu_fm_travel_expenses",
        label: "Rejsekort og diæter",
        description: "Adgang til rejsekort og diætregler",
        hasEditOption: false,
      },
    ],
  },
  {
    key: "tabs_fieldmarketing_booking",
    label: "Fieldmarketing Booking faner",
    icon: "📑",
    permissions: [
      { key: "tab_fm_book_week", label: "Book uge fane", description: "Adgang til book uge fane", hasEditOption: true },
      {
        key: "tab_fm_bookings",
        label: "Bookinger fane",
        description: "Adgang til bookinger fane",
        hasEditOption: true,
      },
      {
        key: "tab_fm_locations",
        label: "Lokationer fane",
        description: "Adgang til lokationer fane",
        hasEditOption: true,
      },
    ],
  },

  // ==================== SOFTPHONE ====================
  {
    key: "menu_softphone",
    label: "Softphone",
    icon: "📞",
    permissions: [
      {
        key: "softphone_outbound",
        label: "Udgående opkald",
        description: "Kan foretage udgående opkald via softphone",
        hasEditOption: false,
      },
      {
        key: "softphone_inbound",
        label: "Indgående opkald",
        description: "Kan modtage indgående opkald og returkald",
        hasEditOption: false,
      },
      {
        key: "employee_sms",
        label: "SMS til medarbejdere",
        description: "Kan sende SMS til medarbejdere fra medarbejderoversigten",
        hasEditOption: false,
      },
    ],
  },

  // ==================== REKRUTTERING MENU ====================
  {
    key: "menu_recruitment",
    label: "Rekruttering menu",
    icon: "🎯",
    permissions: [
      {
        key: "menu_recruitment_dashboard",
        label: "Rekruttering",
        description: "Adgang til rekruttering dashboard",
        hasEditOption: true,
      },
      { key: "menu_candidates", label: "Kandidater", description: "Adgang til kandidatliste", hasEditOption: true },
      {
        key: "menu_upcoming_interviews",
        label: "Kommende samtaler",
        description: "Adgang til kommende samtaler",
        hasEditOption: true,
      },
      { key: "menu_winback", label: "Winback", description: "Adgang til winback", hasEditOption: true },
      {
        key: "menu_upcoming_hires",
        label: "Ansættelser",
        description: "Adgang til kommende ansættelser",
        hasEditOption: true,
      },
      { key: "menu_messages", label: "Beskeder", description: "Adgang til rekruttering beskeder", hasEditOption: true },
      {
        key: "menu_sms_templates",
        label: "SMS-skabeloner",
        description: "Adgang til SMS skabeloner",
        hasEditOption: true,
      },
      {
        key: "menu_email_templates",
        label: "Email-skabeloner",
        description: "Adgang til email skabeloner",
        hasEditOption: true,
      },
      {
        key: "menu_referrals",
        label: "Henvisninger",
        description: "Adgang til at administrere medarbejderanbefalinger",
        hasEditOption: true,
      },
    ],
  },
  {
    key: "tabs_recruitment_candidates",
    label: "Rekruttering Kandidater faner",
    icon: "📑",
    permissions: [
      {
        key: "tab_recruitment_pipeline",
        label: "Pipeline",
        description: "Adgang til kandidat pipeline fane",
        hasEditOption: true,
      },
      {
        key: "tab_recruitment_all",
        label: "Alle kandidater",
        description: "Adgang til alle kandidater fane",
        hasEditOption: true,
      },
    ],
  },

  // ==================== MG MENU ====================
  {
    key: "menu_mg",
    label: "MG menu",
    icon: "📊",
    permissions: [
      {
        key: "menu_payroll",
        label: "Lønkørsel",
        description: "Adgang til lønkørsel",
        hasEditOption: true,
        scopeKey: "scope_payroll",
      },
      {
        key: "menu_team_overview",
        label: "Team oversigt",
        description: "Adgang til team oversigt",
        hasEditOption: true,
      },
      { key: "menu_tdc_erhverv", label: "TDC Erhverv", description: "Adgang til TDC Erhverv", hasEditOption: true },
      {
        key: "menu_tdc_erhverv_dashboard",
        label: "TDC Dagsoverblik",
        description: "Adgang til TDC dagsoverblik",
        hasEditOption: true,
      },
      {
        key: "menu_relatel_dashboard",
        label: "Relatel Dagsoverblik",
        description: "Adgang til Relatel dagsoverblik",
        hasEditOption: true,
      },
      {
        key: "menu_tryg_dashboard",
        label: "Tryg Dagsoverblik",
        description: "Adgang til Tryg dagsoverblik",
        hasEditOption: true,
      },
      {
        key: "menu_ase_dashboard",
        label: "ASE Dagsoverblik",
        description: "Adgang til ASE dagsoverblik",
        hasEditOption: true,
      },
      { key: "menu_codan", label: "Codan", description: "Adgang til Codan dashboard", hasEditOption: true },
      { key: "menu_mg_test", label: "MG test", description: "Adgang til MG Test", hasEditOption: true },
      { key: "menu_km_test", label: "KM test", description: "Adgang til KM Test (økonomi)", hasEditOption: true },
      {
        key: "menu_test_dashboard",
        label: "Test Dashboard",
        description: "Adgang til test dashboard",
        hasEditOption: true,
      },
      { key: "menu_dialer_data", label: "Dialer Data", description: "Adgang til dialer data", hasEditOption: true },
      { key: "menu_calls_data", label: "Opkaldsdata", description: "Adgang til opkaldsdata", hasEditOption: true },
      {
        key: "menu_adversus_data",
        label: "Datakilder info",
        description: "Adgang til datakilder info",
        hasEditOption: true,
      },
    ],
  },
  {
    key: "tabs_mg_test",
    label: "MG Test faner",
    icon: "📑",
    permissions: [
      { key: "tab_mg_products", label: "Produkter", description: "Adgang til produkter fane", hasEditOption: true },
      { key: "tab_mg_campaigns", label: "Kampagner", description: "Adgang til kampagner fane", hasEditOption: true },
      { key: "tab_mg_customers", label: "Kunder", description: "Adgang til kunder fane", hasEditOption: true },
    ],
  },
  {
    key: "tabs_payroll",
    label: "Lønkørsel faner",
    icon: "📑",
    permissions: [
      {
        key: "tab_payroll_overview",
        label: "Oversigt",
        description: "Adgang til lønkørsel oversigt fane",
        hasEditOption: true,
      },
      {
        key: "tab_payroll_history",
        label: "Historik",
        description: "Adgang til lønkørsel historik fane",
        hasEditOption: true,
      },
    ],
  },

  // ==================== DASHBOARDS MENU ====================
  // NOTE: Individual dashboard permissions are now managed via team_dashboard_permissions
  // in the dashboard environment (DashboardPermissionsTab). Only general access is here.
  {
    key: "menu_dashboards",
    label: "Dashboards menu",
    icon: "📺",
    permissions: [
      {
        key: "menu_dashboards",
        label: "Dashboards (generelt)",
        description: "Generel adgang til dashboards miljøet",
        hasEditOption: false,
      },
    ],
  },

  // ==================== LØN MENU ====================
  {
    key: "menu_salary",
    label: "Løn menu",
    icon: "💰",
    permissions: [
      {
        key: "menu_salary_types",
        label: "Lønarter",
        description: "Adgang til lønarter administration",
        hasEditOption: true,
      },
      {
        key: "menu_cancellations",
        label: "Annulleringer",
        description: "Adgang til annulleringer oversigt",
        hasEditOption: true,
      },
    ],
  },

  // ==================== TEST MENU ====================
  {
    key: "menu_test",
    label: "Test menu",
    icon: "🧪",
    permissions: [
      {
        key: "menu_car_quiz_admin",
        label: "Bil-quiz overblik",
        description: "Adgang til bil quiz administration",
        hasEditOption: true,
        scopeKey: "scope_quiz",
      },
      {
        key: "menu_coc_admin",
        label: "Code of Conduct overblik",
        description: "Adgang til Code of Conduct administration",
        hasEditOption: true,
      },
      {
        key: "menu_pulse_survey",
        label: "Pulsmåling",
        description: "Adgang til pulsmåling resultater",
        hasEditOption: true,
      },
    ],
  },
  {
    key: "tabs_car_quiz",
    label: "Bil Quiz faner",
    icon: "📑",
    permissions: [
      {
        key: "tab_car_quiz_questions",
        label: "Spørgsmål",
        description: "Adgang til quiz spørgsmål fane",
        hasEditOption: true,
      },
      {
        key: "tab_car_quiz_submissions",
        label: "Besvarelser",
        description: "Adgang til besvarelser fane",
        hasEditOption: true,
      },
    ],
  },
  {
    key: "tabs_coc",
    label: "Code of Conduct faner",
    icon: "📑",
    permissions: [
      {
        key: "tab_coc_questions",
        label: "Spørgsmål",
        description: "Adgang til CoC spørgsmål fane",
        hasEditOption: true,
      },
      {
        key: "tab_coc_submissions",
        label: "Besvarelser",
        description: "Adgang til CoC besvarelser fane",
        hasEditOption: true,
      },
    ],
  },
  {
    key: "tabs_pulse_survey",
    label: "Pulsmåling faner",
    icon: "📑",
    permissions: [
      {
        key: "tab_pulse_results",
        label: "Resultater",
        description: "Adgang til pulsmåling resultater fane",
        hasEditOption: true,
      },
      {
        key: "tab_pulse_template",
        label: "Skabelon",
        description: "Adgang til pulsmåling skabelon fane",
        hasEditOption: true,
      },
      {
        key: "tab_pulse_teams",
        label: "Team sammenligning",
        description: "Adgang til team sammenligning fane",
        hasEditOption: true,
      },
    ],
  },

  // ==================== ONBOARDING MENU ====================
  {
    key: "menu_onboarding",
    label: "Onboarding menu",
    icon: "🎓",
    permissions: [
      {
        key: "menu_onboarding",
        label: "Onboarding",
        description: "Adgang til onboarding oversigt",
        hasEditOption: true,
      },
      {
        key: "menu_onboarding_leader",
        label: "Leder onboarding",
        description: "Adgang til leder onboarding",
        hasEditOption: true,
      },
      {
        key: "menu_onboarding_admin",
        label: "Onboarding admin",
        description: "Adgang til onboarding administration",
        hasEditOption: true,
      },
    ],
  },
  {
    key: "tabs_onboarding_admin",
    label: "Onboarding Admin faner",
    icon: "📑",
    permissions: [
      {
        key: "tab_onboarding_days",
        label: "Dage",
        description: "Adgang til onboarding dage fane",
        hasEditOption: true,
      },
      { key: "tab_onboarding_drills", label: "Drills", description: "Adgang til drills fane", hasEditOption: true },
      {
        key: "tab_onboarding_expectations",
        label: "Forventninger",
        description: "Adgang til forventninger fane",
        hasEditOption: true,
      },
      {
        key: "tab_onboarding_messages",
        label: "Beskeder",
        description: "Adgang til onboarding beskeder fane",
        hasEditOption: true,
      },
    ],
  },

  // ==================== RAPPORTER MENU ====================
  {
    key: "menu_reports",
    label: "Rapporter menu",
    icon: "📈",
    permissions: [
      {
        key: "menu_reports_admin",
        label: "Rapporter Admin",
        description: "Adgang til administrative rapporter",
        hasEditOption: false,
      },
      {
        key: "menu_reports_daily",
        label: "Dagsrapporter",
        description: "Adgang til daglige rapporter med vagtregistrering",
        hasEditOption: false,
        scopeKey: "scope_reports_daily",
      },
      {
        key: "menu_reports_management",
        label: "Rapporter Ledelse",
        description: "Adgang til ledelsesrapporter",
        hasEditOption: false,
      },
      {
        key: "menu_reports_employee",
        label: "Rapporter Medarbejder",
        description: "Adgang til medarbejderrapporter",
        hasEditOption: false,
      },
      {
        key: "menu_reports_revenue_by_client",
        label: "Omsætning per opgave",
        description: "Adgang til omsætningsrapport per kunde/opgave",
        hasEditOption: false,
      },
    ],
  },

  // ==================== HOVEDMENUER (TOP LEVEL) ====================
  {
    key: "menu_main",
    label: "Hovedmenuer",
    icon: "📱",
    permissions: [
      { key: "menu_dashboard", label: "Dashboard", description: "Adgang til dashboard oversigt", hasEditOption: false },
      {
        key: "menu_sales",
        label: "Salg",
        description: "Adgang til salgsdata",
        hasEditOption: true,
        scopeKey: "scope_sales",
      },
      { key: "menu_logics", label: "Logikker", description: "Adgang til logikker", hasEditOption: true },
    ],
  },

  // ==================== BOARDS MENU ====================
  {
    key: "menu_boards",
    label: "Boards menu",
    icon: "🖥️",
    permissions: [
      {
        key: "menu_boards_sales",
        label: "Sales Dashboard",
        description: "Adgang til sales dashboard",
        hasEditOption: false,
      },
    ],
  },

  // ==================== ADMIN MENU ====================
  {
    key: "menu_admin",
    label: "Admin menu",
    icon: "🔧",
    permissions: [
      {
        key: "menu_kpi_definitions",
        label: "KPI Definitioner",
        description: "Adgang til central KPI dokumentation og test",
        hasEditOption: true,
      },
    ],
  },

  // ==================== SYSTEM MENU ====================
  {
    key: "menu_system",
    label: "System menu",
    icon: "⚙️",
    permissions: [
      {
        key: "menu_settings",
        label: "Indstillinger",
        description: "Adgang til systemindstillinger",
        hasEditOption: true,
      },
      {
        key: "menu_league_admin",
        label: "Liga Administration",
        description: "Adgang til at administrere Superligaen",
        hasEditOption: false,
      },
    ],
  },
  {
    key: "tabs_settings",
    label: "Indstillinger faner",
    icon: "📑",
    permissions: [
      {
        key: "tab_settings_api",
        label: "API Integrationer",
        description: "Adgang til API integrationer fane",
        hasEditOption: true,
      },
      {
        key: "tab_settings_dialer",
        label: "Dialer Integrationer",
        description: "Adgang til dialer integrationer fane",
        hasEditOption: true,
      },
      {
        key: "tab_settings_customer",
        label: "Kunde Integrationer",
        description: "Adgang til kunde integrationer fane",
        hasEditOption: true,
      },
      { key: "tab_settings_webhooks", label: "Webhooks", description: "Adgang til webhooks fane", hasEditOption: true },
      { key: "tab_settings_logs", label: "Logs", description: "Adgang til integrationslog fane", hasEditOption: true },
      {
        key: "tab_settings_excel_crm",
        label: "Excel CRM Import",
        description: "Adgang til Excel CRM import fane",
        hasEditOption: true,
      },
    ],
  },
];

// Permission keys to exclude from owner (Ejer) position
export const OWNER_EXCLUDED_PERMISSIONS = [
  'softphone_outbound',
  'softphone_inbound',
  'employee_sms',
];

// Generate all permissions with full access
// excludeKeys: optional array of permission keys to exclude
export const generateAllPermissions = (excludeKeys: string[] = []): Record<string, boolean | { view: boolean; edit: boolean } | DataScope> => {
  const allPermissions: Record<string, boolean | { view: boolean; edit: boolean } | DataScope> = {};
  PERMISSION_CATEGORIES.forEach((category) => {
    category.permissions.forEach((permission) => {
      // Skip excluded permissions
      if (excludeKeys.includes(permission.key)) {
        return;
      }
      if (permission.hasEditOption) {
        allPermissions[permission.key] = { view: true, edit: true };
      } else {
        allPermissions[permission.key] = true;
      }
      if (permission.scopeKey) {
        allPermissions[permission.scopeKey] = "alt";
      }
    });
  });
  return allPermissions;
};

// Get all permission keys for validation
export const getAllPermissionKeys = (): string[] => {
  const keys: string[] = [];
  PERMISSION_CATEGORIES.forEach((category) => {
    category.permissions.forEach((permission) => {
      keys.push(permission.key);
      if (permission.scopeKey) {
        keys.push(permission.scopeKey);
      }
    });
  });
  return keys;
};

// Available landing pages
export const LANDING_PAGE_OPTIONS = [
  { value: "/home", label: "Hjem" },
  { value: "/my-schedule", label: "Min kalender" },
  { value: "/shift-planning", label: "Vagtplan" },
  { value: "/dashboard", label: "Dashboard" },
  { value: "/vagt-flow", label: "Fieldmarketing" },
  { value: "/employees", label: "Medarbejdere" },
  { value: "/contracts", label: "Kontrakter" },
  { value: "/recruitment", label: "Rekruttering" },
  { value: "/sales", label: "Salg" },
  { value: "/payroll", label: "Lønkørsel" },
  { value: "/onboarding-program", label: "Onboarding" },
];
