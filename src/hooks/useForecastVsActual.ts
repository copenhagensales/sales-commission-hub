import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { da } from "date-fns/locale";
import type { ForecastVsActual } from "@/types/forecast";

/**
 * Fetches actual sales for the past 4 months and compares with stored forecasts.
 * If no stored forecasts exist, shows actual sales only.
 */
export function useForecastVsActual(clientId: string) {
  return useQuery({
    queryKey: ["forecast-vs-actual", clientId],
    queryFn: async (): Promise<ForecastVsActual[]> => {
      const now = new Date();
      const results: ForecastVsActual[] = [];

      // Get campaign IDs for this client
      let campaignIds: string[] = [];
      if (clientId !== "all") {
        const { data: campaigns } = await supabase
          .from("client_campaigns")
          .select("id")
          .eq("client_id", clientId);
        campaignIds = (campaigns || []).map(c => c.id);
      }

      // Fetch stored forecasts for this client (past 4 months)
      const fourMonthsAgo = format(startOfMonth(subMonths(now, 4)), "yyyy-MM-dd");
      let forecastQuery = supabase
        .from("client_forecasts")
        .select("*")
        .gte("period_start", fourMonthsAgo)
        .order("period_start", { ascending: true });

      if (clientId !== "all") {
        forecastQuery = forecastQuery.eq("client_id", clientId);
      }
      const { data: storedForecasts } = await forecastQuery;

      // Build a map of period -> forecast
      const forecastMap = new Map<string, any>();
      (storedForecasts || []).forEach(f => {
        const key = f.period_start.substring(0, 7); // YYYY-MM
        forecastMap.set(key, f);
      });

      // For each of the past 4 months + current month, get actual sales
      for (let i = 4; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        const monthStartStr = format(monthStart, "yyyy-MM-dd");
        const monthEndStr = format(monthEnd, "yyyy-MM-dd");
        const monthKey = format(monthDate, "yyyy-MM");
        const periodLabel = format(monthDate, "MMM yyyy", { locale: da });

        // Get actual sales count (campaign-based, includes FM sales automatically)
        let actualSales = 0;

        if (clientId === "all") {
          const { count } = await supabase
            .from("sales")
            .select("id, sale_items!inner(quantity, products(counts_as_sale))", { count: "exact", head: false })
            .gte("sale_datetime", monthStartStr)
            .lte("sale_datetime", monthEndStr + "T23:59:59")
            .neq("validation_status", "rejected");

          actualSales = count || 0;
        } else if (campaignIds.length > 0) {
          // Paginate to avoid 1000-row default limit
          let offset = 0;
          const PAGE = 5000;
          while (true) {
            const { data: salesData } = await supabase
              .from("sales")
              .select("id, sale_items!inner(quantity, products(counts_as_sale))")
              .gte("sale_datetime", monthStartStr)
              .lte("sale_datetime", monthEndStr + "T23:59:59")
              .in("client_campaign_id", campaignIds)
              .neq("validation_status", "rejected")
              .range(offset, offset + PAGE - 1);

            const rows = salesData || [];
            rows.forEach((s: any) => {
              (s.sale_items || []).forEach((si: any) => {
                if (si.products?.counts_as_sale !== false) {
                  actualSales += si.quantity || 1;
                }
              });
            });
            if (rows.length < PAGE) break;
            offset += PAGE;
          }
        }

        const stored = forecastMap.get(monthKey);
        const forecastExpected = stored?.forecast_sales_expected || 0;
        const forecastLow = stored?.forecast_sales_low || 0;
        const forecastHigh = stored?.forecast_sales_high || 0;

        // Don't show actual for future months
        const isFuture = i === 0 && now.getDate() < 5;
        const actual = isFuture ? 0 : actualSales;

        const accuracy = forecastExpected > 0 && actual > 0
          ? Math.round(Math.min(100, (1 - Math.abs(actual - forecastExpected) / forecastExpected) * 100))
          : 0;

        results.push({
          period: periodLabel,
          forecastLow,
          forecastExpected,
          forecastHigh,
          actual,
          accuracy,
        });
      }

      return results.filter(r => r.actual > 0 || r.forecastExpected > 0);
    },
    staleTime: 5 * 60 * 1000,
  });
}
