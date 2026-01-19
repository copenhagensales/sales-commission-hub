// Dashboard configuration - centralized list of all dashboards
export interface DashboardConfig {
  slug: string;
  name: string;
  path: string;
  // Permission key is optional - if not set, dashboard is visible to all
  permissionKey?: string;
}

export const DASHBOARD_LIST: DashboardConfig[] = [
  { slug: "cph-sales", name: "Dagsboard CPH Sales", path: "/dashboards/cph-sales", permissionKey: "menu_dashboard_cph_sales" },
  { slug: "fieldmarketing", name: "Fieldmarketing", path: "/dashboards/fieldmarketing", permissionKey: "menu_dashboard_fieldmarketing" },
  { slug: "team", name: "Team Dashboard", path: "/dashboards/team", permissionKey: "menu_dashboard_team" },
  { slug: "eesy-tm", name: "Eesy TM", path: "/dashboards/eesy-tm", permissionKey: "menu_dashboard_eesy_tm" },
  { slug: "tdc-erhverv", name: "TDC Erhverv", path: "/dashboards/tdc-erhverv", permissionKey: "menu_dashboard_tdc_erhverv" },
  { slug: "tdc-erhverv-goals", name: "TDC Erhverv Mål", path: "/dashboards/tdc-erhverv-goals", permissionKey: "menu_dashboard_tdc_goals" },
  { slug: "fieldmarketing-goals", name: "Fieldmarketing Mål", path: "/dashboards/fieldmarketing-goals", permissionKey: "menu_dashboard_fm_goals" },
  { slug: "relatel", name: "Relatel", path: "/dashboards/relatel", permissionKey: "menu_dashboard_relatel" },
  { slug: "tryg", name: "Tryg", path: "/dashboards/tryg", permissionKey: "menu_dashboard_tryg" },
  { slug: "ase", name: "ASE", path: "/dashboards/ase", permissionKey: "menu_dashboard_ase" },
  { slug: "mg-test", name: "MG Test", path: "/dashboards/mg-test", permissionKey: "menu_dashboard_mg_test" },
  { slug: "united", name: "United", path: "/dashboards/united", permissionKey: "menu_dashboard_united" },
  { slug: "test", name: "Test Dashboard", path: "/dashboards/test", permissionKey: "menu_dashboard_test" },
  { slug: "cs-top-20", name: "CS Top 20", path: "/dashboards/cs-top-20", permissionKey: "menu_dashboard_cs_top_20" },
];
