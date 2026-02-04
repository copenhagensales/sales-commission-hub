import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/utils/supabasePagination";
import { startOfWeek, endOfWeek, format, getISOWeek, getMonth, getYear } from "date-fns";

export interface AggregateData {
  sales: number;
  commission: number;
  revenue: number;
}

export interface SalesAggregatesExtended {
  totals: AggregateData;
  byEmployee: Record<string, AggregateData & { name: string; email: string }>;
  byDate: Record<string, AggregateData>;
  byWeek: Record<string, AggregateData>;
  byMonth: Record<string, AggregateData>;
  topPerformer: { email: string; name: string; data: AggregateData } | null;
  isFromRPC: boolean;
}

export interface UseSalesAggregatesExtendedParams {
  periodStart: Date;
  periodEnd: Date;
  teamId?: string;
  employeeId?: string;
  clientId?: string;
  groupBy?: ('employee' | 'date' | 'week' | 'month')[];
  agentEmails?: string[];
  enabled?: boolean;
}

/**
 * Extended central hook for fetching sales aggregates with grouping support.
 * Uses server-side RPC when available, with fallback to paginated client-side calculation.
 */
export function useSalesAggregatesExtended({
  periodStart,
  periodEnd,
  teamId,
  employeeId,
  clientId,
  groupBy = [],
  agentEmails,
  enabled = true,
}: UseSalesAggregatesExtendedParams) {
  const startStr = periodStart.toISOString();
  const endStr = periodEnd.toISOString();

  return useQuery({
    queryKey: [
      "sales-aggregates-extended",
      startStr,
      endStr,
      teamId,
      employeeId,
      clientId,
      groupBy.sort().join(","),
      agentEmails?.sort().join(",") || "",
    ],
    queryFn: async (): Promise<SalesAggregatesExtended> => {
      // Try RPC first for server-side aggregation
      const needsEmployeeGrouping = groupBy.includes('employee');
      const needsDateGrouping = groupBy.includes('date');
      
      try {
        const rpcGroupBy = needsEmployeeGrouping && needsDateGrouping 
          ? 'both' 
          : needsEmployeeGrouping 
            ? 'employee' 
            : needsDateGrouping 
              ? 'date' 
              : 'none';

        const { data: rpcData, error: rpcError } = await supabase.rpc(
          "get_sales_aggregates_v2",
          {
            p_start: startStr,
            p_end: endStr,
            p_team_id: teamId || null,
            p_employee_id: employeeId || null,
            p_client_id: clientId || null,
            p_group_by: rpcGroupBy,
            p_agent_emails: agentEmails || null,
          }
        );

        if (!rpcError && rpcData && rpcData.length > 0) {
          return processRPCData(rpcData, rpcGroupBy, groupBy);
        }
      } catch (e) {
        console.warn("[useSalesAggregatesExtended] RPC failed, falling back to client-side:", e);
      }

      // Fallback: fetch all sales with pagination and calculate client-side
      return await fetchAndCalculateClientSide({
        startStr,
        endStr,
        teamId,
        employeeId,
        clientId,
        agentEmails,
        groupBy,
      });
    },
    enabled,
    staleTime: 60000,
    refetchInterval: 120000,
  });
}

/**
 * Process RPC data into the extended format
 */
function processRPCData(
  data: Array<{
    group_key: string;
    group_name: string;
    total_sales: number;
    total_commission: number;
    total_revenue: number;
  }>,
  rpcGroupBy: string,
  requestedGroupBy: string[]
): SalesAggregatesExtended {
  const result: SalesAggregatesExtended = {
    totals: { sales: 0, commission: 0, revenue: 0 },
    byEmployee: {},
    byDate: {},
    byWeek: {},
    byMonth: {},
    topPerformer: null,
    isFromRPC: true,
  };

  // Process based on grouping type
  for (const row of data) {
    const sales = Number(row.total_sales) || 0;
    const commission = Number(row.total_commission) || 0;
    const revenue = Number(row.total_revenue) || 0;

    result.totals.sales += sales;
    result.totals.commission += commission;
    result.totals.revenue += revenue;

    if (rpcGroupBy === 'employee') {
      const email = row.group_key;
      const name = row.group_name;
      result.byEmployee[email] = { sales, commission, revenue, name, email };
    } else if (rpcGroupBy === 'date') {
      result.byDate[row.group_key] = { sales, commission, revenue };
    } else if (rpcGroupBy === 'both') {
      // Format: email|date
      const [email, date] = row.group_key.split('|');
      const name = row.group_name.split(' (')[0];
      
      // Aggregate by employee
      if (!result.byEmployee[email]) {
        result.byEmployee[email] = { sales: 0, commission: 0, revenue: 0, name, email };
      }
      result.byEmployee[email].sales += sales;
      result.byEmployee[email].commission += commission;
      result.byEmployee[email].revenue += revenue;
      
      // Aggregate by date
      if (!result.byDate[date]) {
        result.byDate[date] = { sales: 0, commission: 0, revenue: 0 };
      }
      result.byDate[date].sales += sales;
      result.byDate[date].commission += commission;
      result.byDate[date].revenue += revenue;
    }
  }

  // Calculate week/month aggregates from dates if requested
  if (requestedGroupBy.includes('week') || requestedGroupBy.includes('month')) {
    for (const [dateStr, dateData] of Object.entries(result.byDate)) {
      const date = new Date(dateStr);
      
      if (requestedGroupBy.includes('week')) {
        const weekKey = `${getYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;
        if (!result.byWeek[weekKey]) {
          result.byWeek[weekKey] = { sales: 0, commission: 0, revenue: 0 };
        }
        result.byWeek[weekKey].sales += dateData.sales;
        result.byWeek[weekKey].commission += dateData.commission;
        result.byWeek[weekKey].revenue += dateData.revenue;
      }

      if (requestedGroupBy.includes('month')) {
        const monthKey = `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, '0')}`;
        if (!result.byMonth[monthKey]) {
          result.byMonth[monthKey] = { sales: 0, commission: 0, revenue: 0 };
        }
        result.byMonth[monthKey].sales += dateData.sales;
        result.byMonth[monthKey].commission += dateData.commission;
        result.byMonth[monthKey].revenue += dateData.revenue;
      }
    }
  }

  // Find top performer
  const employees = Object.entries(result.byEmployee);
  if (employees.length > 0) {
    const [topEmail, topData] = employees.reduce((max, curr) => 
      curr[1].commission > max[1].commission ? curr : max
    );
    result.topPerformer = {
      email: topEmail,
      name: topData.name,
      data: { sales: topData.sales, commission: topData.commission, revenue: topData.revenue },
    };
  }

  return result;
}

/**
 * Fallback: Fetch all sales with pagination and calculate client-side
 */
async function fetchAndCalculateClientSide(params: {
  startStr: string;
  endStr: string;
  teamId?: string;
  employeeId?: string;
  clientId?: string;
  agentEmails?: string[];
  groupBy: string[];
}): Promise<SalesAggregatesExtended> {
  const { startStr, endStr, clientId, agentEmails, groupBy } = params;

  const filters = (query: any) => {
    let q = query
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

  // Filter by agent emails if specified
  const filteredSales = agentEmails && agentEmails.length > 0
    ? sales.filter(s => {
        const email = s.agent_email?.toLowerCase();
        return email && agentEmails.some(ae => ae.toLowerCase() === email);
      })
    : sales;

  // Calculate aggregates
  const result: SalesAggregatesExtended = {
    totals: { sales: 0, commission: 0, revenue: 0 },
    byEmployee: {},
    byDate: {},
    byWeek: {},
    byMonth: {},
    topPerformer: null,
    isFromRPC: false,
  };

  for (const sale of filteredSales) {
    const agentEmail = sale.agent_email || "unknown";
    const saleDate = sale.sale_datetime?.split("T")[0] || "unknown";
    const date = new Date(saleDate);

    // Initialize groupings
    if (groupBy.includes('employee') && !result.byEmployee[agentEmail]) {
      result.byEmployee[agentEmail] = { 
        name: agentEmail.split("@")[0], 
        email: agentEmail,
        sales: 0, 
        commission: 0, 
        revenue: 0 
      };
    }
    
    if (groupBy.includes('date') && !result.byDate[saleDate]) {
      result.byDate[saleDate] = { sales: 0, commission: 0, revenue: 0 };
    }

    if (groupBy.includes('week')) {
      const weekKey = `${getYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;
      if (!result.byWeek[weekKey]) {
        result.byWeek[weekKey] = { sales: 0, commission: 0, revenue: 0 };
      }
    }

    if (groupBy.includes('month')) {
      const monthKey = `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, '0')}`;
      if (!result.byMonth[monthKey]) {
        result.byMonth[monthKey] = { sales: 0, commission: 0, revenue: 0 };
      }
    }

    // Aggregate sale items
    for (const item of sale.sale_items || []) {
      const countsAsSale = item.products?.counts_as_sale !== false;
      const qty = Number(item.quantity) || 1;
      const commission = Number(item.mapped_commission) || 0;
      const revenue = Number(item.mapped_revenue) || 0;

      // Totals
      if (countsAsSale) {
        result.totals.sales += qty;
      }
      result.totals.commission += commission;
      result.totals.revenue += revenue;

      // By employee
      if (groupBy.includes('employee')) {
        if (countsAsSale) result.byEmployee[agentEmail].sales += qty;
        result.byEmployee[agentEmail].commission += commission;
        result.byEmployee[agentEmail].revenue += revenue;
      }

      // By date
      if (groupBy.includes('date')) {
        if (countsAsSale) result.byDate[saleDate].sales += qty;
        result.byDate[saleDate].commission += commission;
        result.byDate[saleDate].revenue += revenue;
      }

      // By week
      if (groupBy.includes('week')) {
        const weekKey = `${getYear(date)}-W${String(getISOWeek(date)).padStart(2, '0')}`;
        if (countsAsSale) result.byWeek[weekKey].sales += qty;
        result.byWeek[weekKey].commission += commission;
        result.byWeek[weekKey].revenue += revenue;
      }

      // By month
      if (groupBy.includes('month')) {
        const monthKey = `${getYear(date)}-${String(getMonth(date) + 1).padStart(2, '0')}`;
        if (countsAsSale) result.byMonth[monthKey].sales += qty;
        result.byMonth[monthKey].commission += commission;
        result.byMonth[monthKey].revenue += revenue;
      }
    }
  }

  // Find top performer
  const employees = Object.entries(result.byEmployee);
  if (employees.length > 0) {
    const [topEmail, topData] = employees.reduce((max, curr) => 
      curr[1].commission > max[1].commission ? curr : max
    );
    result.topPerformer = {
      email: topEmail,
      name: topData.name,
      data: { sales: topData.sales, commission: topData.commission, revenue: topData.revenue },
    };
  }

  return result;
}
