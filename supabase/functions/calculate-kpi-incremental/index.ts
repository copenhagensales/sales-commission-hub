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
interface NewSale {
  id: string;
  agent_email: string | null;
  agent_external_id: string | null;
  sale_datetime: string;
  created_at: string;
}

interface SaleItem {
  sale_id: string;
  quantity: number;
  mapped_commission: number;
  product_id: string | null;
}

interface FmSale {
  id: string;
  product_name: string | null;
  seller_id: string | null;
  registered_at: string;
  created_at: string;
}

interface FmPricingRule {
  product_name: string;
  commission_dkk: number | null;
}

interface Watermark {
  id: string;
  period_type: string;
  scope_type: string;
  scope_id: string | null;
  last_processed_at: string;
}

interface CachedValue {
  kpi_slug: string;
  period_type: string;
  scope_type: string;
  scope_id: string | null;
  value: number;
  formatted_value: string;
  calculated_at: string;
}

// ============= FM COMMISSION MAP (Unified Pricing Service) =============
// Implements two-tier fallback: product_pricing_rules -> products.commission_dkk/revenue_dkk
// This ensures FM products (like Yousee) that don't have pricing rules still get their pricing
async function fetchFmCommissionMap(supabase: SupabaseClient): Promise<Map<string, number>> {
  const fullMap = new Map<string, { commission: number; source: string }>();

  // 1. Load ALL products with base prices FIRST (fallback)
  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("id, name, commission_dkk");

  if (productsError) {
    console.error("[fetchFmCommissionMap] Error fetching products:", productsError);
  }

  // Set base prices from products table
  for (const product of (products || [])) {
    const key = product.name?.toLowerCase();
    if (key && product.commission_dkk !== null) {
      fullMap.set(key, {
        commission: product.commission_dkk || 0,
        source: 'product_base',
      });
    }
  }

  console.log(`[fetchFmCommissionMap] Loaded ${fullMap.size} products with base prices`);

  // 2. Override with active pricing rules (higher priority)
  const { data: rules, error: rulesError } = await supabase
    .from("product_pricing_rules")
    .select(`
      id,
      product:products!inner(name),
      commission_dkk,
      priority
    `)
    .eq("is_active", true)
    .order("priority", { ascending: false, nullsFirst: true });

  if (rulesError) {
    console.error("[fetchFmCommissionMap] Error fetching pricing rules:", rulesError);
  }

  // Track which products have been set by pricing rules
  const rulesApplied = new Set<string>();

  for (const rule of (rules || [])) {
    const productData = rule.product as any;
    const key = productData?.name?.toLowerCase();
    if (key && !rulesApplied.has(key)) {
      fullMap.set(key, {
        commission: rule.commission_dkk || 0,
        source: 'pricing_rule',
      });
      rulesApplied.add(key);
    }
  }

  console.log(`[fetchFmCommissionMap] Applied ${rulesApplied.size} pricing rules. Final map size: ${fullMap.size}`);
  
  // Return simplified map (just commission values) for backwards compatibility
  const result = new Map<string, number>();
  for (const [key, value] of fullMap) {
    result.set(key, value.commission);
  }
  return result;
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
    
    // Define periods we care about for incremental updates
    const todayPeriod = { type: "today", start: getStartOfDay(now), end: now };
    const payrollPeriod = { type: "payroll_period", ...getPayrollPeriod(now) };
    const periods = [todayPeriod, payrollPeriod];

    console.log(`[calculate-kpi-incremental] Starting incremental calculation...`);
    console.log(`[calculate-kpi-incremental] Today: ${todayPeriod.start.toISOString()} - ${todayPeriod.end.toISOString()}`);
    console.log(`[calculate-kpi-incremental] Payroll: ${payrollPeriod.start.toISOString()} - ${payrollPeriod.end.toISOString()}`);

    // ============= READ WATERMARKS =============
    const { data: watermarks } = await supabase
      .from("kpi_watermarks")
      .select("*")
      .in("period_type", ["today", "payroll_period"])
      .eq("scope_type", "employee");

    const watermarkMap = new Map<string, string>();
    for (const wm of (watermarks || []) as Watermark[]) {
      watermarkMap.set(wm.period_type, wm.last_processed_at);
    }

    // Get watermarks (or use period start as default)
    const todayWatermark = watermarkMap.get("today") || todayPeriod.start.toISOString();
    const payrollWatermark = watermarkMap.get("payroll_period") || payrollPeriod.start.toISOString();

    // Check if day changed - reset today watermark
    const lastTodayWatermarkDate = new Date(todayWatermark).toISOString().split("T")[0];
    const currentDate = now.toISOString().split("T")[0];
    const effectiveTodayWatermark = lastTodayWatermarkDate !== currentDate 
      ? todayPeriod.start.toISOString() 
      : todayWatermark;

    // Check if payroll period changed - reset payroll watermark
    const lastPayrollWatermarkDate = new Date(payrollWatermark);
    const effectivePayrollWatermark = lastPayrollWatermarkDate < payrollPeriod.start 
      ? payrollPeriod.start.toISOString() 
      : payrollWatermark;

    console.log(`[calculate-kpi-incremental] Today watermark: ${effectiveTodayWatermark}`);
    console.log(`[calculate-kpi-incremental] Payroll watermark: ${effectivePayrollWatermark}`);

    // ============= FETCH NEW TELESALES =============
    // Get sales created after the older watermark (covers both periods)
    const olderWatermark = effectiveTodayWatermark < effectivePayrollWatermark 
      ? effectiveTodayWatermark 
      : effectivePayrollWatermark;

    const { data: newSales, error: salesError } = await supabase
      .from("sales")
      .select("id, agent_email, agent_external_id, sale_datetime, created_at")
      .gt("created_at", olderWatermark)
      .gte("sale_datetime", payrollPeriod.start.toISOString())
      .lte("sale_datetime", payrollPeriod.end.toISOString())
      .order("created_at", { ascending: true });

    if (salesError) {
      console.error("[calculate-kpi-incremental] Error fetching new sales:", salesError);
      throw salesError;
    }

    console.log(`[calculate-kpi-incremental] Found ${(newSales || []).length} new telesales since watermark`);

    // ============= FETCH NEW FM SALES =============
    const { data: newFmSales, error: fmError } = await supabase
      .from("fieldmarketing_sales")
      .select("id, product_name, seller_id, registered_at, created_at")
      .gt("created_at", olderWatermark)
      .gte("registered_at", payrollPeriod.start.toISOString())
      .lte("registered_at", payrollPeriod.end.toISOString())
      .order("created_at", { ascending: true });

    if (fmError) {
      console.error("[calculate-kpi-incremental] Error fetching new FM sales:", fmError);
    }

    console.log(`[calculate-kpi-incremental] Found ${(newFmSales || []).length} new FM sales since watermark`);

    // If no new sales, just update watermarks and exit
    if ((newSales || []).length === 0 && (newFmSales || []).length === 0) {
      console.log("[calculate-kpi-incremental] No new sales - updating watermarks only");
      
      await upsertWatermarks(supabase, [
        { period_type: "today", scope_type: "employee", scope_id: null, last_processed_at: calculatedAt },
        { period_type: "payroll_period", scope_type: "employee", scope_id: null, last_processed_at: calculatedAt },
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          newSales: 0,
          affectedEmployees: 0,
          updatedKpis: 0,
          durationMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= FETCH SALE ITEMS FOR NEW SALES =============
    const saleIds = (newSales || []).map((s: NewSale) => s.id);
    let saleItemsMap = new Map<string, SaleItem[]>();

    if (saleIds.length > 0) {
      const { data: saleItems } = await supabase
        .from("sale_items")
        .select("sale_id, quantity, mapped_commission, product_id")
        .in("sale_id", saleIds);

      for (const item of (saleItems || []) as SaleItem[]) {
        if (!saleItemsMap.has(item.sale_id)) {
          saleItemsMap.set(item.sale_id, []);
        }
        saleItemsMap.get(item.sale_id)!.push(item);
      }
    }

    // ============= GET PRODUCTS FOR COUNTS_AS_SALE CHECK =============
    const allProductIds = [...new Set(
      Array.from(saleItemsMap.values())
        .flat()
        .map(si => si.product_id)
        .filter(Boolean)
    )] as string[];

    let countingProductIds = new Set<string>();
    if (allProductIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("id, counts_as_sale")
        .in("id", allProductIds);

      countingProductIds = new Set(
        (products || []).filter((p: any) => p.counts_as_sale !== false).map((p: any) => p.id)
      );
    }

    // ============= GET AGENT MAPPINGS =============
    const { data: allAgentMappings } = await supabase
      .from("employee_agent_mapping")
      .select("employee_id, agent_id, agents(email, external_dialer_id)");

    // Build reverse lookup: agent identifier -> employee_id
    const emailToEmployeeMap = new Map<string, string>();
    const externalIdToEmployeeMap = new Map<string, string>();

    for (const mapping of (allAgentMappings || [])) {
      const empId = mapping.employee_id;
      const email = (mapping.agents as any)?.email?.toLowerCase();
      const externalId = (mapping.agents as any)?.external_dialer_id;

      if (email) emailToEmployeeMap.set(email, empId);
      if (externalId) externalIdToEmployeeMap.set(externalId, empId);
    }

    // ============= FM COMMISSION MAP =============
    const fmCommissionMap = await fetchFmCommissionMap(supabase);

    // ============= AGGREGATE DELTAS BY EMPLOYEE AND PERIOD =============
    type EmployeeDelta = { salesCount: number; commission: number };
    type PeriodDeltas = Map<string, EmployeeDelta>; // employee_id -> delta

    const todayDeltas: PeriodDeltas = new Map();
    const payrollDeltas: PeriodDeltas = new Map();

    // Process telesales
    for (const sale of (newSales || []) as NewSale[]) {
      const saleEmail = sale.agent_email?.toLowerCase();
      const saleExternalId = sale.agent_external_id;

      // Find employee
      let employeeId = saleEmail ? emailToEmployeeMap.get(saleEmail) : undefined;
      if (!employeeId && saleExternalId) {
        employeeId = externalIdToEmployeeMap.get(saleExternalId);
      }

      if (!employeeId) continue;

      const saleDate = new Date(sale.sale_datetime);
      const saleCreatedAt = new Date(sale.created_at);
      const items = saleItemsMap.get(sale.id) || [];

      let salesCount = 0;
      let commission = 0;

      for (const item of items) {
        if (!item.product_id || countingProductIds.has(item.product_id)) {
          salesCount += item.quantity || 1;
        }
        commission += item.mapped_commission || 0;
      }

      // If no items, count as 1 sale
      if (items.length === 0) {
        salesCount = 1;
      }

      // Add to today deltas if sale is today AND created after today watermark
      if (saleDate >= todayPeriod.start && saleDate <= todayPeriod.end && saleCreatedAt > new Date(effectiveTodayWatermark)) {
        const current = todayDeltas.get(employeeId) || { salesCount: 0, commission: 0 };
        current.salesCount += salesCount;
        current.commission += commission;
        todayDeltas.set(employeeId, current);
      }

      // Add to payroll deltas if in payroll period AND created after payroll watermark
      if (saleDate >= payrollPeriod.start && saleDate <= payrollPeriod.end && saleCreatedAt > new Date(effectivePayrollWatermark)) {
        const current = payrollDeltas.get(employeeId) || { salesCount: 0, commission: 0 };
        current.salesCount += salesCount;
        current.commission += commission;
        payrollDeltas.set(employeeId, current);
      }
    }

    // Process FM sales
    for (const fmSale of (newFmSales || []) as FmSale[]) {
      const employeeId = fmSale.seller_id;
      if (!employeeId) continue;

      const saleDate = new Date(fmSale.registered_at);
      const saleCreatedAt = new Date(fmSale.created_at);
      const commission = fmCommissionMap.get(fmSale.product_name?.toLowerCase() || "") || 0;

      // Add to today deltas
      if (saleDate >= todayPeriod.start && saleDate <= todayPeriod.end && saleCreatedAt > new Date(effectiveTodayWatermark)) {
        const current = todayDeltas.get(employeeId) || { salesCount: 0, commission: 0 };
        current.salesCount += 1;
        current.commission += commission;
        todayDeltas.set(employeeId, current);
      }

      // Add to payroll deltas
      if (saleDate >= payrollPeriod.start && saleDate <= payrollPeriod.end && saleCreatedAt > new Date(effectivePayrollWatermark)) {
        const current = payrollDeltas.get(employeeId) || { salesCount: 0, commission: 0 };
        current.salesCount += 1;
        current.commission += commission;
        payrollDeltas.set(employeeId, current);
      }
    }

    const affectedEmployeeIds = new Set([...todayDeltas.keys(), ...payrollDeltas.keys()]);
    console.log(`[calculate-kpi-incremental] Affected employees: ${affectedEmployeeIds.size}`);

    if (affectedEmployeeIds.size === 0) {
      console.log("[calculate-kpi-incremental] No employees affected by new sales");
      
      await upsertWatermarks(supabase, [
        { period_type: "today", scope_type: "employee", scope_id: null, last_processed_at: calculatedAt },
        { period_type: "payroll_period", scope_type: "employee", scope_id: null, last_processed_at: calculatedAt },
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          newSales: (newSales || []).length + (newFmSales || []).length,
          affectedEmployees: 0,
          updatedKpis: 0,
          durationMs: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ============= FETCH EXISTING CACHE VALUES FOR AFFECTED EMPLOYEES =============
    const employeeIdsArray = [...affectedEmployeeIds];
    
    const { data: existingCache } = await supabase
      .from("kpi_cached_values")
      .select("kpi_slug, period_type, scope_type, scope_id, value")
      .eq("scope_type", "employee")
      .in("scope_id", employeeIdsArray)
      .in("kpi_slug", ["sales_count", "total_commission"])
      .in("period_type", ["today", "payroll_period"]);

    // Build lookup map
    type CacheKey = string;
    const cacheKey = (slug: string, period: string, empId: string): CacheKey => 
      `${slug}|${period}|${empId}`;

    const existingCacheMap = new Map<CacheKey, number>();
    for (const c of (existingCache || [])) {
      existingCacheMap.set(cacheKey(c.kpi_slug, c.period_type, c.scope_id!), c.value);
    }

    // ============= CALCULATE NEW VALUES =============
    const updatedValues: CachedValue[] = [];

    // Process today deltas
    for (const [empId, delta] of todayDeltas) {
      const existingSales = existingCacheMap.get(cacheKey("sales_count", "today", empId)) || 0;
      const existingCommission = existingCacheMap.get(cacheKey("total_commission", "today", empId)) || 0;

      updatedValues.push({
        kpi_slug: "sales_count",
        period_type: "today",
        scope_type: "employee",
        scope_id: empId,
        value: existingSales + delta.salesCount,
        formatted_value: (existingSales + delta.salesCount).toString(),
        calculated_at: calculatedAt,
      });

      updatedValues.push({
        kpi_slug: "total_commission",
        period_type: "today",
        scope_type: "employee",
        scope_id: empId,
        value: existingCommission + delta.commission,
        formatted_value: formatValue(existingCommission + delta.commission, "commission"),
        calculated_at: calculatedAt,
      });
    }

    // Process payroll deltas
    for (const [empId, delta] of payrollDeltas) {
      const existingSales = existingCacheMap.get(cacheKey("sales_count", "payroll_period", empId)) || 0;
      const existingCommission = existingCacheMap.get(cacheKey("total_commission", "payroll_period", empId)) || 0;

      updatedValues.push({
        kpi_slug: "sales_count",
        period_type: "payroll_period",
        scope_type: "employee",
        scope_id: empId,
        value: existingSales + delta.salesCount,
        formatted_value: (existingSales + delta.salesCount).toString(),
        calculated_at: calculatedAt,
      });

      updatedValues.push({
        kpi_slug: "total_commission",
        period_type: "payroll_period",
        scope_type: "employee",
        scope_id: empId,
        value: existingCommission + delta.commission,
        formatted_value: formatValue(existingCommission + delta.commission, "commission"),
        calculated_at: calculatedAt,
      });
    }

    console.log(`[calculate-kpi-incremental] Upserting ${updatedValues.length} KPI values...`);

    // ============= UPSERT UPDATED CACHE VALUES =============
    if (updatedValues.length > 0) {
      const { error: upsertError } = await supabase
        .from("kpi_cached_values")
        .upsert(updatedValues, {
          onConflict: "kpi_slug,period_type,scope_type,scope_id",
        });

      if (upsertError) {
        console.error("[calculate-kpi-incremental] Error upserting values:", upsertError);
        throw upsertError;
      }
    }

    // ============= UPDATE WATERMARKS =============
    // Find the maximum created_at from processed sales
    let maxTelesaleCreatedAt = olderWatermark;
    for (const sale of (newSales || []) as NewSale[]) {
      if (sale.created_at > maxTelesaleCreatedAt) {
        maxTelesaleCreatedAt = sale.created_at;
      }
    }

    let maxFmSaleCreatedAt = olderWatermark;
    for (const sale of (newFmSales || []) as FmSale[]) {
      if (sale.created_at > maxFmSaleCreatedAt) {
        maxFmSaleCreatedAt = sale.created_at;
      }
    }

    const newWatermark = maxTelesaleCreatedAt > maxFmSaleCreatedAt ? maxTelesaleCreatedAt : maxFmSaleCreatedAt;

    await upsertWatermarks(supabase, [
      { period_type: "today", scope_type: "employee", scope_id: null, last_processed_at: newWatermark },
      { period_type: "payroll_period", scope_type: "employee", scope_id: null, last_processed_at: newWatermark },
    ]);

    const durationMs = Date.now() - startTime;
    console.log(`[calculate-kpi-incremental] Completed in ${durationMs}ms. Updated ${updatedValues.length} KPIs for ${affectedEmployeeIds.size} employees.`);

    return new Response(
      JSON.stringify({
        success: true,
        newSales: (newSales || []).length,
        newFmSales: (newFmSales || []).length,
        affectedEmployees: affectedEmployeeIds.size,
        updatedKpis: updatedValues.length,
        durationMs,
        watermark: newWatermark,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[calculate-kpi-incremental] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message, durationMs: Date.now() - startTime }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ============= HELPER: UPSERT WATERMARKS =============
async function upsertWatermarks(
  supabase: SupabaseClient,
  watermarks: { period_type: string; scope_type: string; scope_id: string | null; last_processed_at: string }[]
) {
  for (const wm of watermarks) {
    const updatedAt = new Date().toISOString();
    
    // Handle NULL scope_id explicitly - Supabase upsert doesn't work with partial indexes on NULL
    if (wm.scope_id === null) {
      // First try to update existing row
      const { data: updateData, error: updateError } = await supabase
        .from("kpi_watermarks")
        .update({ 
          last_processed_at: wm.last_processed_at, 
          updated_at: updatedAt 
        })
        .eq("period_type", wm.period_type)
        .eq("scope_type", wm.scope_type)
        .is("scope_id", null)
        .select();
      
      if (updateError) {
        console.error(`[upsertWatermarks] Update error for ${wm.period_type}:`, updateError);
      }
      
      // If no rows were updated (updateData is empty), insert new row
      if (!updateData || updateData.length === 0) {
        const { error: insertError } = await supabase
          .from("kpi_watermarks")
          .insert({
            period_type: wm.period_type,
            scope_type: wm.scope_type,
            scope_id: null,
            last_processed_at: wm.last_processed_at,
            updated_at: updatedAt,
          });
        
        if (insertError) {
          console.error(`[upsertWatermarks] Insert error for ${wm.period_type}:`, insertError);
        } else {
          console.log(`[upsertWatermarks] Inserted new watermark for ${wm.period_type}`);
        }
      } else {
        console.log(`[upsertWatermarks] Updated watermark for ${wm.period_type} to ${wm.last_processed_at}`);
      }
    } else {
      // Normal upsert for non-null scope_id
      const { error } = await supabase
        .from("kpi_watermarks")
        .upsert({
          period_type: wm.period_type,
          scope_type: wm.scope_type,
          scope_id: wm.scope_id,
          last_processed_at: wm.last_processed_at,
          updated_at: updatedAt,
        }, {
          onConflict: "period_type,scope_type,scope_id",
        });

      if (error) {
        console.error(`[upsertWatermarks] Error upserting watermark for ${wm.period_type}:`, error);
      }
    }
  }
}
