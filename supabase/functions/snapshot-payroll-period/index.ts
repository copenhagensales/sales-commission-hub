import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============= DATE HELPERS (same as calculate-kpi-incremental) =============
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

function getPreviousPayrollPeriod(date: Date): { start: Date; end: Date } {
  const current = getPayrollPeriod(date);
  // Go back one day from the current period start to land in the previous period
  const prevDate = new Date(current.start);
  prevDate.setDate(prevDate.getDate() - 1);
  return getPayrollPeriod(prevDate);
}

function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
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

interface SnapshotValue {
  kpi_slug: string;
  period_key: string;
  period_start: string;
  period_end: string;
  scope_type: string;
  scope_id: string | null;
  value: number;
  formatted_value: string;
  snapshotted_at: string;
}

// ============= PAGINATED FETCH (same logic as calculate-kpi-incremental) =============
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
      console.error(`[snapshot] Error page ${page}:`, error);
      break;
    }
    if (!data || data.length === 0) break;
    allSales.push(...(data as SaleWithItems[]));
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  return allSales;
}

// ============= MAIN =============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for optional overrides
    let body: any = {};
    try { body = await req.json(); } catch { /* no body */ }

    const now = new Date();

    // Determine which period to snapshot
    // Default: the previous payroll period (the one that just ended)
    // Override: pass period_start and period_end as ISO date strings
    let periodStart: Date;
    let periodEnd: Date;

    if (body.period_start && body.period_end) {
      periodStart = new Date(body.period_start);
      periodEnd = new Date(body.period_end);
      periodEnd.setHours(23, 59, 59);
    } else {
      const prev = getPreviousPayrollPeriod(now);
      periodStart = prev.start;
      periodEnd = prev.end;
    }

    const periodKey = `payroll_${toDateString(periodStart)}`;
    const periodStartStr = toDateString(periodStart);
    const periodEndStr = toDateString(periodEnd);

    console.log(`[snapshot] Snapshotting period: ${periodKey} (${periodStartStr} - ${periodEndStr})`);

    // Check if snapshot already exists (unless force=true)
    if (!body.force) {
      const { data: existing } = await supabase
        .from("kpi_period_snapshots")
        .select("id")
        .eq("period_key", periodKey)
        .limit(1);

      if (existing && existing.length > 0) {
        console.log(`[snapshot] Period ${periodKey} already snapshotted. Use force=true to overwrite.`);
        return new Response(
          JSON.stringify({ success: true, skipped: true, reason: "already_exists", periodKey }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ============= FETCH REFERENCE DATA =============
    const [campaignsResult, agentMappingsResult, productsResult, clientsResult] = await Promise.all([
      supabase.from("client_campaigns").select("id, client_id"),
      supabase.from("employee_agent_mapping").select("employee_id, agent_id, agents(email, external_dialer_id)"),
      supabase.from("products").select("id, counts_as_sale"),
      supabase.from("clients").select("id, name"),
    ]);

    const campaignToClient = new Map<string, string>();
    for (const c of (campaignsResult.data || [])) {
      campaignToClient.set(c.id, c.client_id);
    }

    const emailToEmployee = new Map<string, string>();
    const externalIdToEmployee = new Map<string, string>();
    for (const m of (agentMappingsResult.data || [])) {
      const email = (m.agents as any)?.email?.toLowerCase();
      const extId = (m.agents as any)?.external_dialer_id;
      if (email) emailToEmployee.set(email, m.employee_id);
      if (extId) externalIdToEmployee.set(extId, m.employee_id);
    }

    const countingProductIds = new Set<string>(
      (productsResult.data || [])
        .filter((p: any) => p.counts_as_sale !== false)
        .map((p: any) => p.id)
    );

    const clientIds = (clientsResult.data || []).map((c: any) => c.id);

    // ============= FETCH SALES FOR THE PERIOD =============
    const allSales = await fetchAllSalesWithItems(
      supabase,
      periodStart.toISOString(),
      periodEnd.toISOString()
    );

    console.log(`[snapshot] Found ${allSales.length} sales in period`);

    // ============= AGGREGATE (same logic as calculate-kpi-incremental) =============
    const empSales = new Map<string, number>();
    const empCommission = new Map<string, number>();
    const clientSales = new Map<string, number>();
    const clientCommission = new Map<string, number>();
    const clientRevenue = new Map<string, number>();
    let globalSales = 0;
    let globalCommission = 0;
    let globalRevenue = 0;

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

      const clientId = sale.client_campaign_id
        ? campaignToClient.get(sale.client_campaign_id) || null
        : null;

      const email = sale.agent_email?.toLowerCase();
      const extId = sale.agent_external_id;
      const employeeId = (email ? emailToEmployee.get(email) : undefined)
        || (extId ? externalIdToEmployee.get(extId) : undefined);

      if (employeeId) {
        empSales.set(employeeId, (empSales.get(employeeId) || 0) + saleCount);
        empCommission.set(employeeId, (empCommission.get(employeeId) || 0) + commission);
      }

      if (clientId) {
        clientSales.set(clientId, (clientSales.get(clientId) || 0) + saleCount);
        clientCommission.set(clientId, (clientCommission.get(clientId) || 0) + commission);
        clientRevenue.set(clientId, (clientRevenue.get(clientId) || 0) + revenue);
      }

      globalSales += saleCount;
      globalCommission += commission;
      globalRevenue += revenue;
    }

    // ============= BUILD SNAPSHOT VALUES =============
    const snapshotValues: SnapshotValue[] = [];
    const snapshotTime = now.toISOString();

    // Global scope
    snapshotValues.push(
      { kpi_slug: "sales_count", period_key: periodKey, period_start: periodStartStr, period_end: periodEndStr, scope_type: "global", scope_id: null, value: globalSales, formatted_value: formatValue(globalSales, "count"), snapshotted_at: snapshotTime },
      { kpi_slug: "total_commission", period_key: periodKey, period_start: periodStartStr, period_end: periodEndStr, scope_type: "global", scope_id: null, value: globalCommission, formatted_value: formatValue(globalCommission, "commission"), snapshotted_at: snapshotTime },
      { kpi_slug: "total_revenue", period_key: periodKey, period_start: periodStartStr, period_end: periodEndStr, scope_type: "global", scope_id: null, value: globalRevenue, formatted_value: formatValue(globalRevenue, "revenue"), snapshotted_at: snapshotTime },
    );

    // Client scope
    for (const cid of clientIds) {
      const sales = clientSales.get(cid) || 0;
      const comm = clientCommission.get(cid) || 0;
      const rev = clientRevenue.get(cid) || 0;

      snapshotValues.push(
        { kpi_slug: "sales_count", period_key: periodKey, period_start: periodStartStr, period_end: periodEndStr, scope_type: "client", scope_id: cid, value: sales, formatted_value: formatValue(sales, "count"), snapshotted_at: snapshotTime },
        { kpi_slug: "total_commission", period_key: periodKey, period_start: periodStartStr, period_end: periodEndStr, scope_type: "client", scope_id: cid, value: comm, formatted_value: formatValue(comm, "commission"), snapshotted_at: snapshotTime },
        { kpi_slug: "total_revenue", period_key: periodKey, period_start: periodStartStr, period_end: periodEndStr, scope_type: "client", scope_id: cid, value: rev, formatted_value: formatValue(rev, "revenue"), snapshotted_at: snapshotTime },
      );
    }

    // Employee scope
    for (const [empId, sales] of empSales) {
      snapshotValues.push({
        kpi_slug: "sales_count",
        period_key: periodKey,
        period_start: periodStartStr,
        period_end: periodEndStr,
        scope_type: "employee",
        scope_id: empId,
        value: sales,
        formatted_value: sales.toString(),
        snapshotted_at: snapshotTime,
      });
    }

    for (const [empId, comm] of empCommission) {
      snapshotValues.push({
        kpi_slug: "total_commission",
        period_key: periodKey,
        period_start: periodStartStr,
        period_end: periodEndStr,
        scope_type: "employee",
        scope_id: empId,
        value: comm,
        formatted_value: formatValue(comm, "commission"),
        snapshotted_at: snapshotTime,
      });
    }

    // ============= UPSERT IN BATCHES =============
    console.log(`[snapshot] Upserting ${snapshotValues.length} snapshot values...`);

    const BATCH_SIZE = 200;
    let upsertErrors = 0;

    // If force, delete existing first
    if (body.force) {
      await supabase
        .from("kpi_period_snapshots")
        .delete()
        .eq("period_key", periodKey);
    }

    for (let i = 0; i < snapshotValues.length; i += BATCH_SIZE) {
      const batch = snapshotValues.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("kpi_period_snapshots")
        .upsert(batch, { onConflict: "kpi_slug,period_key,scope_type,scope_id" });

      if (error) {
        console.error(`[snapshot] Upsert error batch ${i / BATCH_SIZE}:`, error);
        upsertErrors++;
      }
    }

    const durationMs = Date.now() - startTime;
    console.log(`[snapshot] Done in ${durationMs}ms. ${snapshotValues.length} values, ${upsertErrors} errors.`);

    return new Response(
      JSON.stringify({
        success: true,
        periodKey,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        totalSales: allSales.length,
        totalValues: snapshotValues.length,
        upsertErrors,
        durationMs,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[snapshot] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", durationMs: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
