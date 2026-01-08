import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfDay, startOfMonth, startOfWeek } from "date-fns";

export interface CelebrationTriggerData {
  employeeName: string | null;
  salesCount: number;
  commission: number;
  metricValue: number;
  // Specific metrics
  salesToday: number;
  salesMonth: number;
  salesWeek: number;
  totalSales: number;
  commissionToday: number;
  commissionMonth: number;
  goalProgress: number;
  goalTarget: number;
  goalRemaining: number;
}

interface UseCelebrationDataParams {
  dashboardSlug: string | null;
  metric: string;
  enabled?: boolean;
}

/**
 * Hook for fetching celebration trigger data from a specific dashboard
 */
export function useCelebrationData({
  dashboardSlug,
  metric,
  enabled = true,
}: UseCelebrationDataParams) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const monthStart = format(startOfMonth(today), "yyyy-MM-dd");
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["celebration-data", dashboardSlug, metric, todayStr],
    queryFn: async (): Promise<CelebrationTriggerData> => {
      // Get team/client configuration based on dashboard slug
      const dashboardConfig = getDashboardConfig(dashboardSlug);
      
      // Build query with client filter via campaign relation if needed
      const selectFields = dashboardConfig.clientId
        ? "id, agent_email, sale_datetime, campaign_id, client_campaigns!inner(client_id), sale_items(quantity, mapped_commission, products(counts_as_sale))"
        : "id, agent_email, sale_datetime, sale_items(quantity, mapped_commission, products(counts_as_sale))";

      // Fetch sales data for today
      let salesTodayQuery = supabase
        .from("sales")
        .select(selectFields)
        .gte("sale_datetime", `${todayStr}T00:00:00`)
        .lte("sale_datetime", `${todayStr}T23:59:59`);

      // Fetch sales data for month
      let salesMonthQuery = supabase
        .from("sales")
        .select(selectFields)
        .gte("sale_datetime", `${monthStart}T00:00:00`)
        .lte("sale_datetime", `${todayStr}T23:59:59`);

      // Fetch sales data for week
      let salesWeekQuery = supabase
        .from("sales")
        .select(selectFields)
        .gte("sale_datetime", `${weekStart}T00:00:00`)
        .lte("sale_datetime", `${todayStr}T23:59:59`);

      // Apply client filter if dashboard has a specific client
      if (dashboardConfig.clientId) {
        salesTodayQuery = salesTodayQuery.eq("client_campaigns.client_id", dashboardConfig.clientId);
        salesMonthQuery = salesMonthQuery.eq("client_campaigns.client_id", dashboardConfig.clientId);
        salesWeekQuery = salesWeekQuery.eq("client_campaigns.client_id", dashboardConfig.clientId);
      }

      const [todayRes, monthRes, weekRes] = await Promise.all([
        salesTodayQuery,
        salesMonthQuery,
        salesWeekQuery,
      ]);

      // Calculate totals
      const calculateSalesAndCommission = (sales: any[]) => {
        let totalSales = 0;
        let totalCommission = 0;
        const employeeSales: Record<string, { name: string; sales: number; commission: number }> = {};

        sales?.forEach((sale) => {
          const agentEmail = sale.agent_email || "Unknown";
          if (!employeeSales[agentEmail]) {
            employeeSales[agentEmail] = { name: agentEmail.split("@")[0], sales: 0, commission: 0 };
          }
          
          sale.sale_items?.forEach((item: any) => {
            const countsAsSale = item.products?.counts_as_sale !== false;
            if (countsAsSale) {
              totalSales += Number(item.quantity) || 1;
              employeeSales[agentEmail].sales += Number(item.quantity) || 1;
            }
            totalCommission += Number(item.mapped_commission) || 0;
            employeeSales[agentEmail].commission += Number(item.mapped_commission) || 0;
          });
        });

        return { totalSales, totalCommission, employeeSales };
      };

      const todayData = calculateSalesAndCommission(todayRes.data || []);
      const monthData = calculateSalesAndCommission(monthRes.data || []);
      const weekData = calculateSalesAndCommission(weekRes.data || []);

      // Find top performer today for employee name
      let topEmployeeName: string | null = null;
      let topSales = 0;
      Object.entries(todayData.employeeSales).forEach(([_, empData]) => {
        if (empData.sales > topSales) {
          topSales = empData.sales;
          topEmployeeName = empData.name;
        }
      });

      // Fetch goal data if relevant
      let goalProgress = 0;
      let goalTarget = 0;
      let goalRemaining = 0;

      if (dashboardConfig.clientId && (metric.includes("goal") || dashboardSlug?.includes("goals"))) {
        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();
        
        const { data: goalData } = await supabase
          .from("client_monthly_goals")
          .select("sales_target")
          .eq("client_id", dashboardConfig.clientId)
          .eq("month", currentMonth)
          .eq("year", currentYear)
          .single();

        if (goalData) {
          goalTarget = goalData.sales_target || 0;
          goalRemaining = Math.max(0, goalTarget - monthData.totalCommission);
          goalProgress = goalTarget > 0 ? Math.round((monthData.totalCommission / goalTarget) * 100) : 0;
        }
      }

      // Get the specific metric value
      const getMetricValue = (metricKey: string): number => {
        switch (metricKey) {
          case "sales_today": return todayData.totalSales;
          case "sales_month": return monthData.totalSales;
          case "sales_week": return weekData.totalSales;
          case "total_sales": return monthData.totalSales;
          case "commission_today": return todayData.totalCommission;
          case "commission_month": return monthData.totalCommission;
          case "goal_progress": return goalProgress;
          case "goal_target": return goalTarget;
          case "goal_remaining": return goalRemaining;
          default: return todayData.totalSales;
        }
      };

      return {
        employeeName: topEmployeeName,
        salesCount: todayData.totalSales,
        commission: todayData.totalCommission,
        metricValue: getMetricValue(metric),
        salesToday: todayData.totalSales,
        salesMonth: monthData.totalSales,
        salesWeek: weekData.totalSales,
        totalSales: monthData.totalSales,
        commissionToday: todayData.totalCommission,
        commissionMonth: monthData.totalCommission,
        goalProgress,
        goalTarget,
        goalRemaining,
      };
    },
    enabled: enabled && !!dashboardSlug,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 15000,
  });

  return {
    data,
    isLoading,
    refetch,
  };
}

/**
 * Get dashboard configuration (client ID, team ID) based on slug
 */
function getDashboardConfig(slug: string | null): { clientId?: string; teamId?: string } {
  if (!slug) return {};
  
  // Map dashboard slugs to their actual client IDs from database
  const clientIdMap: Record<string, string> = {
    "tdc-erhverv": "20744525-7466-4b2c-afa7-6ee09a9112b0",
    "tdc-erhverv-goals": "20744525-7466-4b2c-afa7-6ee09a9112b0",
    "tryg": "516a3f67-ea6d-4ef0-929d-e3224cc16e22",
    "relatel": "0ff8476d-16d8-4150-aee9-48ac90ec962d",
    "ase": "53eb9c4a-91b0-44a9-9ee7-a87d87cc3e0f",
    "codan": "789f7e51-d3c8-42c6-b461-b45ea20d1e1f",
    "fieldmarketing": "9a92ea4c-6404-4b58-be08-065e7552d552", // Eesy FM
    "fieldmarketing-goals": "9a92ea4c-6404-4b58-be08-065e7552d552",
    "eesy-tm": "81993a7b-ff24-46b8-8ffb-37a83138ddba",
  };

  const clientId = clientIdMap[slug];
  return clientId ? { clientId } : {};
}

/**
 * Replace variables in celebration text with actual values
 */
export function replaceCelebrationVariables(
  text: string,
  data: CelebrationTriggerData | undefined
): string {
  if (!text || !data) return text || "";

  const formatNumber = (num: number) => num.toLocaleString("da-DK");
  const formatCurrency = (num: number) => `${num.toLocaleString("da-DK")} kr`;

  return text
    .replace(/{employee_name}/g, data.employeeName || "Medarbejder")
    .replace(/{sales_count}/g, formatNumber(data.salesCount))
    .replace(/{commission}/g, formatCurrency(data.commission))
    .replace(/{metric_value}/g, formatNumber(data.metricValue))
    .replace(/{sales_today}/g, formatNumber(data.salesToday))
    .replace(/{sales_month}/g, formatNumber(data.salesMonth))
    .replace(/{sales_week}/g, formatNumber(data.salesWeek))
    .replace(/{total_sales}/g, formatNumber(data.totalSales))
    .replace(/{commission_today}/g, formatCurrency(data.commissionToday))
    .replace(/{commission_month}/g, formatCurrency(data.commissionMonth))
    .replace(/{goal_progress}/g, `${data.goalProgress}%`)
    .replace(/{goal_target}/g, formatCurrency(data.goalTarget))
    .replace(/{goal_remaining}/g, formatCurrency(data.goalRemaining));
}
