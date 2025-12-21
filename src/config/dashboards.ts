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
  { slug: "eesy-tm", name: "Eesy TM", path: "/dashboards/eesy-tm" },
  { slug: "tdc-erhverv", name: "TDC Erhverv", path: "/dashboards/tdc-erhverv" },
  { slug: "relatel", name: "Relatel", path: "/dashboards/relatel" },
  { slug: "united", name: "United", path: "/dashboards/united" },
];
