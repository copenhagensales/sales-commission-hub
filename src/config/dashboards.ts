// Dashboard configuration - centralized list of all dashboards
export interface DashboardConfig {
  slug: string;
  name: string;
  path: string;
  // Permission key is optional - if not set, dashboard is visible to all
  permissionKey?: string;
}

export const DASHBOARD_LIST: DashboardConfig[] = [
  { slug: "cph-sales", name: "Dagsboard CPH Sales", path: "/dashboards/cph-sales" },
  { slug: "fieldmarketing", name: "Fieldmarketing", path: "/dashboards/fieldmarketing" },
  { slug: "team", name: "Team Dashboard", path: "/dashboards/team" },
  { slug: "relatel", name: "Relatel", path: "/dashboards/relatel" },
  { slug: "tryg", name: "Tryg", path: "/dashboards/tryg" },
  { slug: "tdc-erhverv", name: "TDC Erhverv", path: "/dashboards/tdc-erhverv" },
  { slug: "mg-test", name: "Test Dashboard", path: "/dashboards/mg-test" },
];
