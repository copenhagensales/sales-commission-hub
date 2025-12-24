import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears } from "date-fns";

interface DateRange {
  start: Date;
  end: Date;
}

interface KpiDataResult {
  value: string;
  loading: boolean;
  trend?: number;
}

interface FetchParams {
  kpiTypeId: string;
  timePeriodId: string;
  customFromDate?: Date;
  clientId?: string;
  teamId?: string;
}

const getDateRange = (timePeriodId: string, customFromDate?: Date): DateRange => {
  const now = new Date();
  
  switch (timePeriodId) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday":
      const yesterday = subDays(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    case "this-week":
      return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
    case "last-week":
      const lastWeek = subWeeks(now, 1);
      return { start: startOfWeek(lastWeek, { weekStartsOn: 1 }), end: endOfWeek(lastWeek, { weekStartsOn: 1 }) };
    case "this-month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last-month":
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    case "this-year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "last-year":
      const lastYear = subYears(now, 1);
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
    case "custom-from":
      return { start: customFromDate || startOfMonth(now), end: now };
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
};

const formatValue = (value: number, kpiTypeId: string): string => {
  if (kpiTypeId.includes("revenue") || kpiTypeId.includes("order-value") || kpiTypeId === "commission") {
    return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(value);
  }
  if (kpiTypeId.includes("rate") || kpiTypeId.includes("conversion")) {
    return `${value.toFixed(1)}%`;
  }
  if (kpiTypeId.includes("duration") || kpiTypeId.includes("time") || kpiTypeId.includes("handle")) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  return new Intl.NumberFormat("da-DK").format(value);
};

export const useDashboardKpiData = () => {
  const [cache, setCache] = useState<Map<string, KpiDataResult>>(new Map());

  const getCacheKey = (params: FetchParams): string => {
    return `${params.kpiTypeId}-${params.timePeriodId}-${params.clientId || ""}-${params.teamId || ""}-${params.customFromDate?.toISOString() || ""}`;
  };

  const fetchKpiData = useCallback(async (params: FetchParams): Promise<KpiDataResult> => {
    const { kpiTypeId, timePeriodId, customFromDate, clientId, teamId } = params;
    const { start, end } = getDateRange(timePeriodId, customFromDate);
    
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    try {
      let value = 0;

      // Handle different KPI types
      // Helper: Get client IDs for team filter
      const getClientIdsForTeam = async (teamId: string): Promise<string[]> => {
        const { data: teamClients } = await supabase
          .from("team_clients")
          .select("client_id")
          .eq("team_id", teamId);
        return (teamClients || []).map(tc => tc.client_id);
      };

      switch (kpiTypeId) {
        case "sales-count": {
          // Query telesales via sale_items (same logic as TeamOverview)
          let telesalesCount = 0;
          let fieldmarketingCount = 0;
          
          // Get client IDs based on team or client filter
          let targetClientIds: string[] = [];
          if (teamId) {
            targetClientIds = await getClientIdsForTeam(teamId);
          } else if (clientId) {
            targetClientIds = [clientId];
          }
          
          // Get campaign IDs for the target clients
          let campaignIds: string[] = [];
          if (targetClientIds.length > 0) {
            const { data: campaigns } = await supabase
              .from("client_campaigns")
              .select("id")
              .in("client_id", targetClientIds);
            campaignIds = (campaigns || []).map(c => c.id);
          } else {
            const { data: allCampaigns } = await supabase
              .from("client_campaigns")
              .select("id");
            campaignIds = (allCampaigns || []).map(c => c.id);
          }
          
          if (campaignIds.length > 0) {
            // Fetch sales with sale_items to count properly (like TeamOverview)
            const { data: salesData, error } = await supabase
              .from("sales")
              .select(`
                id,
                sale_items (
                  quantity,
                  products (
                    counts_as_sale
                  )
                )
              `)
              .in("client_campaign_id", campaignIds)
              .gte("sale_datetime", startISO)
              .lte("sale_datetime", endISO);
            
            if (error) throw error;
            
            // Count sales from sale_items where counts_as_sale !== false
            (salesData || []).forEach((sale: any) => {
              (sale.sale_items || []).forEach((item: any) => {
                const countsAsSale = item.products?.counts_as_sale !== false;
                if (countsAsSale) {
                  telesalesCount += Number(item.quantity) || 1;
                }
              });
            });
          }
          
          // Also count fieldmarketing_sales
          if (targetClientIds.length > 0) {
            const { count: fmCount, error: fmError } = await supabase
              .from("fieldmarketing_sales")
              .select("id", { count: "exact", head: true })
              .gte("registered_at", startISO)
              .lte("registered_at", endISO)
              .in("client_id", targetClientIds);
            if (fmError) throw fmError;
            fieldmarketingCount = fmCount || 0;
          } else {
            const { count: fmCount, error: fmError } = await supabase
              .from("fieldmarketing_sales")
              .select("id", { count: "exact", head: true })
              .gte("registered_at", startISO)
              .lte("registered_at", endISO);
            if (fmError) throw fmError;
            fieldmarketingCount = fmCount || 0;
          }
          
          value = telesalesCount + fieldmarketingCount;
          break;
        }

        case "sales-revenue": {
          let query = supabase
            .from("sale_items")
            .select(`
              quantity,
              product_id,
              products!inner(revenue_dkk),
              sales!inner(sale_datetime, client_campaign_id)
            `)
            .gte("sales.sale_datetime", startISO)
            .lte("sales.sale_datetime", endISO);
          
          if (clientId) {
            const { data: campaigns } = await supabase
              .from("client_campaigns")
              .select("id")
              .eq("client_id", clientId);
            
            if (campaigns && campaigns.length > 0) {
              const campaignIds = campaigns.map(c => c.id);
              query = query.in("sales.client_campaign_id", campaignIds);
            }
          }
          
          const { data, error } = await query;
          if (error) throw error;
          
          value = data?.reduce((sum, item) => {
            const revenue = (item.products as any)?.revenue_dkk || 0;
            return sum + (revenue * (item.quantity || 1));
          }, 0) || 0;
          break;
        }

        case "avg-order-value": {
          let query = supabase
            .from("sale_items")
            .select(`
              quantity,
              product_id,
              products!inner(revenue_dkk),
              sales!inner(sale_datetime, id)
            `)
            .gte("sales.sale_datetime", startISO)
            .lte("sales.sale_datetime", endISO);
          
          const { data, error } = await query;
          if (error) throw error;
          
          const salesMap = new Map<string, number>();
          data?.forEach(item => {
            const saleId = (item.sales as any)?.id;
            const revenue = (item.products as any)?.revenue_dkk || 0;
            const current = salesMap.get(saleId) || 0;
            salesMap.set(saleId, current + (revenue * (item.quantity || 1)));
          });
          
          const totalRevenue = Array.from(salesMap.values()).reduce((sum, v) => sum + v, 0);
          value = salesMap.size > 0 ? totalRevenue / salesMap.size : 0;
          break;
        }

        case "calls-total": {
          const { count, error } = await supabase
            .from("dialer_calls")
            .select("id", { count: "exact", head: true })
            .gte("start_time", startISO)
            .lte("start_time", endISO);
          
          if (error) throw error;
          value = count || 0;
          break;
        }

        case "calls-answered": {
          const { count, error } = await supabase
            .from("dialer_calls")
            .select("id", { count: "exact", head: true })
            .gte("start_time", startISO)
            .lte("start_time", endISO)
            .gt("duration_seconds", 0);
          
          if (error) throw error;
          value = count || 0;
          break;
        }

        case "avg-call-duration": {
          const { data, error } = await supabase
            .from("dialer_calls")
            .select("duration_seconds")
            .gte("start_time", startISO)
            .lte("start_time", endISO)
            .gt("duration_seconds", 0);
          
          if (error) throw error;
          const totalDuration = data?.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) || 0;
          value = data && data.length > 0 ? totalDuration / data.length : 0;
          break;
        }

        case "talk-time": {
          const { data, error } = await supabase
            .from("dialer_calls")
            .select("duration_seconds")
            .gte("start_time", startISO)
            .lte("start_time", endISO);
          
          if (error) throw error;
          value = data?.reduce((sum, call) => sum + (call.duration_seconds || 0), 0) || 0;
          // Convert to hours for display
          value = value / 3600;
          break;
        }

        case "conversion-rate": {
          // Calculate conversion as sales / calls
          const [salesResult, callsResult] = await Promise.all([
            supabase
              .from("sales")
              .select("id", { count: "exact", head: true })
              .gte("sale_datetime", startISO)
              .lte("sale_datetime", endISO),
            supabase
              .from("dialer_calls")
              .select("id", { count: "exact", head: true })
              .gte("start_time", startISO)
              .lte("start_time", endISO)
          ]);
          
          const sales = salesResult.count || 0;
          const calls = callsResult.count || 0;
          value = calls > 0 ? (sales / calls) * 100 : 0;
          break;
        }

        case "leads-generated": {
          // Use candidates as leads
          const { count, error } = await supabase
            .from("candidates")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startISO)
            .lte("created_at", endISO);
          
          if (error) throw error;
          value = count || 0;
          break;
        }

        case "appointments-booked": {
          const { count, error } = await supabase
            .from("candidates")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startISO)
            .lte("created_at", endISO)
            .not("interview_date", "is", null);
          
          if (error) throw error;
          value = count || 0;
          break;
        }

        case "active-agents": {
          const { count, error } = await supabase
            .from("employee_master_data")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true);
          
          if (error) throw error;
          value = count || 0;
          break;
        }

        case "team-target-progress": {
          // Get current month's goal and actual sales
          const now = new Date();
          const currentMonth = now.getMonth() + 1;
          const currentYear = now.getFullYear();
          
          let goalQuery = supabase
            .from("client_monthly_goals")
            .select("sales_target")
            .eq("month", currentMonth)
            .eq("year", currentYear);
          
          if (clientId) {
            goalQuery = goalQuery.eq("client_id", clientId);
          }
          
          const { data: goals } = await goalQuery;
          const totalTarget = goals?.reduce((sum, g) => sum + (g.sales_target || 0), 0) || 0;
          
          // Get actual sales for this month
          const { count: salesCount } = await supabase
            .from("sales")
            .select("id", { count: "exact", head: true })
            .gte("sale_datetime", startOfMonth(now).toISOString())
            .lte("sale_datetime", endOfMonth(now).toISOString());
          
          value = totalTarget > 0 ? ((salesCount || 0) / totalTarget) * 100 : 0;
          break;
        }

        case "commission": {
          // Sum mapped_commission from sale_items (same logic as Sales page)
          // Exclude cancelled/rejected sales
          let targetClientIds: string[] = [];
          if (teamId) {
            targetClientIds = await getClientIdsForTeam(teamId);
          } else if (clientId) {
            targetClientIds = [clientId];
          }
          
          let campaignIds: string[] = [];
          if (targetClientIds.length > 0) {
            const { data: campaigns } = await supabase
              .from("client_campaigns")
              .select("id")
              .in("client_id", targetClientIds);
            campaignIds = (campaigns || []).map(c => c.id);
          }
          
          // Use mapped_commission from sale_items, matching Sales page logic
          let query = supabase
            .from("sale_items")
            .select(`
              quantity,
              mapped_commission,
              sales!inner(sale_datetime, client_campaign_id, validation_status)
            `)
            .gte("sales.sale_datetime", startISO)
            .lte("sales.sale_datetime", endISO)
            .not("sales.validation_status", "eq", "cancelled")
            .not("sales.validation_status", "eq", "rejected");
          
          if (campaignIds.length > 0) {
            query = query.in("sales.client_campaign_id", campaignIds);
          }
          
          const { data, error } = await query;
          if (error) throw error;
          
          // mapped_commission already contains the total for the line (qty × unit_commission)
          // so we just sum it directly without multiplying by quantity again
          value = data?.reduce((sum, item) => {
            const lineCommission = Number((item as any).mapped_commission) || 0;
            return sum + lineCommission;
          }, 0) || 0;
          break;
        }

        default:
          // Return 0 for unknown KPI types
          value = 0;
      }

      return {
        value: formatValue(value, kpiTypeId),
        loading: false,
      };
    } catch (error) {
      console.error(`Error fetching KPI data for ${kpiTypeId}:`, error);
      return {
        value: "—",
        loading: false,
      };
    }
  }, []);

  const getKpiValue = useCallback(async (params: FetchParams): Promise<string> => {
    const cacheKey = getCacheKey(params);
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && !cached.loading) {
      return cached.value;
    }
    
    // Fetch fresh data
    const result = await fetchKpiData(params);
    setCache(prev => new Map(prev).set(cacheKey, result));
    return result.value;
  }, [cache, fetchKpiData]);

  const invalidateCache = useCallback(() => {
    setCache(new Map());
  }, []);

  return {
    getKpiValue,
    invalidateCache,
  };
};

// Hook for batch fetching all widget data
export const useWidgetKpiData = (widgets: Array<{
  id: string;
  dataSource: "kpi" | "custom";
  kpiTypeIds: string[];
  customValue?: string;
  timePeriodId: string;
  customFromDate?: Date;
  clientId?: string;
  teamId?: string;
}>) => {
  const [values, setValues] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  // Create a stable key for tracking changes in widget configuration
  const widgetsKey = JSON.stringify(widgets.map(w => ({
    id: w.id,
    dataSource: w.dataSource,
    kpiTypeIds: w.kpiTypeIds,
    customValue: w.customValue,
    timePeriodId: w.timePeriodId,
    customFromDate: w.customFromDate?.toISOString(),
    clientId: w.clientId,
    teamId: w.teamId,
  })));

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      const newValues = new Map<string, string>();
      
      for (const widget of widgets) {
        if (widget.dataSource === "custom") {
          newValues.set(widget.id, widget.customValue || "0");
          continue;
        }
        
        // For KPI widgets, fetch the first KPI's value
        if (widget.kpiTypeIds.length > 0) {
          const kpiTypeId = widget.kpiTypeIds[0];
          
          try {
            const { start, end } = getDateRange(widget.timePeriodId, widget.customFromDate);
            const startISO = start.toISOString();
            const endISO = end.toISOString();
            
            let value = 0;
            
            switch (kpiTypeId) {
              case "sales-count": {
                // Query telesales via sale_items (same logic as TeamOverview)
                let telesalesCount = 0;
                let fieldmarketingCount = 0;
                
                // Get client IDs based on team or client filter
                let targetClientIds: string[] = [];
                if (widget.teamId) {
                  const { data: teamClients } = await supabase
                    .from("team_clients")
                    .select("client_id")
                    .eq("team_id", widget.teamId);
                  targetClientIds = (teamClients || []).map(tc => tc.client_id);
                } else if (widget.clientId) {
                  targetClientIds = [widget.clientId];
                }
                
                // Get campaign IDs for the target clients
                let campaignIds: string[] = [];
                if (targetClientIds.length > 0) {
                  const { data: campaigns } = await supabase
                    .from("client_campaigns")
                    .select("id")
                    .in("client_id", targetClientIds);
                  campaignIds = (campaigns || []).map(c => c.id);
                } else {
                  const { data: allCampaigns } = await supabase
                    .from("client_campaigns")
                    .select("id");
                  campaignIds = (allCampaigns || []).map(c => c.id);
                }
                
                if (campaignIds.length > 0) {
                  // Fetch sales with sale_items to count properly (like TeamOverview)
                  const { data: salesData, error } = await supabase
                    .from("sales")
                    .select(`
                      id,
                      sale_items (
                        quantity,
                        products (
                          counts_as_sale
                        )
                      )
                    `)
                    .in("client_campaign_id", campaignIds)
                    .gte("sale_datetime", startISO)
                    .lte("sale_datetime", endISO);
                  
                  if (!error) {
                    // Count sales from sale_items where counts_as_sale !== false
                    (salesData || []).forEach((sale: any) => {
                      (sale.sale_items || []).forEach((item: any) => {
                        const countsAsSale = item.products?.counts_as_sale !== false;
                        if (countsAsSale) {
                          telesalesCount += Number(item.quantity) || 1;
                        }
                      });
                    });
                  }
                }
                
                // Also count fieldmarketing_sales
                if (targetClientIds.length > 0) {
                  const { count: fmCount } = await supabase
                    .from("fieldmarketing_sales")
                    .select("id", { count: "exact", head: true })
                    .gte("registered_at", startISO)
                    .lte("registered_at", endISO)
                    .in("client_id", targetClientIds);
                  fieldmarketingCount = fmCount || 0;
                } else {
                  const { count: fmCount } = await supabase
                    .from("fieldmarketing_sales")
                    .select("id", { count: "exact", head: true })
                    .gte("registered_at", startISO)
                    .lte("registered_at", endISO);
                  fieldmarketingCount = fmCount || 0;
                }
                
                value = telesalesCount + fieldmarketingCount;
                break;
              }
              
              case "sales-revenue": {
                let telesalesRevenue = 0;
                // Fieldmarketing_sales doesn't have revenue/price column
                
                let query = supabase
                  .from("sale_items")
                  .select(`
                    quantity,
                    products(revenue_dkk),
                    sales!inner(sale_datetime, client_campaign_id)
                  `)
                  .gte("sales.sale_datetime", startISO)
                  .lte("sales.sale_datetime", endISO);
                
                if (widget.clientId) {
                  const { data: campaigns } = await supabase
                    .from("client_campaigns")
                    .select("id")
                    .eq("client_id", widget.clientId);
                  
                  if (campaigns && campaigns.length > 0) {
                    const campaignIds = campaigns.map(c => c.id);
                    query = query.in("sales.client_campaign_id", campaignIds);
                  }
                }
                
                const { data } = await query;
                telesalesRevenue = data?.reduce((sum, item) => {
                  const revenue = (item.products as any)?.revenue_dkk || 0;
                  return sum + (revenue * (item.quantity || 1));
                }, 0) || 0;
                
                value = telesalesRevenue;
                break;
              }
              
              case "calls-total": {
                const { count } = await supabase
                  .from("dialer_calls")
                  .select("id", { count: "exact", head: true })
                  .gte("start_time", startISO)
                  .lte("start_time", endISO);
                value = count || 0;
                break;
              }
              
              case "conversion-rate": {
                const [salesResult, callsResult] = await Promise.all([
                  supabase
                    .from("sales")
                    .select("id", { count: "exact", head: true })
                    .gte("sale_datetime", startISO)
                    .lte("sale_datetime", endISO),
                  supabase
                    .from("dialer_calls")
                    .select("id", { count: "exact", head: true })
                    .gte("start_time", startISO)
                    .lte("start_time", endISO)
                ]);
                
                const sales = salesResult.count || 0;
                const calls = callsResult.count || 0;
                value = calls > 0 ? (sales / calls) * 100 : 0;
                break;
              }
              
              case "leads-generated": {
                const { count } = await supabase
                  .from("candidates")
                  .select("id", { count: "exact", head: true })
                  .gte("created_at", startISO)
                  .lte("created_at", endISO);
                value = count || 0;
                break;
              }
              
              case "team-target-progress": {
                const now = new Date();
                const currentMonth = now.getMonth() + 1;
                const currentYear = now.getFullYear();
                
                let goalQuery = supabase
                  .from("client_monthly_goals")
                  .select("sales_target")
                  .eq("month", currentMonth)
                  .eq("year", currentYear);
                
                if (widget.clientId) {
                  goalQuery = goalQuery.eq("client_id", widget.clientId);
                }
                
                const { data: goals } = await goalQuery;
                const totalTarget = goals?.reduce((sum, g) => sum + (g.sales_target || 0), 0) || 0;
                
                // Count both telesales and fieldmarketing
                let salesCount = 0;
                if (widget.clientId) {
                  const { data: campaigns } = await supabase
                    .from("client_campaigns")
                    .select("id")
                    .eq("client_id", widget.clientId);
                  
                  if (campaigns && campaigns.length > 0) {
                    const campaignIds = campaigns.map(c => c.id);
                    const { count } = await supabase
                      .from("sales")
                      .select("id", { count: "exact", head: true })
                      .gte("sale_datetime", startOfMonth(now).toISOString())
                      .lte("sale_datetime", endOfMonth(now).toISOString())
                      .in("client_campaign_id", campaignIds);
                    salesCount = count || 0;
                  }
                  
                  const { count: fmCount } = await supabase
                    .from("fieldmarketing_sales")
                    .select("id", { count: "exact", head: true })
                    .gte("registered_at", startOfMonth(now).toISOString())
                    .lte("registered_at", endOfMonth(now).toISOString())
                    .eq("client_id", widget.clientId);
                  salesCount += fmCount || 0;
                } else {
                  const [telesalesResult, fmResult] = await Promise.all([
                    supabase
                      .from("sales")
                      .select("id", { count: "exact", head: true })
                      .gte("sale_datetime", startOfMonth(now).toISOString())
                      .lte("sale_datetime", endOfMonth(now).toISOString()),
                    supabase
                      .from("fieldmarketing_sales")
                      .select("id", { count: "exact", head: true })
                      .gte("registered_at", startOfMonth(now).toISOString())
                      .lte("registered_at", endOfMonth(now).toISOString())
                  ]);
                  salesCount = (telesalesResult.count || 0) + (fmResult.count || 0);
                }
                
                value = totalTarget > 0 ? (salesCount / totalTarget) * 100 : 0;
                break;
              }

              case "commission": {
                // Sum commission_dkk from products in sale_items for the date range
                let targetClientIds: string[] = [];
                if (widget.teamId) {
                  const { data: teamClients } = await supabase
                    .from("team_clients")
                    .select("client_id")
                    .eq("team_id", widget.teamId);
                  targetClientIds = (teamClients || []).map(tc => tc.client_id);
                } else if (widget.clientId) {
                  targetClientIds = [widget.clientId];
                }
                
                let campaignIds: string[] = [];
                if (targetClientIds.length > 0) {
                  const { data: campaigns } = await supabase
                    .from("client_campaigns")
                    .select("id")
                    .in("client_id", targetClientIds);
                  campaignIds = (campaigns || []).map(c => c.id);
                }
                
                let query = supabase
                  .from("sale_items")
                  .select(`
                    quantity,
                    products!inner(commission_dkk),
                    sales!inner(sale_datetime, client_campaign_id)
                  `)
                  .gte("sales.sale_datetime", startISO)
                  .lte("sales.sale_datetime", endISO);
                
                if (campaignIds.length > 0) {
                  query = query.in("sales.client_campaign_id", campaignIds);
                }
                
                const { data } = await query;
                value = data?.reduce((sum, item) => {
                  const commission = (item.products as any)?.commission_dkk || 0;
                  return sum + (commission * (item.quantity || 1));
                }, 0) || 0;
                break;
              }
              
              default:
                value = 0;
            }
            
            newValues.set(widget.id, formatValue(value, kpiTypeId));
          } catch (error) {
            console.error(`Error fetching widget ${widget.id}:`, error);
            newValues.set(widget.id, "—");
          }
        }
      }
      
      setValues(newValues);
      setLoading(false);
    };
    
    if (widgets.length > 0) {
      fetchAllData();
    } else {
      setLoading(false);
    }
  }, [widgetsKey]);

  const getValue = (widgetId: string): string => {
    return values.get(widgetId) || "—";
  };

  return { getValue, loading };
};
