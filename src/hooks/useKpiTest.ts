import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, format } from "date-fns";

export type TestPeriod = "today" | "yesterday" | "this_week" | "this_month" | "last_30_days" | "custom";

export interface TestParams {
  period: TestPeriod;
  clientId?: string;
  teamId?: string;
  customStartDate?: Date;
  customEndDate?: Date;
}

export interface TestResult {
  value: string | number;
  queryTimeMs: number;
  breakdown?: Record<string, number | string>;
  rawQuery?: string;
  rowCount?: number;
}

export function useKpiTest() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const { toast } = useToast();

  const getDateRange = (period: TestPeriod, customStart?: Date, customEnd?: Date) => {
    const now = new Date();
    switch (period) {
      case "today":
        return { start: startOfDay(now), end: endOfDay(now) };
      case "yesterday":
        const yesterday = subDays(now, 1);
        return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
      case "this_week":
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) };
      case "this_month":
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case "last_30_days":
        return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
      case "custom":
        return { 
          start: customStart ? startOfDay(customStart) : startOfDay(now), 
          end: customEnd ? endOfDay(customEnd) : endOfDay(now) 
        };
      default:
        return { start: startOfDay(now), end: endOfDay(now) };
    }
  };

  const runTest = async (slug: string, params: TestParams) => {
    setIsLoading(true);
    setResult(null);
    const startTime = performance.now();

    try {
      const { start, end } = getDateRange(params.period, params.customStartDate, params.customEndDate);

      // Run test based on KPI slug
      let testResult: TestResult;

      switch (slug) {
        case "sales_count":
          testResult = await testSalesCount(start, end, params.clientId);
          break;
        case "total_commission":
          testResult = await testTotalCommission(start, end, params.clientId);
          break;
        case "total_revenue":
          testResult = await testTotalRevenue(start, end, params.clientId);
          break;
        case "active_employees":
          testResult = await testActiveEmployees();
          break;
        case "calls_total":
          testResult = await testCallsTotal(start, end);
          break;
        case "calls_answered":
          testResult = await testCallsAnswered(start, end);
          break;
        default:
          testResult = {
            value: "Test ikke tilgængelig for denne KPI",
            queryTimeMs: 0,
          };
      }

      testResult.queryTimeMs = Math.round(performance.now() - startTime);
      setResult(testResult);
    } catch (error) {
      toast({
        title: "Test fejlede",
        description: error instanceof Error ? error.message : "Ukendt fejl",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { runTest, isLoading, result, clearResult: () => setResult(null) };
}

// ============================================================================
// SALES COUNT - Matches DailyReports logic exactly
// ============================================================================
// Sources: sale_items (via sales) + fieldmarketing_sales
// - sale_items.quantity WHERE products.counts_as_sale != false
// - fieldmarketing_sales: 1 per row
// - No validation_status filter
// ============================================================================
async function testSalesCount(start: Date, end: Date, clientId?: string): Promise<TestResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseKey;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${authToken}`, Accept: "application/json" };

  // === TELESALES ===
  // Build query with optional client filter via client_campaigns
  const joinType = clientId ? "!inner" : "";
  const selectClause = `id,sale_datetime,client_campaign_id,client_campaigns${joinType}(client_id),sale_items(quantity,product_id,products(counts_as_sale))`;
  
  let salesUrl = `${supabaseUrl}/rest/v1/sales?select=${selectClause}`;
  salesUrl += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
  
  if (clientId) {
    salesUrl += `&client_campaigns.client_id=eq.${clientId}`;
  }
  
  const salesRes = await fetch(salesUrl, { headers });
  const salesData = salesRes.ok ? await salesRes.json() : [];
  
  // Count telesales: sum of quantities where counts_as_sale != false
  let telesalesCount = 0;
  let withProductMapping = 0;
  let withoutProductMapping = 0;
  
  salesData.forEach((sale: any) => {
    (sale.sale_items || []).forEach((item: any) => {
      const countsAsSale = item.products?.counts_as_sale !== false;
      if (countsAsSale) {
        telesalesCount += Number(item.quantity) || 1;
      }
      if (item.products) {
        withProductMapping++;
      } else {
        withoutProductMapping++;
      }
    });
  });

  // === FIELDMARKETING ===
  let fmQuery = supabase
    .from("fieldmarketing_sales")
    .select("id", { count: "exact" })
    .gte("registered_at", `${startStr}T00:00:00`)
    .lte("registered_at", `${endStr}T23:59:59`);
  
  if (clientId) {
    fmQuery = fmQuery.eq("client_id", clientId);
  }
  
  const { count: fmCount } = await fmQuery;
  const fieldmarketingCount = fmCount || 0;
  
  const totalSales = telesalesCount + fieldmarketingCount;

  return {
    value: totalSales,
    queryTimeMs: 0,
    breakdown: {
      "Telesales": telesalesCount,
      "Fieldmarketing": fieldmarketingCount,
      "Med produkt-mapping": withProductMapping,
      "Uden produkt-mapping": withoutProductMapping,
      "Antal salg (sales tabel)": salesData.length,
    },
    rowCount: salesData.length + fieldmarketingCount,
  };
}

// ============================================================================
// TOTAL COMMISSION - Matches DailyReports logic exactly
// ============================================================================
// Sources: sale_items + product_campaign_overrides + fieldmarketing_sales
// Priority:
//   1. product_campaign_overrides.commission_dkk (if dialer_campaign matches)
//   2. sale_items.mapped_commission (already includes quantity - DO NOT multiply)
//   3. For FM: products.commission_dkk (matched by product_name)
// ============================================================================
async function testTotalCommission(start: Date, end: Date, clientId?: string): Promise<TestResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseKey;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${authToken}`, Accept: "application/json" };

  // === Fetch campaign mappings for override lookup ===
  const { data: campaignMappings } = await supabase
    .from("adversus_campaign_mappings")
    .select("id, adversus_campaign_id");
  
  const dialerCampaignToMappingId = new Map<string, string>();
  campaignMappings?.forEach(m => {
    if (m.adversus_campaign_id) {
      dialerCampaignToMappingId.set(m.adversus_campaign_id, m.id);
    }
  });

  // === Fetch product campaign overrides ===
  const { data: productCampaignOverrides } = await supabase
    .from("product_campaign_overrides")
    .select("product_id, campaign_mapping_id, commission_dkk, revenue_dkk");
  
  const campaignOverrideMap = new Map<string, { commission: number; revenue: number }>();
  productCampaignOverrides?.forEach(o => {
    const key = `${o.product_id}_${o.campaign_mapping_id}`;
    campaignOverrideMap.set(key, {
      commission: o.commission_dkk ?? 0,
      revenue: o.revenue_dkk ?? 0
    });
  });

  // === TELESALES ===
  const joinType = clientId ? "!inner" : "";
  const selectClause = `id,sale_datetime,dialer_campaign_id,client_campaigns${joinType}(client_id),sale_items(mapped_commission,product_id)`;
  
  let salesUrl = `${supabaseUrl}/rest/v1/sales?select=${selectClause}`;
  salesUrl += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
  
  if (clientId) {
    salesUrl += `&client_campaigns.client_id=eq.${clientId}`;
  }
  
  const salesRes = await fetch(salesUrl, { headers });
  const salesData = salesRes.ok ? await salesRes.json() : [];
  
  let telesalesCommission = 0;
  let withOverride = 0;
  let withMapped = 0;
  
  salesData.forEach((sale: any) => {
    const dialerCampaignId = sale.dialer_campaign_id;
    const campaignMappingId = dialerCampaignId ? dialerCampaignToMappingId.get(dialerCampaignId) : null;
    
    (sale.sale_items || []).forEach((item: any) => {
      const overrideKey = campaignMappingId ? `${item.product_id}_${campaignMappingId}` : null;
      const override = overrideKey ? campaignOverrideMap.get(overrideKey) : null;
      
      if (override) {
        telesalesCommission += override.commission;
        withOverride++;
      } else {
        telesalesCommission += Number(item.mapped_commission) || 0;
        if (item.mapped_commission) withMapped++;
      }
    });
  });

  // === FIELDMARKETING ===
  // Fetch products for FM commission lookup by product_name
  const { data: allProducts } = await supabase
    .from("products")
    .select("id, name, commission_dkk");
  
  // Get campaign overrides - prefer highest commission
  const { data: campaignOverrides } = await supabase
    .from("product_campaign_overrides")
    .select("product_id, commission_dkk");
  
  const overrideByProductId = new Map<string, number>();
  campaignOverrides?.forEach(o => {
    const existing = overrideByProductId.get(o.product_id);
    if (!existing || (o.commission_dkk ?? 0) > existing) {
      overrideByProductId.set(o.product_id, o.commission_dkk ?? 0);
    }
  });
  
  const productCommissionMap = new Map<string, number>();
  allProducts?.forEach(p => {
    if (p.name) {
      const override = overrideByProductId.get(p.id);
      const commission = override ?? p.commission_dkk ?? 0;
      productCommissionMap.set(p.name.toLowerCase(), commission);
    }
  });

  let fmQuery = supabase
    .from("fieldmarketing_sales")
    .select("id, product_name")
    .gte("registered_at", `${startStr}T00:00:00`)
    .lte("registered_at", `${endStr}T23:59:59`);
  
  if (clientId) {
    fmQuery = fmQuery.eq("client_id", clientId);
  }
  
  const { data: fmSales } = await fmQuery;
  
  let fmCommission = 0;
  (fmSales || []).forEach((sale: any) => {
    const productName = (sale.product_name || "").toLowerCase();
    fmCommission += productCommissionMap.get(productName) || 0;
  });

  const totalCommission = telesalesCommission + fmCommission;

  return {
    value: `${Math.round(totalCommission).toLocaleString("da-DK")} DKK`,
    queryTimeMs: 0,
    breakdown: {
      "Telesales provision": `${Math.round(telesalesCommission).toLocaleString("da-DK")} DKK`,
      "Fieldmarketing provision": `${Math.round(fmCommission).toLocaleString("da-DK")} DKK`,
      "Med campaign override": withOverride,
      "Med mapped_commission": withMapped,
      "FM salg": fmSales?.length || 0,
    },
    rowCount: salesData.length + (fmSales?.length || 0),
  };
}

// ============================================================================
// TOTAL REVENUE - Matches DailyReports logic exactly
// ============================================================================
// Same structure as commission, but uses revenue_dkk/mapped_revenue
// ============================================================================
async function testTotalRevenue(start: Date, end: Date, clientId?: string): Promise<TestResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token || supabaseKey;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${authToken}`, Accept: "application/json" };

  // === Fetch campaign mappings for override lookup ===
  const { data: campaignMappings } = await supabase
    .from("adversus_campaign_mappings")
    .select("id, adversus_campaign_id");
  
  const dialerCampaignToMappingId = new Map<string, string>();
  campaignMappings?.forEach(m => {
    if (m.adversus_campaign_id) {
      dialerCampaignToMappingId.set(m.adversus_campaign_id, m.id);
    }
  });

  // === Fetch product campaign overrides ===
  const { data: productCampaignOverrides } = await supabase
    .from("product_campaign_overrides")
    .select("product_id, campaign_mapping_id, commission_dkk, revenue_dkk");
  
  const campaignOverrideMap = new Map<string, { commission: number; revenue: number }>();
  productCampaignOverrides?.forEach(o => {
    const key = `${o.product_id}_${o.campaign_mapping_id}`;
    campaignOverrideMap.set(key, {
      commission: o.commission_dkk ?? 0,
      revenue: o.revenue_dkk ?? 0
    });
  });

  // === TELESALES ===
  const joinType = clientId ? "!inner" : "";
  const selectClause = `id,sale_datetime,dialer_campaign_id,client_campaigns${joinType}(client_id),sale_items(mapped_revenue,product_id)`;
  
  let salesUrl = `${supabaseUrl}/rest/v1/sales?select=${selectClause}`;
  salesUrl += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
  
  if (clientId) {
    salesUrl += `&client_campaigns.client_id=eq.${clientId}`;
  }
  
  const salesRes = await fetch(salesUrl, { headers });
  const salesData = salesRes.ok ? await salesRes.json() : [];
  
  let telesalesRevenue = 0;
  let withOverride = 0;
  let withMapped = 0;
  
  salesData.forEach((sale: any) => {
    const dialerCampaignId = sale.dialer_campaign_id;
    const campaignMappingId = dialerCampaignId ? dialerCampaignToMappingId.get(dialerCampaignId) : null;
    
    (sale.sale_items || []).forEach((item: any) => {
      const overrideKey = campaignMappingId ? `${item.product_id}_${campaignMappingId}` : null;
      const override = overrideKey ? campaignOverrideMap.get(overrideKey) : null;
      
      if (override) {
        telesalesRevenue += override.revenue;
        withOverride++;
      } else {
        telesalesRevenue += Number(item.mapped_revenue) || 0;
        if (item.mapped_revenue) withMapped++;
      }
    });
  });

  // === FIELDMARKETING ===
  const { data: allProducts } = await supabase
    .from("products")
    .select("id, name, revenue_dkk");
  
  const { data: campaignOverrides } = await supabase
    .from("product_campaign_overrides")
    .select("product_id, revenue_dkk");
  
  const overrideByProductId = new Map<string, number>();
  campaignOverrides?.forEach(o => {
    const existing = overrideByProductId.get(o.product_id);
    if (!existing || (o.revenue_dkk ?? 0) > existing) {
      overrideByProductId.set(o.product_id, o.revenue_dkk ?? 0);
    }
  });
  
  const productRevenueMap = new Map<string, number>();
  allProducts?.forEach(p => {
    if (p.name) {
      const override = overrideByProductId.get(p.id);
      const revenue = override ?? p.revenue_dkk ?? 0;
      productRevenueMap.set(p.name.toLowerCase(), revenue);
    }
  });

  let fmQuery = supabase
    .from("fieldmarketing_sales")
    .select("id, product_name")
    .gte("registered_at", `${startStr}T00:00:00`)
    .lte("registered_at", `${endStr}T23:59:59`);
  
  if (clientId) {
    fmQuery = fmQuery.eq("client_id", clientId);
  }
  
  const { data: fmSales } = await fmQuery;
  
  let fmRevenue = 0;
  (fmSales || []).forEach((sale: any) => {
    const productName = (sale.product_name || "").toLowerCase();
    fmRevenue += productRevenueMap.get(productName) || 0;
  });

  const totalRevenue = telesalesRevenue + fmRevenue;

  return {
    value: `${Math.round(totalRevenue).toLocaleString("da-DK")} DKK`,
    queryTimeMs: 0,
    breakdown: {
      "Telesales omsætning": `${Math.round(telesalesRevenue).toLocaleString("da-DK")} DKK`,
      "Fieldmarketing omsætning": `${Math.round(fmRevenue).toLocaleString("da-DK")} DKK`,
      "Med campaign override": withOverride,
      "Med mapped_revenue": withMapped,
      "FM salg": fmSales?.length || 0,
    },
    rowCount: salesData.length + (fmSales?.length || 0),
  };
}

// ============================================================================
// ACTIVE EMPLOYEES
// ============================================================================
async function testActiveEmployees(): Promise<TestResult> {
  const { data, error, count } = await supabase
    .from("employee_master_data")
    .select("id, job_title", { count: "exact" })
    .eq("is_active", true);

  if (error) throw error;

  // Group by job_title for breakdown
  const byTitle: Record<string, number> = {};
  (data || []).forEach((emp: any) => {
    const title = emp.job_title || "Uden titel";
    byTitle[title] = (byTitle[title] || 0) + 1;
  });

  return {
    value: count || 0,
    queryTimeMs: 0,
    breakdown: byTitle,
    rowCount: count || 0,
  };
}

// ============================================================================
// CALLS TOTAL
// ============================================================================
async function testCallsTotal(start: Date, end: Date): Promise<TestResult> {
  const { count, error } = await supabase
    .from("dialer_calls")
    .select("id", { count: "exact", head: true })
    .gte("call_datetime", start.toISOString())
    .lte("call_datetime", end.toISOString());

  if (error) throw error;

  return {
    value: count || 0,
    queryTimeMs: 0,
    rowCount: count || 0,
  };
}

// ============================================================================
// CALLS ANSWERED
// ============================================================================
async function testCallsAnswered(start: Date, end: Date): Promise<TestResult> {
  const { count, error } = await supabase
    .from("dialer_calls")
    .select("id", { count: "exact", head: true })
    .gte("call_datetime", start.toISOString())
    .lte("call_datetime", end.toISOString())
    .gt("duration_seconds", 0);

  if (error) throw error;

  return {
    value: count || 0,
    queryTimeMs: 0,
    rowCount: count || 0,
  };
}
