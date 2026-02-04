import { startOfMonth, startOfWeek, endOfWeek, format, startOfDay } from "date-fns";
import { useSalesAggregatesExtended, type SalesAggregatesExtended, type AggregateData } from "./useSalesAggregatesExtended";
import { getClientId } from "@/utils/clientIds";

interface DashboardAggregates {
  totals: AggregateData;
  byEmployee: SalesAggregatesExtended['byEmployee'];
  byDate: SalesAggregatesExtended['byDate'];
  topPerformer: SalesAggregatesExtended['topPerformer'];
  todayData: AggregateData;
  weekData: AggregateData;
  monthData: AggregateData;
  isLoading: boolean;
  isFromRPC: boolean;
}

/**
 * Get client ID from dashboard slug
 */
function getClientIdFromSlug(slug: string | null): string | undefined {
  if (!slug) return undefined;

  // Try direct lookup first
  const directId = getClientId(slug);
  if (directId) return directId;

  // Map dashboard slugs to client names
  const slugToClientMap: Record<string, string> = {
    "tdc-erhverv": "TDC Erhverv",
    "relatel": "Relatel",
    "codan": "CODAN",
    "fieldmarketing": "Eesy FM",
    "eesy-tm": "Eesy TM",
    "eesy": "Eesy",
    "tryg": "Tryg",
    "yousee": "Yousee",
    "ase": "Ase",
    "aka": "AKA",
    "finansforbundet": "Finansforbundet",
    "business-dk": "Business DK",
  };

  const clientName = slugToClientMap[slug];
  return clientName ? getClientId(clientName) : undefined;
}

/**
 * Wrapper hook for dashboard/TV celebration data.
 * Provides pre-computed today/week/month breakdowns.
 */
export function useDashboardAggregates(
  dashboardSlug: string | null,
  enabled: boolean = true
): DashboardAggregates {
  const today = startOfDay(new Date());
  const monthStart = startOfMonth(today);
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  
  const clientId = getClientIdFromSlug(dashboardSlug);

  const { data: aggregates, isLoading } = useSalesAggregatesExtended({
    periodStart: monthStart,
    periodEnd: today,
    clientId,
    groupBy: ['date', 'employee'],
    enabled: enabled && !!dashboardSlug,
  });

  // Calculate period-specific totals from date aggregates
  const todayStr = format(today, "yyyy-MM-dd");
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const todayData: AggregateData = { sales: 0, commission: 0, revenue: 0 };
  const weekData: AggregateData = { sales: 0, commission: 0, revenue: 0 };
  const monthData: AggregateData = { sales: 0, commission: 0, revenue: 0 };

  if (aggregates?.byDate) {
    for (const [dateStr, data] of Object.entries(aggregates.byDate)) {
      // Month (all data)
      monthData.sales += data.sales;
      monthData.commission += data.commission;
      monthData.revenue += data.revenue;

      // Today
      if (dateStr === todayStr) {
        todayData.sales = data.sales;
        todayData.commission = data.commission;
        todayData.revenue = data.revenue;
      }

      // Week
      if (dateStr >= weekStartStr) {
        weekData.sales += data.sales;
        weekData.commission += data.commission;
        weekData.revenue += data.revenue;
      }
    }
  }

  return {
    totals: aggregates?.totals || { sales: 0, commission: 0, revenue: 0 },
    byEmployee: aggregates?.byEmployee || {},
    byDate: aggregates?.byDate || {},
    topPerformer: aggregates?.topPerformer || null,
    todayData,
    weekData,
    monthData,
    isLoading,
    isFromRPC: aggregates?.isFromRPC || false,
  };
}
