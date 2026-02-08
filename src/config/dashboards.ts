// Dashboard configuration - centralized list of all dashboards
export interface DashboardConfig {
  slug: string;
  name: string;
  path: string;
  description?: string;
  // Permission key is optional - if not set, dashboard is visible to all
  permissionKey?: string;
}

export const DASHBOARD_LIST: DashboardConfig[] = [
  { 
    slug: "cph-sales", 
    name: "Dagsboard CPH Sales", 
    path: "/dashboards/cph-sales", 
    description: "Overblik over dagens salg, top performers og team performance",
    permissionKey: "menu_dashboard_cph_sales" 
  },
  { 
    slug: "fieldmarketing", 
    name: "Fieldmarketing", 
    path: "/dashboards/fieldmarketing", 
    description: "Field sales performance og kampagne resultater",
    permissionKey: "menu_dashboard_fieldmarketing" 
  },
  { 
    slug: "eesy-tm", 
    name: "Eesy TM", 
    path: "/dashboards/eesy-tm", 
    description: "Telemarketing overblik for Eesy",
    permissionKey: "menu_dashboard_eesy_tm" 
  },
  { 
    slug: "tdc-erhverv", 
    name: "TDC Erhverv", 
    path: "/dashboards/tdc-erhverv", 
    description: "TDC Erhverv klient-dashboard med salgsdata",
    permissionKey: "menu_dashboard_tdc_erhverv" 
  },
  { 
    slug: "relatel", 
    name: "Relatel", 
    path: "/dashboards/relatel", 
    description: "Relatel kampagne og salgs overblik",
    permissionKey: "menu_dashboard_relatel" 
  },
  { 
    slug: "mg-test", 
    name: "MG Test", 
    path: "/dashboards/mg-test", 
    description: "Test dashboard til udvikling",
    permissionKey: "menu_dashboard_mg_test" 
  },
  { 
    slug: "united", 
    name: "United", 
    path: "/dashboards/united", 
    description: "United team performance dashboard",
    permissionKey: "menu_dashboard_united" 
  },
  { 
    slug: "test", 
    name: "Test Dashboard", 
    path: "/dashboards/test", 
    description: "Test dashboard til udvikling og QA",
    permissionKey: "menu_dashboard_test" 
  },
  { 
    slug: "cs-top-20", 
    name: "CS Top 20", 
    path: "/dashboards/cs-top-20", 
    description: "Top 20 customer success oversigt",
    permissionKey: "menu_dashboard_cs_top_20" 
  },
];
