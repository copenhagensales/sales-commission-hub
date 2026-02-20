import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= DATE HELPERS =============
function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPayrollPeriod(date: Date): { start: Date; end: Date } {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  if (day >= 15) {
    return {
      start: new Date(year, month, 15),
      end: new Date(year, month + 1, 14, 23, 59, 59),
    };
  } else {
    return {
      start: new Date(year, month - 1, 15),
      end: new Date(year, month, 14, 23, 59, 59),
    };
  }
}

function formatValue(value: number, category: string): string {
  if (category === "revenue" || category === "commission") {
    return new Intl.NumberFormat("da-DK", {
      style: "currency",
      currency: "DKK",
      maximumFractionDigits: 0,
    }).format(value);
  }
  return new Intl.NumberFormat("da-DK").format(value);
}

// ============= TYPES =============
interface CachedValue {
  kpi_slug: string;
  period_type: string;
  scope_type: string;
  scope_id: string | null;
  value: number;
  formatted_value: string;
  calculated_at: string;
}

interface SaleWithItems {
  id: string;
  agent_email: string | null;
  agent_external_id: string | null;
  sale_datetime: string;
  client_campaign_id: string | null;
  source: string | null;
  sale_items: {
    quantity: number;
    mapped_commission: number;
    mapped_revenue: number;
    product_id: string | null;
  }[];
}

// ============= UNIFIED PAGINATED FETCH =============
// FM sales now have sale_items via trigger, so we fetch ALL sources uniformly
async function fetchAllSalesWithItems(
  supabase: SupabaseClient,
  startStr: string,
  endStr: string
): Promise<SaleWithItems[]> {
  const PAGE_SIZE = 500;
  const allSales: SaleWithItems[] = [];
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from("sales")
      .select("id, agent_email, agent_external_id, sale_datetime, client_campaign_id, source, sale_items(quantity, mapped_commission, mapped_revenue, product_id)")
      .neq("validation_status", "rejected")
      .gte("sale_datetime", startStr)
      .lte("sale_datetime", endStr)
      .order("sale_datetime", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) {
      console.error(`[fetchAllSales] Error page ${page}:`, error);
      break;
    }
    if (!data || data.length === 0) break;
    allSales.push(...(data as SaleWithItems[]));
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return allSales;
}

// ============= MAIN FUNCTION =============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const calculatedAt = now.toISOString();

    // Periods to calculate
    const periods = [
      { type: "today", start: getStartOfDay(now), end: now },
      { type: "this_week", start: getStartOfWeek(now), end: now },
      { type: "payroll_period", ...getPayrollPeriod(now) },
    ];

    console.log(`[kpi-incremental] Starting absolute-count calculation...`);

    // ============= FETCH REFERENCE DATA IN PARALLEL =============
    const [
      campaignsResult,
      agentMappingsResult,
      productsResult,
      clientsResult,
    ] = await Promise.all([
      supabase.from("client_campaigns").select("id, client_id"),
      supabase.from("employee_agent_mapping").select("employee_id, agent_id, agents(email, external_dialer_id)"),
      supabase.from("products").select("id, counts_as_sale"),
      supabase.from("clients").select("id, name"),
    ]);

    // Build campaign -> client_id map
    const campaignToClient = new Map<string, string>();
    for (const c of (campaignsResult.data || [])) {
      campaignToClient.set(c.id, c.client_id);
    }

    // Build agent identifier -> employee_id maps
    const emailToEmployee = new Map<string, string>();
    const externalIdToEmployee = new Map<string, string>();
    for (const m of (agentMappingsResult.data || [])) {
      const email = (m.agents as any)?.email?.toLowerCase();
      const extId = (m.agents as any)?.external_dialer_id;
      if (email) emailToEmployee.set(email, m.employee_id);
      if (extId) externalIdToEmployee.set(extId, m.employee_id);
    }

    // Build counting products set
    const countingProductIds = new Set<string>(
      (productsResult.data || [])
        .filter((p: any) => p.counts_as_sale !== false)
        .map((p: any) => p.id)
    );

    const clientIds = (clientsResult.data || []).map((c: any) => c.id);

    // ============= PROCESS EACH PERIOD =============
    const allValues: CachedValue[] = [];

    for (const period of periods) {
      const startStr = period.start.toISOString();
      const endStr = period.end.toISOString();

      console.log(`[kpi-incremental] Processing period ${period.type}: ${startStr} - ${endStr}`);

      // Fetch all sales (TM + FM unified via sale_items)
      const allSales = await fetchAllSalesWithItems(supabase, startStr, endStr);

      console.log(`[kpi-incremental] ${period.type}: ${allSales.length} total sales`);

      // ============= AGGREGATE =============
      const empSales = new Map<string, number>();
      const empCommission = new Map<string, number>();
      const clientSales = new Map<string, number>();
      const clientCommission = new Map<string, number>();
      const clientRevenue = new Map<string, number>();
      let globalSales = 0;
      let globalCommission = 0;
      let globalRevenue = 0;

      // Process all sales uniformly (TM and FM both have sale_items now)
      for (const sale of allSales) {
        const items = sale.sale_items || [];
        let saleCount = 0;
        let commission = 0;
        let revenue = 0;

        if (items.length > 0) {
          for (const item of items) {
            if (!item.product_id || countingProductIds.has(item.product_id)) {
              saleCount += item.quantity || 1;
            }
            commission += item.mapped_commission || 0;
            revenue += item.mapped_revenue || 0;
          }
        } else {
          saleCount = 1;
        }

        // Resolve client_id
        const clientId = sale.client_campaign_id
          ? campaignToClient.get(sale.client_campaign_id) || null
          : null;

        // Resolve employee_id
        const email = sale.agent_email?.toLowerCase();
        const extId = sale.agent_external_id;
        const employeeId = (email ? emailToEmployee.get(email) : undefined)
          || (extId ? externalIdToEmployee.get(extId) : undefined);

        // Employee aggregation
        if (employeeId) {
          empSales.set(employeeId, (empSales.get(employeeId) || 0) + saleCount);
          empCommission.set(employeeId, (empCommission.get(employeeId) || 0) + commission);
        }

        // Client aggregation
        if (clientId) {
          clientSales.set(clientId, (clientSales.get(clientId) || 0) + saleCount);
          clientCommission.set(clientId, (clientCommission.get(clientId) || 0) + commission);
          clientRevenue.set(clientId, (clientRevenue.get(clientId) || 0) + revenue);
        }

        // Global aggregation
        globalSales += saleCount;
        globalCommission += commission;
        globalRevenue += revenue;
      }

      // ============= BUILD CACHED VALUES =============

      // Count unique sellers with data in this period
      const sellersWithData = empSales.size;

      // Global scope
      allValues.push(
        { kpi_slug: "sales_count", period_type: period.type, scope_type: "global", scope_id: null, value: globalSales, formatted_value: formatValue(globalSales, "count"), calculated_at: calculatedAt },
        { kpi_slug: "total_commission", period_type: period.type, scope_type: "global", scope_id: null, value: globalCommission, formatted_value: formatValue(globalCommission, "commission"), calculated_at: calculatedAt },
        { kpi_slug: "total_revenue", period_type: period.type, scope_type: "global", scope_id: null, value: globalRevenue, formatted_value: formatValue(globalRevenue, "revenue"), calculated_at: calculatedAt },
        { kpi_slug: "sellers_with_data", period_type: period.type, scope_type: "global", scope_id: null, value: sellersWithData, formatted_value: formatValue(sellersWithData, "count"), calculated_at: calculatedAt },
      );

      // Client scope
      for (const cid of clientIds) {
        const sales = clientSales.get(cid) || 0;
        const comm = clientCommission.get(cid) || 0;
        const rev = clientRevenue.get(cid) || 0;

        allValues.push(
          { kpi_slug: "sales_count", period_type: period.type, scope_type: "client", scope_id: cid, value: sales, formatted_value: formatValue(sales, "count"), calculated_at: calculatedAt },
          { kpi_slug: "antal_salg", period_type: period.type, scope_type: "client", scope_id: cid, value: sales, formatted_value: formatValue(sales, "count"), calculated_at: calculatedAt },
          { kpi_slug: "total_commission", period_type: period.type, scope_type: "client", scope_id: cid, value: comm, formatted_value: formatValue(comm, "commission"), calculated_at: calculatedAt },
          { kpi_slug: "total_provision", period_type: period.type, scope_type: "client", scope_id: cid, value: comm, formatted_value: formatValue(comm, "commission"), calculated_at: calculatedAt },
          { kpi_slug: "total_revenue", period_type: period.type, scope_type: "client", scope_id: cid, value: rev, formatted_value: formatValue(rev, "revenue"), calculated_at: calculatedAt },
        );
      }

      // Employee scope (only today + payroll_period to keep volume manageable)
      if (period.type === "today" || period.type === "payroll_period") {
        for (const [empId, sales] of empSales) {
          allValues.push({
            kpi_slug: "sales_count",
            period_type: period.type,
            scope_type: "employee",
            scope_id: empId,
            value: sales,
            formatted_value: sales.toString(),
            calculated_at: calculatedAt,
          });
        }

        for (const [empId, comm] of empCommission) {
          allValues.push({
            kpi_slug: "total_commission",
            period_type: period.type,
            scope_type: "employee",
            scope_id: empId,
            value: comm,
            formatted_value: formatValue(comm, "commission"),
            calculated_at: calculatedAt,
          });
        }
      }
    }

    // ============= UPSERT ALL VALUES IN BATCHES =============
    console.log(`[kpi-incremental] Upserting ${allValues.length} KPI values...`);

    const BATCH_SIZE = 200;
    let upsertErrors = 0;
    for (let i = 0; i < allValues.length; i += BATCH_SIZE) {
      const batch = allValues.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("kpi_cached_values")
        .upsert(batch, { onConflict: "kpi_slug,period_type,scope_type,scope_id" });

      if (error) {
        console.error(`[kpi-incremental] Upsert error batch ${i / BATCH_SIZE}:`, error);
        upsertErrors++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[kpi-incremental] Done in ${durationMs}ms. ${allValues.length} values, ${upsertErrors} errors.`);

    return new Response(
      JSON.stringify({
        success: true,
        totalValues: allValues.length,
        periods: periods.map(p => p.type),
        upsertErrors,
        durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[kpi-incremental] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", durationMs: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
