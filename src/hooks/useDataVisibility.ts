import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCanAccess } from "./useSystemRoles";

export type DataScope = 
  | "leaderboard_ranking"
  | "sales_count_others"
  | "h2h_stats"
  | "commission_details"
  | "salary_breakdown"
  | "employee_performance";

export type Visibility = "all" | "team" | "self" | "none";

export interface DataVisibilityRule {
  id: string;
  role_key: string;
  data_scope: string;
  visibility: Visibility;
  context: string | null;
  description: string | null;
}

export function useDataVisibilityRules() {
  return useQuery({
    queryKey: ["data-visibility-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_visibility_rules")
        .select("*")
        .order("role_key")
        .order("data_scope");
      if (error) throw error;
      return data as DataVisibilityRule[];
    },
  });
}

export function useDataVisibility() {
  const { data: rules = [] } = useDataVisibilityRules();
  const access = useCanAccess();
  
  // Determine user's effective role
  const getUserRole = (): string => {
    if (access.isOwner) return "ejer";
    if (access.isTeamleder) return "teamleder";
    if (access.isRekruttering) return "rekruttering";
    if (access.isSome) return "some";
    return "medarbejder";
  };
  
  const userRole = getUserRole();
  
  // Get visibility for a specific scope
  const getVisibility = (scope: DataScope, context?: string): Visibility => {
    const rule = rules.find(
      r => r.role_key === userRole && 
           r.data_scope === scope && 
           (context ? r.context === context : !r.context)
    );
    return (rule?.visibility as Visibility) || "none";
  };
  
  // Check if user can view data for a scope
  // targetEmployeeId is the employee whose data we want to view
  // currentEmployeeId is the logged-in user's employee id
  const canViewScope = (
    scope: DataScope, 
    targetEmployeeId?: string, 
    currentEmployeeId?: string,
    isInUserTeam?: boolean
  ): boolean => {
    const visibility = getVisibility(scope);
    
    switch (visibility) {
      case "all":
        return true;
      case "team":
        // If no target specified, user can view team data
        if (!targetEmployeeId) return true;
        // Check if target is in user's team
        return isInUserTeam ?? false;
      case "self":
        // If no target specified, user can view own data
        if (!targetEmployeeId) return true;
        // Check if viewing own data
        return targetEmployeeId === currentEmployeeId;
      case "none":
        return false;
      default:
        return false;
    }
  };
  
  // Get label for visibility level
  const getVisibilityLabel = (visibility: Visibility): string => {
    switch (visibility) {
      case "all": return "Alle";
      case "team": return "Team";
      case "self": return "Kun egen";
      case "none": return "Ingen adgang";
      default: return "Ukendt";
    }
  };
  
  // Get scope label
  const getScopeLabel = (scope: string): string => {
    const labels: Record<string, string> = {
      leaderboard_ranking: "Leaderboards",
      sales_count_others: "Andres salgsantal",
      h2h_stats: "Head-to-Head statistik",
      commission_details: "Provisionsdetaljer",
      salary_breakdown: "Lønspecifikation",
      employee_performance: "Performance-rapporter",
    };
    return labels[scope] || scope;
  };
  
  return {
    rules,
    userRole,
    getVisibility,
    canViewScope,
    getVisibilityLabel,
    getScopeLabel,
  };
}
