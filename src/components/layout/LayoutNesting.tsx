import { createContext, useContext } from "react";

/** Sand, når vi allerede er inde i MainLayout/DashboardLayout (fx en side brugt som fane i en samleside). */
export const LayoutNestingContext = createContext(false);

export function useIsInsideLayout(): boolean {
  return useContext(LayoutNestingContext);
}
