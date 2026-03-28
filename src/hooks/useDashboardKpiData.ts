import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
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
    // Use space as thousands separator for clarity (27 070 instead of 27.070)
    const formatted = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value);
    return `${formatted.replace(/\./g, " ")} kr.`;
  }
  if (kpiTypeId.includes("rate") || kpiTypeId.includes("conversion")) {
    return `${value.toFixed(1)}%`;
  }
  if (kpiTypeId.includes("duration") || kpiTypeId.includes("time") || kpiTypeId.includes("handle")) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  // Use space as thousands separator for regular numbers too
  const formatted = new Intl.NumberFormat("de-DE").format(value);
  return formatted.replace(/\./g, " ");
};

// Mapping from hook KPI types to cached slugs
const kpiTypeToSlug: Record<string, string> = {
  "sales-count": "sales_count",
  "commission": "total_commission",
  "sales-revenue": "total_revenue",
};

// Mapping from hook periods to cache periods
const periodToKpiPeriod: Record<string, string> = {
  "today": "today",
  "this-week": "this_week",
  "this-month": "this_month",
};

export const useDashboardKpiData = () => {
  const [cache, setCache] = useState<Map<string, KpiDataResult>>(new Map());

  const getCacheKey = (params: FetchParams): string => {
    return `${params.kpiTypeId}-${params.timePeriodId}-${params.clientId || ""}-${params.teamId || ""}-${params.customFromDate?.toISOString() || ""}`;
  };

  const fetchKpiData = useCallback(async (params: FetchParams): Promise<KpiDataResult> => {
    const { kpiTypeId, timePeriodId, customFromDate, clientId, teamId } = params;
    
    // ============= CACHE-FIRST OPTIMIZATION (Fase 9) =============
    // Try to serve from kpi_cached_values first for standard periods
    const cachedSlug = kpiTypeToSlug[kpiTypeId];
    const cachedPeriod = periodToKpiPeriod[timePeriodId];
    
    if (cachedSlug && cachedPeriod && !customFromDate) {
      try {
        const scopeType = clientId ? "client" : teamId ? "team" : "global";
        const scopeId = clientId || teamId || null;
        
        let query = supabase
          .from("kpi_cached_values")
          .select("value, formatted_value")
          .eq("kpi_slug", cachedSlug)
          .eq("period_type", cachedPeriod)
          .eq("scope_type", scopeType);
        
        if (scopeId) {
          query = query.eq("scope_id", scopeId);
        } else {
          query = query.is("scope_id", null);
        }
        
        const { data } = await query.maybeSingle();
        
        if (data) {
          return {
            value: data.formatted_value || formatValue(data.value, kpiTypeId),
            loading: false,
          };
        }
      } catch (cacheError) {
        console.warn("Cache lookup failed, falling back to direct query:", cacheError);
      }
    }
    
    // ============= FALLBACK: Direct database query =============
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
            // Fetch sales with sale_items using pagination to handle >1000 rows
            const salesData = await fetchAllRows<any>(
              "sales",
              `id, sale_items(quantity, products(counts_as_sale))`,
              (q) => q.in("client_campaign_id", campaignIds)
                      .neq("source", "fieldmarketing")
                      .gte("sale_datetime", startISO)
                      .lte("sale_datetime", endISO),
              { orderBy: "sale_datetime", ascending: false }
            );
            
            // Count sales from sale_items where counts_as_sale !== false
            salesData.forEach((sale: any) => {
              (sale.sale_items || []).forEach((item: any) => {
                const countsAsSale = item.products?.counts_as_sale !== false;
                if (countsAsSale) {
                  telesalesCount += Number(item.quantity) || 1;
                }
              });
            });
          }
          
          // Also count fieldmarketing from unified sales table
          if (targetClientIds.length > 0) {
            // For client filtering, we need to match via raw_payload->>'fm_client_id' or client_campaign_id
            const { count: fmCount, error: fmError } = await supabase
              .from("sales")
              .select("id", { count: "exact", head: true })
              .eq("source", "fieldmarketing")
              .gte("sale_datetime", startISO)
              .lte("sale_datetime", endISO);
            if (fmError) throw fmError;
            // Post-filter for client IDs would require full data fetch, so count all FM for now
            fieldmarketingCount = fmCount || 0;
          } else {
            const { count: fmCount, error: fmError } = await supabase
              .from("sales")
              .select("id", { count: "exact", head: true })
              .eq("source", "fieldmarketing")
              .gte("sale_datetime", startISO)
              .lte("sale_datetime", endISO);
            if (fmError) throw fmError;
            fieldmarketingCount = fmCount || 0;
          }
          
          value = telesalesCount + fieldmarketingCount;
          break;
        }

        case "sales-revenue": {
          let revCampaignIds: string[] = [];
          if (clientId) {
            const { data: campaigns } = await supabase
              .from("client_campaigns")
              .select("id")
              .eq("client_id", clientId);
            revCampaignIds = (campaigns || []).map(c => c.id);
          }
          
          const revenueItems = await fetchAllRows<any>(
            "sale_items",
            `mapped_revenue, sales!inner(sale_datetime, client_campaign_id)`,
            (q) => {
              let filtered = q
                .gte("sales.sale_datetime", startISO)
                .lte("sales.sale_datetime", endISO);
              if (revCampaignIds.length > 0) {
                filtered = filtered.in("sales.client_campaign_id", revCampaignIds);
              }
              return filtered;
            },
            { orderBy: "id", ascending: true }
          );
          
          // mapped_revenue is already pre-calculated by backend rematch (qty × rule price)
          value = revenueItems.reduce((sum, item) => {
            return sum + (Number(item.mapped_revenue) || 0);
          }, 0);
          break;
        }

        case "avg-order-value": {
          const aovItems = await fetchAllRows<any>(
            "sale_items",
            `mapped_revenue, sales!inner(sale_datetime, id)`,
            (q) => q
              .gte("sales.sale_datetime", startISO)
              .lte("sales.sale_datetime", endISO),
            { orderBy: "id", ascending: true }
          );
          
          const salesMap = new Map<string, number>();
          aovItems.forEach(item => {
            const saleId = (item.sales as any)?.id;
            const revenue = Number(item.mapped_revenue) || 0;
            const current = salesMap.get(saleId) || 0;
            salesMap.set(saleId, current + revenue);
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

        case "avg-call-duration":
        case "talk-time": {
          // Use RPC for server-side aggregation instead of fetching 12,000+ rows
          const { data: callStats, error } = await supabase.rpc("get_call_stats", {
            start_ts: startISO,
            end_ts: endISO,
          });
          
          if (error) throw error;
          const stats = callStats?.[0];
          
          if (kpiTypeId === "avg-call-duration") {
            value = Number(stats?.avg_duration) || 0;
          } else {
            // talk-time: convert seconds to hours
            value = (Number(stats?.total_duration) || 0) / 3600;
          }
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
          
          // Use mapped_commission from sale_items with pagination
          const commItems = await fetchAllRows<any>(
            "sale_items",
            `quantity, mapped_commission, sales!inner(sale_datetime, client_campaign_id, validation_status)`,
            (q) => {
              let filtered = q
                .gte("sales.sale_datetime", startISO)
                .lte("sales.sale_datetime", endISO)
                .or("validation_status.neq.rejected,validation_status.is.null", { foreignTable: "sales" });
              if (campaignIds.length > 0) {
                filtered = filtered.in("sales.client_campaign_id", campaignIds);
              }
              return filtered;
            },
            { orderBy: "id", ascending: true }
          );
          
          // mapped_commission already contains the total for the line (qty × unit_commission)
          // so we just sum it directly without multiplying by quantity again
          value = commItems.reduce((sum, item) => {
            const lineCommission = Number(item.mapped_commission) || 0;
            return sum + lineCommission;
          }, 0);
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
        value: "–",
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

// Helper: Fetch a metric value for formula evaluation
const fetchMetricValueForFormula = async (
  metricKey: string,
  startISO: string,
  endISO: string,
  clientId?: string,
  teamId?: string
): Promise<number> => {
  // Get target client IDs for filtering
  let targetClientIds: string[] = [];
  if (teamId) {
    const { data: teamClients } = await supabase
      .from("team_clients")
      .select("client_id")
      .eq("team_id", teamId);
    targetClientIds = (teamClients || []).map(tc => tc.client_id);
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
  }

  switch (metricKey) {
    case "antal_salg": {
      // Count sales from sale_items where counts_as_sale !== false
      let telesalesCount = 0;
      let fieldmarketingCount = 0;
      
      if (campaignIds.length === 0 && targetClientIds.length === 0) {
        // Get all campaigns
        const { data: allCampaigns } = await supabase.from("client_campaigns").select("id");
        campaignIds = (allCampaigns || []).map(c => c.id);
      }
      
      if (campaignIds.length > 0) {
        const salesData = await fetchAllRows<any>(
          "sales",
          `id, sale_items (quantity, products (counts_as_sale))`,
          (q) => q.in("client_campaign_id", campaignIds)
                  .neq("source", "fieldmarketing")
                  .gte("sale_datetime", startISO)
                  .lte("sale_datetime", endISO),
          { orderBy: "sale_datetime", ascending: false }
        );
        
        salesData.forEach((sale: any) => {
          (sale.sale_items || []).forEach((item: any) => {
            if (item.products?.counts_as_sale !== false) {
              telesalesCount += Number(item.quantity) || 1;
            }
          });
        });
      }
      
      // Fieldmarketing from unified sales table
      let fmQuery = supabase
        .from("sales")
        .select("id", { count: "exact", head: true })
        .eq("source", "fieldmarketing")
        .gte("sale_datetime", startISO)
        .lte("sale_datetime", endISO);
      
      // Note: client filtering for FM would require raw_payload filter
      const { count: fmCount } = await fmQuery;
      fieldmarketingCount = fmCount || 0;
      
      return telesalesCount + fieldmarketingCount;
    }

    case "commission": {
      // Sum mapped_commission from sale_items with pagination
      const commissionData = await fetchAllRows<any>(
        "sale_items",
        `mapped_commission, sales!inner(sale_datetime, client_campaign_id, validation_status)`,
        (q) => {
          let filtered = q
            .gte("sales.sale_datetime", startISO)
            .lte("sales.sale_datetime", endISO)
            .or("validation_status.neq.rejected,validation_status.is.null", { foreignTable: "sales" });
          if (campaignIds.length > 0) {
            filtered = filtered.in("sales.client_campaign_id", campaignIds);
          }
          return filtered;
        },
        { orderBy: "id", ascending: true }
      );
      return commissionData.reduce((sum, item) => sum + (Number(item.mapped_commission) || 0), 0);
    }

    case "revenue": {
      const revenueData = await fetchAllRows<any>(
        "sale_items",
        `quantity, products(revenue_dkk), sales!inner(sale_datetime, client_campaign_id)`,
        (q) => {
          let filtered = q
            .gte("sales.sale_datetime", startISO)
            .lte("sales.sale_datetime", endISO);
          if (campaignIds.length > 0) {
            filtered = filtered.in("sales.client_campaign_id", campaignIds);
          }
          return filtered;
        },
        { orderBy: "id", ascending: true }
      );
      return revenueData.reduce((sum, item) => {
        const revenue = (item.products as any)?.revenue_dkk || 0;
        return sum + (revenue * (item.quantity || 1));
      }, 0);
    }

    case "timer":
    case "total_hours":
    case "live_sales_hours": {
      // Sum actual worked hours from shift table
      const dateStart = startISO.split("T")[0];
      const dateEnd = endISO.split("T")[0];
      
      const shifts = await fetchAllRows<{start_time: string; end_time: string; break_minutes: number | null}>(
        "shift",
        "start_time, end_time, break_minutes",
        (q) => q.gte("date", dateStart).lte("date", dateEnd),
        { orderBy: "date", ascending: true }
      );
      
      let totalHours = 0;
      (shifts || []).forEach((shift: any) => {
        if (shift.start_time && shift.end_time) {
          const start = new Date(`1970-01-01T${shift.start_time}`);
          const end = new Date(`1970-01-01T${shift.end_time}`);
          let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
          // Subtract breaks
          if (shift.break_minutes) hours -= shift.break_minutes / 60;
          if (hours > 0 && hours < 24) totalHours += hours;
        }
      });
      
      return totalHours;
    }

    case "sick_days": {
      // Count from absence_request_v2
      const { count } = await supabase
        .from("absence_request_v2")
        .select("id", { count: "exact", head: true })
        .eq("type", "sick")
        .eq("status", "approved")
        .gte("start_date", startISO.split("T")[0])
        .lte("start_date", endISO.split("T")[0]);
      return count || 0;
    }

    case "vacation_days": {
      const { count } = await supabase
        .from("absence_request_v2")
        .select("id", { count: "exact", head: true })
        .eq("type", "vacation")
        .eq("status", "approved")
        .gte("start_date", startISO.split("T")[0])
        .lte("start_date", endISO.split("T")[0]);
      return count || 0;
    }

    case "day_off_days": {
      const { count } = await supabase
        .from("absence_request_v2")
        .select("id", { count: "exact", head: true })
        .eq("type", "day_off")
        .eq("status", "approved")
        .gte("start_date", startISO.split("T")[0])
        .lte("start_date", endISO.split("T")[0]);
      return count || 0;
    }

    case "all_shift_types": {
      // Count all shifts (work days)
      const { count } = await supabase
        .from("shift")
        .select("id", { count: "exact", head: true })
        .gte("date", startISO.split("T")[0])
        .lte("date", endISO.split("T")[0]);
      return count || 0;
    }

    case "total_commission": {
      // Reuse existing commission logic
      return await fetchMetricValueForFormula("commission", startISO, endISO, clientId, teamId);
    }

    case "sales_count": {
      // Reuse existing antal_salg logic  
      return await fetchMetricValueForFormula("antal_salg", startISO, endISO, clientId, teamId);
    }

    case "total_revenue": {
      return await fetchMetricValueForFormula("revenue", startISO, endISO, clientId, teamId);
    }

    case "calls_total": {
      const { count } = await supabase
        .from("dialer_calls")
        .select("id", { count: "exact", head: true })
        .gte("start_time", startISO)
        .lte("start_time", endISO);
      return count || 0;
    }

    case "calls_answered": {
      const { count } = await supabase
        .from("dialer_calls")
        .select("id", { count: "exact", head: true })
        .gte("start_time", startISO)
        .lte("start_time", endISO)
        .gt("duration_seconds", 0);
      return count || 0;
    }

    case "talk_time_seconds": {
      // Use RPC for server-side aggregation instead of fetching all rows
      const { data: callStats } = await supabase.rpc("get_call_stats", {
        start_ts: startISO,
        end_ts: endISO,
      });
      return Number(callStats?.[0]?.total_duration) || 0;
    }

    default:
      console.warn(`Unknown metric key for formula: ${metricKey}`);
      return 0;
  }
};

// Parse formula string like "{sales_count} / {live_sales_hours}" into tokens
const parseFormulaString = (formula: string): Array<{type: string; value: string}> => {
  const tokens: Array<{type: string; value: string}> = [];
  // Match {metric}, operators, numbers, and parentheses
  const regex = /\{([^}]+)\}|([+\-*/×÷−])|(\d+\.?\d*)|([()])/g;
  let match;

  while ((match = regex.exec(formula)) !== null) {
    if (match[1]) {
      // KPI/metric reference - extract the slug inside {}
      tokens.push({ type: "metric", value: match[1] });
    } else if (match[2]) {
      // Operator
      tokens.push({ type: "operator", value: match[2] });
    } else if (match[3] && match[3] !== "") {
      // Number (avoid empty matches)
      tokens.push({ type: "number", value: match[3] });
    } else if (match[4]) {
      // Parenthesis
      tokens.push({ type: "parenthesis", value: match[4] });
    }
  }

  return tokens;
};

// Helper: Evaluate formula tokens with metric values
const evaluateFormulaTokens = (
  tokens: Array<{type: string; value: string}>,
  values: Record<string, number>
): number => {
  // Build mathematical expression from tokens
  let expression = "";
  for (const token of tokens) {
    if (token.type === "metric") {
      expression += (values[token.value] || 0).toString();
    } else if (token.type === "number") {
      expression += token.value;
    } else if (token.type === "operator") {
      // Map operator symbols to JS operators
      const opMap: Record<string, string> = {
        "×": "*", "÷": "/", "+": "+", "−": "-", "*": "*", "/": "/", "-": "-"
      };
      expression += ` ${opMap[token.value] || token.value} `;
    } else if (token.type === "parenthesis") {
      expression += token.value;
    }
  }
  
  // Safely evaluate the expression
  try {
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${expression})`)();
    return isFinite(result) ? result : 0;
  } catch (e) {
    console.error("Formula evaluation error:", e, expression);
    return 0;
  }
};

// Helper: Format formula result with configured formatting
const formatFormulaResult = (
  value: number,
  formula: { 
    decimal_places?: number | null; 
    symbol?: string | null; 
    symbol_position?: string | null; 
    kpi_type?: string | null;
  }
): string => {
  const decimalPlaces = formula.decimal_places ?? 2;
  
  // Format number with Danish locale
  const formatted = value.toLocaleString("da-DK", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
  
  // Apply symbol
  if (formula.symbol) {
    return formula.symbol_position === "before"
      ? `${formula.symbol} ${formatted}`
      : `${formatted} ${formula.symbol}`;
  }
  
  // Fallback to kpi_type for symbol
  if (formula.kpi_type === "currency") {
    return `${formatted} kr.`;
  } else if (formula.kpi_type === "percentage") {
    return `${formatted}%`;
  }
  
  return formatted;
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
            
            // === HANDLE FORMULAS ===
            if (kpiTypeId.startsWith("formula:")) {
              const formulaId = kpiTypeId.replace("formula:", "");
              
              // Fetch the formula from dashboard_kpis
              const { data: formulaData, error: formulaError } = await supabase
                .from("dashboard_kpis")
                .select("formula, decimal_places, multiplier, symbol, symbol_position, kpi_type")
                .eq("id", formulaId)
                .maybeSingle();
              
              if (formulaError || !formulaData?.formula) {
                console.error(`Formula not found: ${formulaId}`, formulaError);
                newValues.set(widget.id, "–");
                continue;
              }
              
              // Parse formula string to tokens using regex parser
              const tokens = parseFormulaString(formulaData.formula);
              
              if (tokens.length === 0) {
                console.error(`Could not parse formula: ${formulaData.formula}`);
                newValues.set(widget.id, "–");
                continue;
              }
              
              // Fetch values for each metric in the formula
              const metricValues: Record<string, number> = {};
              for (const token of tokens) {
                if (token.type === "metric" && !metricValues.hasOwnProperty(token.value)) {
                  metricValues[token.value] = await fetchMetricValueForFormula(
                    token.value, startISO, endISO, widget.clientId, widget.teamId
                  );
                }
              }
              
              // Evaluate the formula
              let result = evaluateFormulaTokens(tokens, metricValues);
              
              // Apply multiplier (e.g. ×100 for percentages)
              result = result * (formulaData.multiplier || 1);
              
              // Format the result
              const formatted = formatFormulaResult(result, formulaData);
              newValues.set(widget.id, formatted);
              continue;
            }
            
            // === HANDLE STANDARD KPIs ===
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
                  // Fetch sales with sale_items using pagination
                  const salesData = await fetchAllRows<any>(
                    "sales",
                    `id, sale_items(quantity, products(counts_as_sale))`,
                    (q) => q.in("client_campaign_id", campaignIds)
                            .neq("source", "fieldmarketing")
                            .gte("sale_datetime", startISO)
                            .lte("sale_datetime", endISO),
                    { orderBy: "sale_datetime", ascending: false }
                  );
                  
                  salesData.forEach((sale: any) => {
                    (sale.sale_items || []).forEach((item: any) => {
                      const countsAsSale = item.products?.counts_as_sale !== false;
                      if (countsAsSale) {
                        telesalesCount += Number(item.quantity) || 1;
                      }
                    });
                  });
                }
                
                // Also count fieldmarketing from unified sales table
                if (targetClientIds.length > 0) {
                  const { count: fmCount } = await supabase
                    .from("sales")
                    .select("id", { count: "exact", head: true })
                    .eq("source", "fieldmarketing")
                    .gte("sale_datetime", startISO)
                    .lte("sale_datetime", endISO);
                  fieldmarketingCount = fmCount || 0;
                } else {
                  const { count: fmCount } = await supabase
                    .from("sales")
                    .select("id", { count: "exact", head: true })
                    .eq("source", "fieldmarketing")
                    .gte("sale_datetime", startISO)
                    .lte("sale_datetime", endISO);
                  fieldmarketingCount = fmCount || 0;
                }
                
                value = telesalesCount + fieldmarketingCount;
                break;
              }
              
              case "sales-revenue": {
                let telesalesRevenue = 0;
                
                let widgetRevCampaignIds: string[] = [];
                if (widget.clientId) {
                  const { data: campaigns } = await supabase
                    .from("client_campaigns")
                    .select("id")
                    .eq("client_id", widget.clientId);
                  widgetRevCampaignIds = (campaigns || []).map(c => c.id);
                }
                
                const widgetRevItems = await fetchAllRows<any>(
                  "sale_items",
                  `quantity, products(revenue_dkk), sales!inner(sale_datetime, client_campaign_id)`,
                  (q) => {
                    let filtered = q
                      .gte("sales.sale_datetime", startISO)
                      .lte("sales.sale_datetime", endISO);
                    if (widgetRevCampaignIds.length > 0) {
                      filtered = filtered.in("sales.client_campaign_id", widgetRevCampaignIds);
                    }
                    return filtered;
                  },
                  { orderBy: "id", ascending: true }
                );
                
                telesalesRevenue = widgetRevItems.reduce((sum, item) => {
                  const revenue = (item.products as any)?.revenue_dkk || 0;
                  return sum + (revenue * (item.quantity || 1));
                }, 0);
                
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
                    .from("sales")
                    .select("id", { count: "exact", head: true })
                    .eq("source", "fieldmarketing")
                    .gte("sale_datetime", startOfMonth(now).toISOString())
                    .lte("sale_datetime", endOfMonth(now).toISOString());
                  salesCount += fmCount || 0;
                } else {
                  const [telesalesResult, fmResult] = await Promise.all([
                    supabase
                      .from("sales")
                      .select("id", { count: "exact", head: true })
                      .gte("sale_datetime", startOfMonth(now).toISOString())
                      .lte("sale_datetime", endOfMonth(now).toISOString()),
                    supabase
                      .from("sales")
                      .select("id", { count: "exact", head: true })
                      .eq("source", "fieldmarketing")
                      .gte("sale_datetime", startOfMonth(now).toISOString())
                      .lte("sale_datetime", endOfMonth(now).toISOString())
                  ]);
                  salesCount = (telesalesResult.count || 0) + (fmResult.count || 0);
                }
                
                value = totalTarget > 0 ? (salesCount / totalTarget) * 100 : 0;
                break;
              }

              case "commission": {
                // Sum mapped_commission from sale_items (matches Sales page logic)
                // Exclude cancelled/rejected sales
                let targetClientIds: string[] = [];
                if (widget.teamId) {
                  const { data: teamClients } = await supabase
                    .from("team_clients")
                    .select("client_id")
                    .eq("team_id", widget.teamId);
                  targetClientIds = (teamClients || []).map((tc) => tc.client_id);
                } else if (widget.clientId) {
                  targetClientIds = [widget.clientId];
                }

                let campaignIds: string[] = [];
                if (targetClientIds.length > 0) {
                  const { data: campaigns } = await supabase
                    .from("client_campaigns")
                    .select("id")
                    .in("client_id", targetClientIds);
                  campaignIds = (campaigns || []).map((c) => c.id);
                }

                const widgetCommItems = await fetchAllRows<any>(
                  "sale_items",
                  `mapped_commission, sales!inner(sale_datetime, client_campaign_id, validation_status)`,
                  (q) => {
                    let filtered = q
                      .gte("sales.sale_datetime", startISO)
                      .lte("sales.sale_datetime", endISO)
                      .or("validation_status.neq.rejected,validation_status.is.null", { foreignTable: "sales" });
                    if (campaignIds.length > 0) {
                      filtered = filtered.in("sales.client_campaign_id", campaignIds);
                    }
                    return filtered;
                  },
                  { orderBy: "id", ascending: true }
                );

                // mapped_commission already contains the total for the line
                value = widgetCommItems.reduce((sum, item) => sum + (Number(item.mapped_commission) || 0), 0);
                break;
              }
              
              default:
                value = 0;
            }
            
            newValues.set(widget.id, formatValue(value, kpiTypeId));
          } catch (error) {
            console.error(`Error fetching widget ${widget.id}:`, error);
            newValues.set(widget.id, "–");
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
    return values.get(widgetId) || "–";
  };

  return { getValue, loading };
};
