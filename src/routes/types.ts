import React from "react";

export type Access = "public" | "auth" | "protected" | "role";

export interface RouteConfig {
  path: string;
  component: React.ComponentType<any> | React.LazyExoticComponent<React.ComponentType<any>>;
  access: Access;
  requiredRole?: "ejer" | "rekruttering" | "teamleder";
  requireTeamlederOrAbove?: boolean;
  positionPermission?: string; // Position-based permission key to check (e.g., "menu_mg_test")
  children?: RouteConfig[];
}
