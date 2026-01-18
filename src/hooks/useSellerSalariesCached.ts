import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface SellerData {
  id: string;
  name: string;
  team: string;
  teamId: string | null;
  sales: number;
  commission: number;
}

interface UseSellerSalariesCachedResult {
  sellerData: SellerData[];
  isLoading: boolean;
  lastUpdated: Date | null;
}

/**
 * Hook to fetch seller salaries using the pre-computed KPI cache.
 * This replaces the heavy on-the-fly database queries with simple cache lookups.
 * 
 * Uses kpi_cached_values with scope_type='employee' and period_type='payroll_period'
 */
export function useSellerSalariesCached(selectedTeam?: string | null): UseSellerSalariesCachedResult {
  // Query 1: Get all active non-staff employees with team info
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["seller-employees-cached"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("employee_master_data") as any)
        .select(`
          id, 
          first_name, 
          last_name,
          team_members!left(
            team_id,
            teams!left(id, name)
          )
        `)
        .eq("is_active", true)
        .eq("is_staff_employee", false);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 60000, // 1 minute - matches KPI cache refresh
  });

  // Query 2: Get cached KPI values for all employees (payroll_period)
  const { data: cachedKpis, isLoading: kpisLoading } = useQuery({
    queryKey: ["seller-kpis-payroll-cached"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kpi_cached_values")
        .select("kpi_slug, scope_id, value, calculated_at")
        .eq("scope_type", "employee")
        .eq("period_type", "payroll_period")
        .in("kpi_slug", ["sales_count", "total_commission"]);
      
      if (error) throw error;
      return data || [];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Combine employees with their cached KPI values
  const { sellerData, lastUpdated } = useMemo(() => {
    if (!employees) {
      return { sellerData: [], lastUpdated: null };
    }

    // Build a map of employee_id -> { sales_count, total_commission }
    const kpiMap: Record<string, { sales: number; commission: number }> = {};
    let latestCalculatedAt: Date | null = null;

    for (const kpi of cachedKpis || []) {
      if (!kpi.scope_id) continue;
      
      if (!kpiMap[kpi.scope_id]) {
        kpiMap[kpi.scope_id] = { sales: 0, commission: 0 };
      }

      if (kpi.kpi_slug === "sales_count") {
        kpiMap[kpi.scope_id].sales = kpi.value || 0;
      } else if (kpi.kpi_slug === "total_commission") {
        kpiMap[kpi.scope_id].commission = kpi.value || 0;
      }

      // Track the latest calculated_at timestamp
      if (kpi.calculated_at) {
        const calcDate = new Date(kpi.calculated_at);
        if (!latestCalculatedAt || calcDate > latestCalculatedAt) {
          latestCalculatedAt = calcDate;
        }
      }
    }

    // Filter by team if needed
    let filteredEmployees = employees;
    if (selectedTeam && selectedTeam !== "all") {
      filteredEmployees = employees.filter((e: any) =>
        e.team_members?.some((tm: any) => tm.team_id === selectedTeam)
      );
    }

    // Map employees to seller data with cached KPIs
    const sellers: SellerData[] = filteredEmployees.map((emp: any) => {
      const teamMember = emp.team_members?.[0];
      const teamData = teamMember?.teams;
      const kpis = kpiMap[emp.id] || { sales: 0, commission: 0 };

      return {
        id: emp.id,
        name: `${emp.first_name} ${emp.last_name}`,
        team: teamData?.name || "Ikke tildelt",
        teamId: teamMember?.team_id || null,
        sales: kpis.sales,
        commission: kpis.commission,
      };
    });

    // Sort by commission descending
    sellers.sort((a, b) => b.commission - a.commission);

    return { sellerData: sellers, lastUpdated: latestCalculatedAt };
  }, [employees, cachedKpis, selectedTeam]);

  return {
    sellerData,
    isLoading: employeesLoading || kpisLoading,
    lastUpdated,
  };
}
