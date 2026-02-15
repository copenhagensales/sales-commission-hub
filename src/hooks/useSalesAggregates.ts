import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";

export interface SalesAggregates {
  totalSales: number;
  totalCommission: number;
  totalRevenue: number;
  byEmployee: Record<string, { 
    name: string; 
    sales: number; 
    commission: number; 
    revenue: number 
  }>;
  byDate: Record<string, { 
    sales: number; 
    commission: number; 
    revenue: number 
  }>;
  isFromRPC: boolean;
}

interface UseSalesAggregatesParams {
  periodStart: Date;
  periodEnd: Date;
  teamId?: string;
  employeeId?: string;
  clientId?: string;
  enabled?: boolean;
}

/**
 * Central hook for fetching sales aggregates.
 * Uses server-side RPC when available, with fallback to paginated client-side calculation.
 */
export function useSalesAggregates({
  periodStart,
  periodEnd,
  teamId,
  employeeId,
  clientId,
  enabled = true,
}: UseSalesAggregatesParams) {
  const startStr = periodStart.toISOString();
  const endStr = periodEnd.toISOString();

  return useQuery({
    queryKey: ["sales-aggregates", startStr, endStr, teamId, employeeId, clientId],
    queryFn: async (): Promise<SalesAggregates> => {
      // Try RPC first for server-side aggregation
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_sales_aggregates",
          {
            p_start: startStr,
            p_end: endStr,
            p_team_id: teamId || null,
            p_employee_id: employeeId || null,
            p_client_id: clientId || null,
          }
        );

        if (!rpcError && rpcData && rpcData.length > 0) {
          const row = rpcData[0];
          return {
            totalSales: row.total_sales || 0,
            totalCommission: row.total_commission || 0,
            totalRevenue: row.total_revenue || 0,
            byEmployee: {},
            byDate: {},
            isFromRPC: true,
          };
        }
      } catch (e) {
        console.warn("[useSalesAggregates] RPC failed, falling back to client-side:", e);
      }

      // Fallback: fetch all sales with pagination and calculate client-side
      const filters = (query: any) => {
        let q = query
          .neq("source", "fieldmarketing")
          .neq("validation_status", "rejected")
          .gte("sale_datetime", startStr)
          .lte("sale_datetime", endStr);
        
        if (clientId) {
          q = q.eq("client_campaigns.client_id", clientId);
        }
        
        return q;
      };

      const selectFields = clientId
        ? "id, agent_email, sale_datetime, client_campaign_id, client_campaigns!inner(client_id), sale_items(quantity, mapped_commission, mapped_revenue, products(counts_as_sale))"
        : "id, agent_email, sale_datetime, sale_items(quantity, mapped_commission, mapped_revenue, products(counts_as_sale))";

      const sales = await fetchAllRows<any>(
        "sales",
        selectFields,
        filters,
        { orderBy: "sale_datetime", ascending: false }
      );

      // Calculate aggregates
      let totalSales = 0;
      let totalCommission = 0;
      let totalRevenue = 0;
      const byEmployee: SalesAggregates["byEmployee"] = {};
      const byDate: SalesAggregates["byDate"] = {};

      for (const sale of sales) {
        const agentEmail = sale.agent_email || "unknown";
        const saleDate = sale.sale_datetime?.split("T")[0] || "unknown";
        
        if (!byEmployee[agentEmail]) {
          byEmployee[agentEmail] = { 
            name: agentEmail.split("@")[0], 
            sales: 0, 
            commission: 0, 
            revenue: 0 
          };
        }
        
        if (!byDate[saleDate]) {
          byDate[saleDate] = { sales: 0, commission: 0, revenue: 0 };
        }

        for (const item of sale.sale_items || []) {
          const countsAsSale = item.products?.counts_as_sale !== false;
          const qty = Number(item.quantity) || 1;
          const commission = Number(item.mapped_commission) || 0;
          const revenue = Number(item.mapped_revenue) || 0;

          if (countsAsSale) {
            totalSales += qty;
            byEmployee[agentEmail].sales += qty;
            byDate[saleDate].sales += qty;
          }
          
          totalCommission += commission;
          totalRevenue += revenue;
          byEmployee[agentEmail].commission += commission;
          byEmployee[agentEmail].revenue += revenue;
          byDate[saleDate].commission += commission;
          byDate[saleDate].revenue += revenue;
        }
      }

      return {
        totalSales,
        totalCommission,
        totalRevenue,
        byEmployee,
        byDate,
        isFromRPC: false,
      };
    },
    enabled,
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
