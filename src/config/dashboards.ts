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
  { slug: "eesy-tm", name: "Eesy TM", path: "/dashboards/eesy-tm" },
  { slug: "tdc-erhverv", name: "TDC Erhverv", path: "/dashboards/tdc-erhverv" },
  { slug: "relatel", name: "Relatel", path: "/dashboards/relatel" },
  { slug: "tryg", name: "Tryg", path: "/dashboards/tryg" },
  { slug: "ase", name: "ASE", path: "/dashboards/ase" },
  { slug: "mg-test", name: "MG Test", path: "/dashboards/mg-test" },
  { slug: "united", name: "United", path: "/dashboards/united" },
  { slug: "test", name: "Test Dashboard", path: "/dashboards/test" },
  { slug: "km-test", name: "TDC Erhverv km test", path: "/km-test" },
];
