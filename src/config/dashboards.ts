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
  { slug: "eesy-tm", name: "Eesy TM", path: "/dashboards/eesy-tm", permissionKey: "menu_dashboard_eesy_tm" },
  { slug: "tdc-erhverv", name: "TDC Erhverv", path: "/dashboards/tdc-erhverv", permissionKey: "menu_dashboard_tdc_erhverv" },
  { slug: "relatel", name: "Relatel", path: "/dashboards/relatel", permissionKey: "menu_dashboard_relatel" },
  { slug: "mg-test", name: "MG Test", path: "/dashboards/mg-test", permissionKey: "menu_dashboard_mg_test" },
  { slug: "united", name: "United", path: "/dashboards/united", permissionKey: "menu_dashboard_united" },
  { slug: "test", name: "Test Dashboard", path: "/dashboards/test", permissionKey: "menu_dashboard_test" },
  { slug: "cs-top-20", name: "CS Top 20", path: "/dashboards/cs-top-20", permissionKey: "menu_dashboard_cs_top_20" },
];
