import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { formatNumber } from "@/lib/calculations";
import { useDashboardAggregates } from "./useDashboardAggregates";

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
 * Hook for fetching celebration trigger data from a specific dashboard.
 * Now uses the central useDashboardAggregates hook for consistent data.
 */
export function useCelebrationData({
  dashboardSlug,
  metric,
  enabled = true,
}: UseCelebrationDataParams) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  // Use the central dashboard aggregates hook
  const {
    todayData,
    weekData,
    monthData,
    topPerformer,
    isLoading,
  } = useDashboardAggregates(dashboardSlug, enabled);

  // Fetch goal data if relevant
  const { data: goalData } = useQuery({
    queryKey: ["celebration-goal", dashboardSlug, metric, todayStr],
    queryFn: async () => {
      const dashboardConfig = getDashboardConfig(dashboardSlug);
      
      if (!dashboardConfig.clientId || (!metric.includes("goal") && !dashboardSlug?.includes("goals"))) {
        return { target: 0, progress: 0, remaining: 0 };
      }

      const currentMonth = today.getMonth() + 1;
      const currentYear = today.getFullYear();
      
      const { data } = await supabase
        .from("client_monthly_goals")
        .select("sales_target")
        .eq("client_id", dashboardConfig.clientId)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .maybeSingle();

      if (data) {
        const target = data.sales_target || 0;
        const remaining = Math.max(0, target - monthData.commission);
        const progress = target > 0 ? Math.round((monthData.commission / target) * 100) : 0;
        return { target, progress, remaining };
      }
      
      return { target: 0, progress: 0, remaining: 0 };
    },
    enabled: enabled && !!dashboardSlug && (metric.includes("goal") || dashboardSlug?.includes("goals")),
  });

  // Get the specific metric value
  const getMetricValue = (metricKey: string): number => {
    switch (metricKey) {
      case "sales_today": return todayData.sales;
      case "sales_month": return monthData.sales;
      case "sales_week": return weekData.sales;
      case "total_sales": return monthData.sales;
      case "commission_today": return todayData.commission;
      case "commission_month": return monthData.commission;
      case "goal_progress": return goalData?.progress || 0;
      case "goal_target": return goalData?.target || 0;
      case "goal_remaining": return goalData?.remaining || 0;
      default: return todayData.sales;
    }
  };

  const data: CelebrationTriggerData = {
    employeeName: topPerformer?.name || null,
    salesCount: topPerformer?.data.sales ?? todayData.sales,
    commission: todayData.commission,
    metricValue: getMetricValue(metric),
    salesToday: todayData.sales,
    salesMonth: monthData.sales,
    salesWeek: weekData.sales,
    totalSales: monthData.sales,
    commissionToday: todayData.commission,
    commissionMonth: monthData.commission,
    goalProgress: goalData?.progress || 0,
    goalTarget: goalData?.target || 0,
    goalRemaining: goalData?.remaining || 0,
  };

  return {
    data: enabled && dashboardSlug ? data : undefined,
    isLoading,
    refetch: () => {}, // Handled by react-query internally
  };
}

function replaceVar(text: string, key: string, value: string): string {
  const pattern = new RegExp(String.raw`\{{1,2}\s*${key}\s*\}{1,2}`, "gi");
  return text.replace(pattern, value);
}

/**
 * Replace variables in celebration text with actual values
 */
export function replaceCelebrationVariables(
  text: string,
  data: CelebrationTriggerData | undefined
): string {
  if (!text) return "";
  if (!data) return text;

  const formatCurrencyLocal = (num: number) => `${formatNumber(num)} kr`;

  const replacements: Record<string, string> = {
    employee_name: data.employeeName || "Medarbejder",
    sales_count: formatNumber(data.salesCount),
    commission: formatCurrencyLocal(data.commission),
    metric_value: formatNumber(data.metricValue),
    sales_today: formatNumber(data.salesToday),
    sales_month: formatNumber(data.salesMonth),
    sales_week: formatNumber(data.salesWeek),
    total_sales: formatNumber(data.totalSales),
    commission_today: formatCurrencyLocal(data.commissionToday),
    commission_month: formatCurrencyLocal(data.commissionMonth),
    goal_progress: `${data.goalProgress}%`,
    goal_target: formatCurrencyLocal(data.goalTarget),
    goal_remaining: formatCurrencyLocal(data.goalRemaining),
  };

  let output = text;
  Object.entries(replacements).forEach(([key, value]) => {
    output = replaceVar(output, key, value);
  });

  return output;
}

/**
 * Get dashboard configuration (client ID, team ID) based on slug
 */
function getDashboardConfig(slug: string | null): { clientId?: string; teamId?: string } {
  if (!slug) return {};
  
  // Map dashboard slugs to their actual client IDs from database
  const clientIdMap: Record<string, string> = {
    "tdc-erhverv": "20744525-7466-4b2c-afa7-6ee09a9112b0",
    "relatel": "0ff8476d-16d8-4150-aee9-48ac90ec962d",
    "codan": "789f7e51-d3c8-42c6-b461-b45ea20d1e1f",
    "fieldmarketing": "9a92ea4c-6404-4b58-be08-065e7552d552",
    "eesy-tm": "81993a7b-ff24-46b8-8ffb-37a83138ddba",
  };

  const clientId = clientIdMap[slug];
  return clientId ? { clientId } : {};
}
