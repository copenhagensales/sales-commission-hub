import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { subMonths, subWeeks, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, differenceInDays } from "date-fns";

interface ClientPeriodComparison {
  clientId: string;
  previousRevenue: number;
  previousSales: number;
}

interface UseClientPeriodComparisonResult {
  data: Record<string, ClientPeriodComparison> | null;
  isLoading: boolean;
  previousPeriodLabel: string;
}

type PeriodMode = "payroll" | "month" | "week" | "day" | "custom";

/**
 * Calculate the previous period dates based on current period mode
 */
function getPreviousPeriodDates(
  periodStart: Date,
  periodEnd: Date,
  periodMode: PeriodMode
): { prevStart: Date; prevEnd: Date; label: string } {
  const periodDays = differenceInDays(periodEnd, periodStart) + 1;
  
  switch (periodMode) {
    case "month": {
      const prevMonth = subMonths(periodStart, 1);
      return {
        prevStart: startOfMonth(prevMonth),
        prevEnd: endOfMonth(prevMonth),
        label: "forrige md.",
      };
    }
    case "week": {
      const prevWeek = subWeeks(periodStart, 1);
      return {
        prevStart: startOfWeek(prevWeek, { weekStartsOn: 1 }),
        prevEnd: endOfWeek(prevWeek, { weekStartsOn: 1 }),
        label: "forrige uge",
      };
    }
    case "day": {
      const prevDay = subDays(periodStart, 1);
      return {
        prevStart: prevDay,
        prevEnd: prevDay,
        label: "i går",
      };
    }
    case "payroll": {
      const prevStart = subMonths(periodStart, 1);
      const prevEnd = subMonths(periodEnd, 1);
      return {
        prevStart,
        prevEnd,
        label: "forrige løn",
      };
    }
    case "custom":
    default: {
      const prevEnd = subDays(periodStart, 1);
      const prevStart = subDays(prevEnd, periodDays - 1);
      return {
        prevStart,
        prevEnd,
        label: `forrige ${periodDays}d`,
      };
    }
  }
}

/**
 * Hook to fetch comparison data from the previous period for Client DB
 */
export function useClientPeriodComparison(
  periodStart: Date,
  periodEnd: Date,
  periodMode: PeriodMode
): UseClientPeriodComparisonResult {
  const { prevStart, prevEnd, label } = getPreviousPeriodDates(
    periodStart,
    periodEnd,
    periodMode
  );

  const { data, isLoading } = useQuery({
    queryKey: [
      "client-period-comparison",
      prevStart.toISOString(),
      prevEnd.toISOString(),
    ],
    queryFn: async () => {
      const sales = await fetchAllRows<any>(
        "sales",
        `id, client_campaign_id,
            client_campaigns!inner(client_id),
            sale_items(mapped_revenue, products(counts_as_sale))`,
        (q) => q.gte("sale_datetime", prevStart.toISOString())
          .lte("sale_datetime", prevEnd.toISOString()),
        { orderBy: "sale_datetime", ascending: false }
      );

      if (!sales || sales.length === 0) {
        return {};
      }

      const clientData: Record<string, ClientPeriodComparison> = {};
      
      for (const sale of sales || []) {
        const clientId = (sale.client_campaigns as any)?.client_id;
        if (!clientId) continue;
        
        if (!clientData[clientId]) {
          clientData[clientId] = {
            clientId,
            previousRevenue: 0,
            previousSales: 0,
          };
        }
        
        // Sum revenue from sale items
        let saleRevenue = 0;
        let countsAsSale = false;
        for (const item of (sale.sale_items as any[]) || []) {
          saleRevenue += Number(item.mapped_revenue) || 0;
          if ((item.products as any)?.counts_as_sale) {
            countsAsSale = true;
          }
        }
        
        clientData[clientId].previousRevenue += saleRevenue;
        if (countsAsSale) {
          clientData[clientId].previousSales += 1;
        }
      }
      
      return clientData;
    },
    staleTime: 60 * 1000,
  });

  return {
    data: data || null,
    isLoading,
    previousPeriodLabel: label,
  };
}
