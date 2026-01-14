import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, format } from "date-fns";

export type TestPeriod = "today" | "yesterday" | "this_week" | "this_month" | "last_30_days" | "custom";

export interface TestParams {
  period: TestPeriod;
  clientId?: string;
  teamId?: string;
  employeeId?: string;
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
        case "shifts":
          testResult = await testNormalShifts(start, end, params.employeeId);
          break;
        case "sick_days":
          testResult = await testSickDays(start, end, params.employeeId);
          break;
        case "vacation_days":
          testResult = await testVacationDays(start, end, params.employeeId);
          break;
        case "all_shift_types":
          testResult = await testAllShiftTypes(start, end, params.employeeId);
          break;
        case "lateness_days":
          testResult = await testLatenessDays(start, end, params.employeeId);
          break;
        case "day_off_days":
          testResult = await testDayOffDays(start, end, params.employeeId);
          break;
        case "all_hours":
          testResult = await testAllHours(start, end, params.employeeId);
          break;
        case "sales_hours":
          testResult = await testSalesHours(start, end, params.employeeId);
          break;
        case "vacation_hours":
          testResult = await testVacationHours(start, end, params.employeeId);
          break;
        case "sick_hours":
          testResult = await testSickHours(start, end, params.employeeId);
          break;
        case "day_off_hours":
          testResult = await testDayOffHours(start, end, params.employeeId);
          break;
        case "lateness_hours":
          testResult = await testLatenessHours(start, end, params.employeeId);
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

// ============================================================================
// NORMAL SHIFTS - Alm. vagt
// ============================================================================
// En normal vagt er en dag hvor:
// 1. Der eksisterer en vagt fra hierarkiet (shift → employee_standard_shifts → team_standard_shifts)
// 2. Der IKKE er registreret godkendt fravær (sygdom/ferie) på datoen
// ============================================================================
async function testNormalShifts(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  // Generate all dates in period
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(format(current, "yyyy-MM-dd"));
    current.setDate(current.getDate() + 1);
  }

  // Get employees to check
  let employeesToCheck: { id: string; team_id: string | null }[] = [];
  
  if (employeeId) {
    const { data: emp } = await supabase
      .from("employee_master_data")
      .select("id, team_id")
      .eq("id", employeeId)
      .single();
    if (emp) employeesToCheck = [emp];
  } else {
    const { data: emps } = await supabase
      .from("employee_master_data")
      .select("id, team_id")
      .eq("is_active", true);
    employeesToCheck = emps || [];
  }

  if (employeesToCheck.length === 0) {
    return { value: 0, queryTimeMs: 0, breakdown: { "Ingen medarbejdere fundet": 0 } };
  }

  const employeeIds = employeesToCheck.map(e => e.id);

  // Fetch all shift sources in parallel
  const [
    individualShiftsRes,
    employeeStandardShiftsRes,
    teamMembersRes,
    teamStandardShiftsRes,
    shiftDaysRes,
    absencesRes
  ] = await Promise.all([
    // 1. Individual shifts (shift table)
    supabase
      .from("shift")
      .select("employee_id, date")
      .in("employee_id", employeeIds)
      .gte("date", startStr)
      .lte("date", endStr),
    
    // 2. Employee standard shifts (links to team_standard_shifts via shift_id)
    supabase
      .from("employee_standard_shifts")
      .select("employee_id, shift_id")
      .in("employee_id", employeeIds),
    
    // 3. Team members (for team-level shifts)
    supabase
      .from("team_members")
      .select("employee_id, team_id")
      .in("employee_id", employeeIds),
    
    // 4. Team standard shifts (active shifts)
    supabase
      .from("team_standard_shifts")
      .select("id, team_id, is_active"),
    
    // 5. Team standard shift days (day_of_week per shift)
    supabase
      .from("team_standard_shift_days")
      .select("shift_id, day_of_week"),
    
    // 6. Approved absences (sick/vacation)
    supabase
      .from("absence_request_v2")
      .select("employee_id, start_date, end_date, type")
      .in("employee_id", employeeIds)
      .eq("status", "approved")
      .in("type", ["sick", "vacation"])
      .lte("start_date", endStr)
      .gte("end_date", startStr)
  ]);

  const individualShifts = individualShiftsRes.data || [];
  const employeeStandardShifts = employeeStandardShiftsRes.data || [];
  const teamMembers = teamMembersRes.data || [];
  const teamStandardShifts = teamStandardShiftsRes.data || [];
  const shiftDays = shiftDaysRes.data || [];
  const absences = absencesRes.data || [];

  // Build shift_id -> days map
  const shiftDaysMap = new Map<string, number[]>();
  shiftDays.forEach(sd => {
    if (!shiftDaysMap.has(sd.shift_id)) {
      shiftDaysMap.set(sd.shift_id, []);
    }
    shiftDaysMap.get(sd.shift_id)!.push(sd.day_of_week);
  });

  // Build team -> active shift_id map
  const teamActiveShiftMap = new Map<string, string>();
  teamStandardShifts.forEach(s => {
    if (s.is_active) {
      teamActiveShiftMap.set(s.team_id, s.id);
    }
  });

  // Build lookup maps
  const individualShiftMap = new Map<string, Set<string>>();
  individualShifts.forEach(s => {
    if (!individualShiftMap.has(s.employee_id)) {
      individualShiftMap.set(s.employee_id, new Set());
    }
    individualShiftMap.get(s.employee_id)!.add(s.date);
  });

  // Employee -> their standard shift_id
  const employeeShiftIdMap = new Map<string, string>();
  employeeStandardShifts.forEach(s => {
    employeeShiftIdMap.set(s.employee_id, s.shift_id);
  });

  const employeeTeamMap = new Map<string, string>();
  teamMembers.forEach(m => {
    if (m.team_id) employeeTeamMap.set(m.employee_id, m.team_id);
  });

  // Build absence date sets per employee
  const absenceDateMap = new Map<string, Set<string>>();
  absences.forEach(a => {
    if (!absenceDateMap.has(a.employee_id)) {
      absenceDateMap.set(a.employee_id, new Set());
    }
    // Add all dates in absence range
    const absStart = new Date(a.start_date);
    const absEnd = new Date(a.end_date);
    const current = new Date(absStart);
    while (current <= absEnd) {
      absenceDateMap.get(a.employee_id)!.add(format(current, "yyyy-MM-dd"));
      current.setDate(current.getDate() + 1);
    }
  });

  // Count shifts
  let totalShifts = 0;
  let individualCount = 0;
  let standardCount = 0;
  let teamCount = 0;
  let absenceExcluded = 0;

  for (const employee of employeesToCheck) {
    const empId = employee.id;
    const teamId = employeeTeamMap.get(empId) || employee.team_id;
    const absenceDates = absenceDateMap.get(empId) || new Set();
    const individualDates = individualShiftMap.get(empId) || new Set();
    
    // Employee standard shift days
    const empShiftId = employeeShiftIdMap.get(empId);
    const empStandardDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;
    
    // Team primary shift days
    const teamActiveShiftId = teamId ? teamActiveShiftMap.get(teamId) : undefined;
    const teamDays = teamActiveShiftId ? shiftDaysMap.get(teamActiveShiftId) : undefined;

    for (const dateStr of dates) {
      // Check absence first
      if (absenceDates.has(dateStr)) {
        absenceExcluded++;
        continue;
      }

      const dayOfWeek = new Date(dateStr).getDay(); // 0=Sunday, 1=Monday, etc.
      const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek; // Convert to 1=Monday, 7=Sunday

      // Check hierarchy: individual → employee standard → team standard
      if (individualDates.has(dateStr)) {
        totalShifts++;
        individualCount++;
      } else if (empStandardDays !== undefined) {
        // Has employee-specific standard shift
        if (empStandardDays.includes(dayNumber)) {
          totalShifts++;
          standardCount++;
        }
      } else if (teamDays && teamDays.includes(dayNumber)) {
        totalShifts++;
        teamCount++;
      }
    }
  }

  return {
    value: totalShifts,
    queryTimeMs: 0,
    breakdown: {
      "Individuelle vagter": individualCount,
      "Medarbejder-standardvagter": standardCount,
      "Team-vagter": teamCount,
      "Fraværsdage ekskluderet": absenceExcluded,
      "Antal medarbejdere": employeesToCheck.length,
      "Antal dage i periode": dates.length,
    },
    rowCount: totalShifts,
  };
}

// ============================================================================
// SICK DAYS - Sygedage
// ============================================================================
// En sygedag KRÆVER at der er en planlagt vagt på datoen
// Kun godkendte fraværsanmodninger (status = 'approved') tælles
// Alle sygedage tælles som hele dage (ingen halve sygedage)
// ============================================================================
async function testSickDays(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  // Generate all dates in period
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(format(current, "yyyy-MM-dd"));
    current.setDate(current.getDate() + 1);
  }

  // Get employees to check
  let employeesToCheck: { id: string; team_id: string | null }[] = [];
  
  if (employeeId) {
    const { data: emp } = await supabase
      .from("employee_master_data")
      .select("id, team_id")
      .eq("id", employeeId)
      .single();
    if (emp) employeesToCheck = [emp];
  } else {
    const { data: emps } = await supabase
      .from("employee_master_data")
      .select("id, team_id")
      .eq("is_active", true);
    employeesToCheck = emps || [];
  }

  if (employeesToCheck.length === 0) {
    return { value: 0, queryTimeMs: 0, breakdown: { "Ingen medarbejdere fundet": 0 } };
  }

  const employeeIds = employeesToCheck.map(e => e.id);

  // Fetch all shift sources and sick absences in parallel
  const [
    individualShiftsRes,
    employeeStandardShiftsRes,
    teamMembersRes,
    teamStandardShiftsRes,
    shiftDaysRes,
    sickAbsencesRes
  ] = await Promise.all([
    // 1. Individual shifts (shift table)
    supabase
      .from("shift")
      .select("employee_id, date")
      .in("employee_id", employeeIds)
      .gte("date", startStr)
      .lte("date", endStr),
    
    // 2. Employee standard shifts
    supabase
      .from("employee_standard_shifts")
      .select("employee_id, shift_id")
      .in("employee_id", employeeIds),
    
    // 3. Team members
    supabase
      .from("team_members")
      .select("employee_id, team_id")
      .in("employee_id", employeeIds),
    
    // 4. Team standard shifts (active shifts)
    supabase
      .from("team_standard_shifts")
      .select("id, team_id, is_active"),
    
    // 5. Team standard shift days
    supabase
      .from("team_standard_shift_days")
      .select("shift_id, day_of_week"),
    
    // 6. Approved SICK absences only
    supabase
      .from("absence_request_v2")
      .select("employee_id, start_date, end_date")
      .in("employee_id", employeeIds)
      .eq("status", "approved")
      .eq("type", "sick")
      .lte("start_date", endStr)
      .gte("end_date", startStr)
  ]);

  const individualShifts = individualShiftsRes.data || [];
  const employeeStandardShifts = employeeStandardShiftsRes.data || [];
  const teamMembers = teamMembersRes.data || [];
  const teamStandardShifts = teamStandardShiftsRes.data || [];
  const shiftDays = shiftDaysRes.data || [];
  const sickAbsences = sickAbsencesRes.data || [];

  // Build shift_id -> days map
  const shiftDaysMap = new Map<string, number[]>();
  shiftDays.forEach(sd => {
    if (!shiftDaysMap.has(sd.shift_id)) {
      shiftDaysMap.set(sd.shift_id, []);
    }
    shiftDaysMap.get(sd.shift_id)!.push(sd.day_of_week);
  });

  // Build team -> active shift_id map
  const teamActiveShiftMap = new Map<string, string>();
  teamStandardShifts.forEach(s => {
    if (s.is_active) {
      teamActiveShiftMap.set(s.team_id, s.id);
    }
  });

  // Build lookup maps
  const individualShiftMap = new Map<string, Set<string>>();
  individualShifts.forEach(s => {
    if (!individualShiftMap.has(s.employee_id)) {
      individualShiftMap.set(s.employee_id, new Set());
    }
    individualShiftMap.get(s.employee_id)!.add(s.date);
  });

  const employeeShiftIdMap = new Map<string, string>();
  employeeStandardShifts.forEach(s => {
    employeeShiftIdMap.set(s.employee_id, s.shift_id);
  });

  const employeeTeamMap = new Map<string, string>();
  teamMembers.forEach(m => {
    if (m.team_id) employeeTeamMap.set(m.employee_id, m.team_id);
  });

  // Build sick date sets per employee
  const sickDateMap = new Map<string, Set<string>>();
  sickAbsences.forEach(a => {
    if (!sickDateMap.has(a.employee_id)) {
      sickDateMap.set(a.employee_id, new Set());
    }
    const absStart = new Date(a.start_date);
    const absEnd = new Date(a.end_date);
    const current = new Date(absStart);
    while (current <= absEnd) {
      sickDateMap.get(a.employee_id)!.add(format(current, "yyyy-MM-dd"));
      current.setDate(current.getDate() + 1);
    }
  });

  // Count sick days where there was a planned shift
  let totalSickDays = 0;
  let withIndividualShift = 0;
  let withStandardShift = 0;
  let withTeamShift = 0;
  let sickWithoutShift = 0;

  for (const employee of employeesToCheck) {
    const empId = employee.id;
    const teamId = employeeTeamMap.get(empId) || employee.team_id;
    const sickDates = sickDateMap.get(empId) || new Set();
    const individualDates = individualShiftMap.get(empId) || new Set();
    
    const empShiftId = employeeShiftIdMap.get(empId);
    const empStandardDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;
    
    const teamActiveShiftId = teamId ? teamActiveShiftMap.get(teamId) : undefined;
    const teamDays = teamActiveShiftId ? shiftDaysMap.get(teamActiveShiftId) : undefined;

    for (const dateStr of dates) {
      // Only count if employee was sick on this date
      if (!sickDates.has(dateStr)) continue;

      const dayOfWeek = new Date(dateStr).getDay();
      const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;

      // Check if there was a planned shift (from hierarchy)
      if (individualDates.has(dateStr)) {
        totalSickDays++;
        withIndividualShift++;
      } else if (empStandardDays !== undefined && empStandardDays.includes(dayNumber)) {
        totalSickDays++;
        withStandardShift++;
      } else if (teamDays && teamDays.includes(dayNumber)) {
        totalSickDays++;
        withTeamShift++;
      } else {
        // Sick but no planned shift - doesn't count
        sickWithoutShift++;
      }
    }
  }

  return {
    value: totalSickDays,
    queryTimeMs: 0,
    breakdown: {
      "Med individuel vagt": withIndividualShift,
      "Med medarbejder-standardvagt": withStandardShift,
      "Med team-vagt": withTeamShift,
      "Syg uden vagt (tæller ikke)": sickWithoutShift,
      "Antal medarbejdere": employeesToCheck.length,
      "Antal godkendte sygemeldinger": sickAbsences.length,
    },
    rowCount: totalSickDays,
  };
}

// ============================================================================
// VACATION DAYS - Feriedage (kræver planlagt vagt)
// ============================================================================
// Feriedage tæller kun hvis medarbejderen havde en planlagt vagt den dag
// Følger shift-hierarkiet: Individual > Employee Standard > Team Primary
// ============================================================================
async function testVacationDays(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  // Generate all dates in period
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(format(current, "yyyy-MM-dd"));
    current.setDate(current.getDate() + 1);
  }

  // Get employees to check
  let employeesToCheck: { id: string; team_id: string | null }[] = [];
  
  if (employeeId) {
    const { data: emp } = await supabase
      .from("employee_master_data")
      .select("id, team_id")
      .eq("id", employeeId)
      .single();
    if (emp) employeesToCheck = [emp];
  } else {
    const { data: emps } = await supabase
      .from("employee_master_data")
      .select("id, team_id")
      .eq("is_active", true);
    employeesToCheck = emps || [];
  }

  if (employeesToCheck.length === 0) {
    return { value: 0, queryTimeMs: 0, breakdown: { "Ingen medarbejdere fundet": 0 } };
  }

  const employeeIds = employeesToCheck.map(e => e.id);

  // Fetch all shift sources and vacation absences in parallel
  const [
    individualShiftsRes,
    employeeStandardShiftsRes,
    teamMembersRes,
    teamStandardShiftsRes,
    shiftDaysRes,
    vacationAbsencesRes
  ] = await Promise.all([
    // 1. Individual shifts (shift table)
    supabase
      .from("shift")
      .select("employee_id, date")
      .in("employee_id", employeeIds)
      .gte("date", startStr)
      .lte("date", endStr),
    
    // 2. Employee standard shifts
    supabase
      .from("employee_standard_shifts")
      .select("employee_id, shift_id")
      .in("employee_id", employeeIds),
    
    // 3. Team members
    supabase
      .from("team_members")
      .select("employee_id, team_id")
      .in("employee_id", employeeIds),
    
    // 4. Team standard shifts (active shifts)
    supabase
      .from("team_standard_shifts")
      .select("id, team_id, is_active, created_at"),
    
    // 5. Team standard shift days
    supabase
      .from("team_standard_shift_days")
      .select("shift_id, day_of_week"),
    
    // 6. Approved VACATION absences only
    supabase
      .from("absence_request_v2")
      .select("employee_id, start_date, end_date")
      .in("employee_id", employeeIds)
      .eq("status", "approved")
      .eq("type", "vacation")
      .lte("start_date", endStr)
      .gte("end_date", startStr)
  ]);

  const individualShifts = individualShiftsRes.data || [];
  const employeeStandardShifts = employeeStandardShiftsRes.data || [];
  const teamMembers = teamMembersRes.data || [];
  const teamStandardShifts = teamStandardShiftsRes.data || [];
  const shiftDays = shiftDaysRes.data || [];
  const vacationAbsences = vacationAbsencesRes.data || [];

  // Build shift_id -> days map
  const shiftDaysMap = new Map<string, number[]>();
  shiftDays.forEach(sd => {
    if (!shiftDaysMap.has(sd.shift_id)) {
      shiftDaysMap.set(sd.shift_id, []);
    }
    shiftDaysMap.get(sd.shift_id)!.push(sd.day_of_week);
  });

  // Build team -> active shift_id map (use oldest active shift per team)
  const sortedTeamStandardShifts = [...teamStandardShifts].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const teamActiveShiftMap = new Map<string, string>();
  sortedTeamStandardShifts.forEach(s => {
    if (s.is_active && !teamActiveShiftMap.has(s.team_id)) {
      teamActiveShiftMap.set(s.team_id, s.id);
    }
  });

  // Build lookup maps
  const individualShiftMap = new Map<string, Set<string>>();
  individualShifts.forEach(s => {
    if (!individualShiftMap.has(s.employee_id)) {
      individualShiftMap.set(s.employee_id, new Set());
    }
    individualShiftMap.get(s.employee_id)!.add(s.date);
  });

  const employeeShiftIdMap = new Map<string, string>();
  employeeStandardShifts.forEach(s => {
    employeeShiftIdMap.set(s.employee_id, s.shift_id);
  });

  const employeeTeamMap = new Map<string, string>();
  teamMembers.forEach(m => {
    if (m.team_id) employeeTeamMap.set(m.employee_id, m.team_id);
  });

  // Build vacation date sets per employee
  const vacationDateMap = new Map<string, Set<string>>();
  vacationAbsences.forEach(a => {
    if (!vacationDateMap.has(a.employee_id)) {
      vacationDateMap.set(a.employee_id, new Set());
    }
    const absStart = new Date(a.start_date);
    const absEnd = new Date(a.end_date);
    const cur = new Date(absStart);
    while (cur <= absEnd) {
      vacationDateMap.get(a.employee_id)!.add(format(cur, "yyyy-MM-dd"));
      cur.setDate(cur.getDate() + 1);
    }
  });

  // Count vacation days where there was a planned shift
  let totalVacationDays = 0;
  let withIndividualShift = 0;
  let withStandardShift = 0;
  let withTeamShift = 0;
  let vacationWithoutShift = 0;

  for (const employee of employeesToCheck) {
    const empId = employee.id;
    const teamId = employeeTeamMap.get(empId) || employee.team_id;
    const vacationDates = vacationDateMap.get(empId) || new Set();
    const individualDates = individualShiftMap.get(empId) || new Set();
    
    const empShiftId = employeeShiftIdMap.get(empId);
    const empStandardDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;
    
    const teamActiveShiftId = teamId ? teamActiveShiftMap.get(teamId) : undefined;
    const teamDays = teamActiveShiftId ? shiftDaysMap.get(teamActiveShiftId) : undefined;

    for (const dateStr of dates) {
      // Only count if employee has vacation on this date
      if (!vacationDates.has(dateStr)) continue;

      const dayOfWeek = new Date(dateStr).getDay();
      const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;

      // Check if there was a planned shift (from hierarchy)
      if (individualDates.has(dateStr)) {
        totalVacationDays++;
        withIndividualShift++;
      } else if (empStandardDays !== undefined && empStandardDays.includes(dayNumber)) {
        totalVacationDays++;
        withStandardShift++;
      } else if (teamDays && teamDays.includes(dayNumber)) {
        totalVacationDays++;
        withTeamShift++;
      } else {
        // Vacation but no planned shift - doesn't count
        vacationWithoutShift++;
      }
    }
  }

  return {
    value: totalVacationDays,
    queryTimeMs: 0,
    breakdown: {
      "Med individuel vagt": withIndividualShift,
      "Med medarbejder-standardvagt": withStandardShift,
      "Med team-vagt": withTeamShift,
      "Ferie uden vagt (tæller ikke)": vacationWithoutShift,
      "Antal medarbejdere": employeesToCheck.length,
      "Antal godkendte ferieansøgninger": vacationAbsences.length,
    },
    rowCount: totalVacationDays,
  };
}

// ============================================================================
// ALL SHIFT TYPES - Alle vagttyper
// ============================================================================
// Totalt antal planlagte vagter fordelt på type:
// - Alm. vagt: Planlagt vagt uden fravær
// - Sygevagt: Planlagt vagt med godkendt sygefravær
// - Ferievagt: Planlagt vagt med godkendt ferie
// - Fridagsvagt: Planlagt vagt med godkendt fridag (day_off)
// - Udeblivelsesvagt: Planlagt vagt med godkendt udeblivelse (no_show)
// ============================================================================
async function testAllShiftTypes(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  // Generate all dates in period
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(format(current, "yyyy-MM-dd"));
    current.setDate(current.getDate() + 1);
  }

  // Get employees to check
  let employeesToCheck: { id: string; team_id: string | null }[] = [];
  
  if (employeeId) {
    const { data: emp } = await supabase
      .from("employee_master_data")
      .select("id, team_id")
      .eq("id", employeeId)
      .single();
    if (emp) employeesToCheck = [emp];
  } else {
    const { data: emps } = await supabase
      .from("employee_master_data")
      .select("id, team_id")
      .eq("is_active", true);
    employeesToCheck = emps || [];
  }

  if (employeesToCheck.length === 0) {
    return { value: 0, queryTimeMs: 0, breakdown: { "Ingen medarbejdere fundet": 0 } };
  }

  const employeeIds = employeesToCheck.map(e => e.id);

  // Fetch all shift sources and ALL absence types in parallel
  const [
    individualShiftsRes,
    employeeStandardShiftsRes,
    teamMembersRes,
    teamStandardShiftsRes,
    shiftDaysRes,
    absencesRes
  ] = await Promise.all([
    // 1. Individual shifts (shift table)
    supabase
      .from("shift")
      .select("employee_id, date")
      .in("employee_id", employeeIds)
      .gte("date", startStr)
      .lte("date", endStr),
    
    // 2. Employee standard shifts
    supabase
      .from("employee_standard_shifts")
      .select("employee_id, shift_id")
      .in("employee_id", employeeIds),
    
    // 3. Team members
    supabase
      .from("team_members")
      .select("employee_id, team_id")
      .in("employee_id", employeeIds),
    
    // 4. Team standard shifts (active shifts)
    supabase
      .from("team_standard_shifts")
      .select("id, team_id, is_active, created_at"),
    
    // 5. Team standard shift days
    supabase
      .from("team_standard_shift_days")
      .select("shift_id, day_of_week"),
    
    // 6. ALL approved absences (sick, vacation, day_off, no_show)
    supabase
      .from("absence_request_v2")
      .select("employee_id, start_date, end_date, type")
      .in("employee_id", employeeIds)
      .eq("status", "approved")
      .in("type", ["sick", "vacation", "day_off", "no_show"])
      .lte("start_date", endStr)
      .gte("end_date", startStr)
  ]);

  const individualShifts = individualShiftsRes.data || [];
  const employeeStandardShifts = employeeStandardShiftsRes.data || [];
  const teamMembers = teamMembersRes.data || [];
  const teamStandardShifts = teamStandardShiftsRes.data || [];
  const shiftDays = shiftDaysRes.data || [];
  const absences = absencesRes.data || [];

  // Build shift_id -> days map
  const shiftDaysMap = new Map<string, number[]>();
  shiftDays.forEach(sd => {
    if (!shiftDaysMap.has(sd.shift_id)) {
      shiftDaysMap.set(sd.shift_id, []);
    }
    shiftDaysMap.get(sd.shift_id)!.push(sd.day_of_week);
  });

  // Build team -> active shift_id map (use oldest active shift per team)
  const sortedTeamStandardShifts = [...teamStandardShifts].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const teamActiveShiftMap = new Map<string, string>();
  sortedTeamStandardShifts.forEach(s => {
    if (s.is_active && !teamActiveShiftMap.has(s.team_id)) {
      teamActiveShiftMap.set(s.team_id, s.id);
    }
  });

  // Build lookup maps
  const individualShiftMap = new Map<string, Set<string>>();
  individualShifts.forEach(s => {
    if (!individualShiftMap.has(s.employee_id)) {
      individualShiftMap.set(s.employee_id, new Set());
    }
    individualShiftMap.get(s.employee_id)!.add(s.date);
  });

  const employeeShiftIdMap = new Map<string, string>();
  employeeStandardShifts.forEach(s => {
    employeeShiftIdMap.set(s.employee_id, s.shift_id);
  });

  const employeeTeamMap = new Map<string, string>();
  teamMembers.forEach(m => {
    if (m.team_id) employeeTeamMap.set(m.employee_id, m.team_id);
  });

  // Build absence type date sets per employee: employee_id -> date -> absence_type
  const absenceTypeMap = new Map<string, Map<string, string>>();
  absences.forEach(a => {
    if (!absenceTypeMap.has(a.employee_id)) {
      absenceTypeMap.set(a.employee_id, new Map());
    }
    const absStart = new Date(a.start_date);
    const absEnd = new Date(a.end_date);
    const cur = new Date(absStart);
    while (cur <= absEnd) {
      const dateStr = format(cur, "yyyy-MM-dd");
      // Only set if not already set (first absence wins)
      if (!absenceTypeMap.get(a.employee_id)!.has(dateStr)) {
        absenceTypeMap.get(a.employee_id)!.set(dateStr, a.type);
      }
      cur.setDate(cur.getDate() + 1);
    }
  });

  // Count shifts by type
  let normalCount = 0;
  let sickCount = 0;
  let vacationCount = 0;
  let dayOffCount = 0;
  let noShowCount = 0;

  for (const employee of employeesToCheck) {
    const empId = employee.id;
    const teamId = employeeTeamMap.get(empId) || employee.team_id;
    const absenceDatesForEmp = absenceTypeMap.get(empId) || new Map();
    const individualDates = individualShiftMap.get(empId) || new Set();
    
    const empShiftId = employeeShiftIdMap.get(empId);
    const empStandardDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;
    
    const teamActiveShiftId = teamId ? teamActiveShiftMap.get(teamId) : undefined;
    const teamDays = teamActiveShiftId ? shiftDaysMap.get(teamActiveShiftId) : undefined;

    for (const dateStr of dates) {
      const dayOfWeek = new Date(dateStr).getDay();
      const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;

      // Check if there's a planned shift from hierarchy
      let hasShift = false;
      
      if (individualDates.has(dateStr)) {
        hasShift = true;
      } else if (empStandardDays !== undefined) {
        if (empStandardDays.includes(dayNumber)) {
          hasShift = true;
        }
      } else if (teamDays && teamDays.includes(dayNumber)) {
        hasShift = true;
      }

      // Only count if there's a planned shift
      if (hasShift) {
        const absenceType = absenceDatesForEmp.get(dateStr);
        
        switch (absenceType) {
          case "sick":
            sickCount++;
            break;
          case "vacation":
            vacationCount++;
            break;
          case "day_off":
            dayOffCount++;
            break;
          case "no_show":
            noShowCount++;
            break;
          default:
            normalCount++;
            break;
        }
      }
    }
  }

  const totalShifts = normalCount + sickCount + vacationCount + dayOffCount + noShowCount;

  return {
    value: totalShifts,
    queryTimeMs: 0,
    breakdown: {
      "Alm. vagt": normalCount,
      "Sygevagt": sickCount,
      "Ferievagt": vacationCount,
      "Fridagsvagt": dayOffCount,
      "Udeblivelsesvagt": noShowCount,
      "Antal medarbejdere": employeesToCheck.length,
      "Antal dage i periode": dates.length,
    },
    rowCount: totalShifts,
  };
}

// ============================================================================
// LATENESS DAYS - Forsinkede dage
// ============================================================================
// Tæller antal unikke dage med forsinkelsesregistrering
// Kræver IKKE planlagt vagt - tæller blot registreringer i lateness_record
// ============================================================================
async function testLatenessDays(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  let query = supabase
    .from("lateness_record")
    .select("id, employee_id, date, minutes", { count: "exact" })
    .gte("date", startStr)
    .lte("date", endStr);

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, count, error } = await query;
  if (error) throw error;

  // Tæl unikke dage (en medarbejder kan kun have én forsinkelse per dag)
  const uniqueDays = new Set(data?.map(r => `${r.employee_id}_${r.date}`) || []);
  
  // Beregn gennemsnitlig forsinkelse
  const totalMinutes = data?.reduce((sum, r) => sum + (r.minutes || 0), 0) || 0;
  const avgMinutes = data?.length ? Math.round(totalMinutes / data.length) : 0;

  return {
    value: uniqueDays.size,
    queryTimeMs: 0,
    breakdown: {
      "Antal forsinkelser": count || 0,
      "Unikke dage": uniqueDays.size,
      "Total minutter": totalMinutes,
      "Gennemsnitlig forsinkelse": `${avgMinutes} min`,
    },
    rowCount: count || 0,
  };
}

// ============================================================================
// DAY OFF DAYS - Fridage
// ============================================================================
// Tæller antal dage registreret med fridag (alle registreringer, uanset status)
// ============================================================================
async function testDayOffDays(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  // Hent alle fridag-registreringer (uanset status)
  let absenceQuery = supabase
    .from("absence_request_v2")
    .select("*")
    .eq("type", "day_off")
    .lte("start_date", endStr)
    .gte("end_date", startStr);

  if (employeeId) {
    absenceQuery = absenceQuery.eq("employee_id", employeeId);
  }

  const { data: absences, error } = await absenceQuery;
  if (error) throw error;

  if (!absences?.length) {
    return {
      value: 0,
      queryTimeMs: 0,
      breakdown: { "Fridag-registreringer": 0 },
      rowCount: 0,
    };
  }

  // Tæl alle dage i fridag-perioden der overlapper med dato-intervallet
  let totalDayOffDays = 0;
  const dayOffDetails: Record<string, number> = {};

  // Tæl status-fordeling
  const statusCounts = absences.reduce((acc, a) => {
    acc[a.status || 'unknown'] = (acc[a.status || 'unknown'] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  absences.forEach(absence => {
    const absStart = new Date(Math.max(new Date(absence.start_date).getTime(), start.getTime()));
    const absEnd = new Date(Math.min(new Date(absence.end_date).getTime(), end.getTime()));
    
    const current = new Date(absStart);
    let daysForThisAbsence = 0;
    
    while (current <= absEnd) {
      daysForThisAbsence++;
      current.setDate(current.getDate() + 1);
    }
    
    totalDayOffDays += daysForThisAbsence;
    const empId = absence.employee_id.substring(0, 8);
    dayOffDetails[`Medarbejder ${empId}...`] = (dayOffDetails[`Medarbejder ${empId}...`] || 0) + daysForThisAbsence;
  });

  return {
    value: totalDayOffDays,
    queryTimeMs: 0,
    breakdown: {
      "Fridag-registreringer": absences.length,
      "Total fridage": totalDayOffDays,
      "Godkendte": statusCounts.approved || 0,
      "Afventende": statusCounts.pending || 0,
      "Afvist": statusCounts.rejected || 0,
      ...dayOffDetails,
    },
    rowCount: absences.length,
  };
}

// ============================================================================
// HELPER: Beregn timer fra start_time og end_time
// Følger Vagtplan leder logik med fleksibel pause
// EXPORTED for reuse in FormulaLiveTest
// ============================================================================
export function calculateHoursFromTimes(
  startTime: string,
  endTime: string,
  breakMinutes?: number | null
): number {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  
  let rawHours = (endH + endM / 60) - (startH + startM / 60);
  // Handle overnight shifts
  if (rawHours < 0) rawHours += 24;
  
  // Brug eksplicit break_minutes hvis tilgængelig, ellers 30 min fallback for >6t
  const breakMins = breakMinutes ?? (rawHours > 6 ? 30 : 0);
  
  return Math.max(0, rawHours - breakMins / 60);
}

// ============================================================================
// HELPER: Core timer-beregning baseret på Vagtplan leder logik
// Returnerer timer fordelt på type (normal, sick, vacation, day_off, no_show)
// EXPORTED for reuse in FormulaLiveTest
// ============================================================================
export interface HoursResult {
  normalHours: number;
  sickHours: number;
  vacationHours: number;
  dayOffHours: number;
  noShowHours: number;
  totalHours: number;
  employeeCount: number;
  dayCount: number;
}

export async function calculateHoursByType(start: Date, end: Date, employeeId?: string): Promise<HoursResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  // Generate all dates in period
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(format(current, "yyyy-MM-dd"));
    current.setDate(current.getDate() + 1);
  }

  // Get employees to check
  let employeesToCheck: { id: string; team_id: string | null }[] = [];
  
  if (employeeId) {
    const { data: emp } = await supabase
      .from("employee_master_data")
      .select("id, team_id")
      .eq("id", employeeId)
      .single();
    if (emp) employeesToCheck = [emp];
  } else {
    const { data: emps } = await supabase
      .from("employee_master_data")
      .select("id, team_id")
      .eq("is_active", true);
    employeesToCheck = emps || [];
  }

  if (employeesToCheck.length === 0) {
    return { normalHours: 0, sickHours: 0, vacationHours: 0, dayOffHours: 0, noShowHours: 0, totalHours: 0, employeeCount: 0, dayCount: dates.length };
  }

  const employeeIds = employeesToCheck.map(e => e.id);

  // Fetch all data sources in parallel
  const [
    individualShiftsRes,
    employeeStandardShiftsRes,
    teamMembersRes,
    teamStandardShiftsRes,
    shiftDaysRes,
    absencesRes,
    timeStampsRes
  ] = await Promise.all([
    // 1. Individual shifts with times and break_minutes
    supabase
      .from("shift")
      .select("employee_id, date, start_time, end_time, break_minutes")
      .in("employee_id", employeeIds)
      .gte("date", startStr)
      .lte("date", endStr),
    
    // 2. Employee standard shifts with shift_id
    supabase
      .from("employee_standard_shifts")
      .select("employee_id, shift_id")
      .in("employee_id", employeeIds),
    
    // 3. Team members
    supabase
      .from("team_members")
      .select("employee_id, team_id")
      .in("employee_id", employeeIds),
    
    // 4. Team standard shifts with hours_source and times
    supabase
      .from("team_standard_shifts")
      .select("id, team_id, is_active, hours_source, start_time, end_time, created_at"),
    
    // 5. Team standard shift days with times
    supabase
      .from("team_standard_shift_days")
      .select("shift_id, day_of_week, start_time, end_time"),
    
    // 6. ALL approved absences
    supabase
      .from("absence_request_v2")
      .select("employee_id, start_date, end_date, type")
      .in("employee_id", employeeIds)
      .eq("status", "approved")
      .in("type", ["sick", "vacation", "day_off", "no_show"])
      .lte("start_date", endStr)
      .gte("end_date", startStr),
    
    // 7. Time stamps for timestamp-based hours (use clock_in for date filtering)
    supabase
      .from("time_stamps")
      .select("employee_id, clock_in, clock_out, break_minutes, effective_hours")
      .in("employee_id", employeeIds)
      .gte("clock_in", `${startStr}T00:00:00`)
      .lte("clock_in", `${endStr}T23:59:59`)
  ]);

  const individualShifts = individualShiftsRes.data || [];
  const employeeStandardShifts = employeeStandardShiftsRes.data || [];
  const teamMembers = teamMembersRes.data || [];
  const teamStandardShifts = teamStandardShiftsRes.data || [];
  const shiftDays = shiftDaysRes.data || [];
  const absences = absencesRes.data || [];
  const timeStamps = timeStampsRes.data || [];

  // Build shift_id -> days map (with times)
  const shiftDaysMap = new Map<string, { day_of_week: number; start_time: string | null; end_time: string | null }[]>();
  shiftDays.forEach(sd => {
    if (!shiftDaysMap.has(sd.shift_id)) {
      shiftDaysMap.set(sd.shift_id, []);
    }
    shiftDaysMap.get(sd.shift_id)!.push({
      day_of_week: sd.day_of_week,
      start_time: sd.start_time,
      end_time: sd.end_time
    });
  });

  // Build team -> active shift map (use oldest active shift per team)
  const sortedTeamStandardShifts = [...teamStandardShifts].sort((a, b) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const teamActiveShiftMap = new Map<string, typeof teamStandardShifts[0]>();
  sortedTeamStandardShifts.forEach(s => {
    if (s.is_active && !teamActiveShiftMap.has(s.team_id)) {
      teamActiveShiftMap.set(s.team_id, s);
    }
  });

  // Build shift_id -> shift details map
  const shiftDetailsMap = new Map<string, typeof teamStandardShifts[0]>();
  teamStandardShifts.forEach(s => {
    shiftDetailsMap.set(s.id, s);
  });

  // Build individual shift map: employee_id_date -> shift details
  const individualShiftMap = new Map<string, typeof individualShifts[0]>();
  individualShifts.forEach(s => {
    individualShiftMap.set(`${s.employee_id}_${s.date}`, s);
  });

  // Build employee -> special shift_id map
  const employeeShiftIdMap = new Map<string, string>();
  employeeStandardShifts.forEach(s => {
    employeeShiftIdMap.set(s.employee_id, s.shift_id);
  });

  // Build employee -> team map
  const employeeTeamMap = new Map<string, string>();
  teamMembers.forEach(m => {
    if (m.team_id) employeeTeamMap.set(m.employee_id, m.team_id);
  });

  // Build timestamp map: employee_id_date -> timestamp (extract date from clock_in)
  const timeStampMap = new Map<string, { clock_in: string; clock_out: string | null; break_minutes: number | null; effective_hours: number | null }>();
  timeStamps.forEach(ts => {
    const dateStr = format(new Date(ts.clock_in), "yyyy-MM-dd");
    timeStampMap.set(`${ts.employee_id}_${dateStr}`, ts);
  });

  // Build absence type date sets per employee
  const absenceTypeMap = new Map<string, Map<string, string>>();
  absences.forEach(a => {
    if (!absenceTypeMap.has(a.employee_id)) {
      absenceTypeMap.set(a.employee_id, new Map());
    }
    const absStart = new Date(a.start_date);
    const absEnd = new Date(a.end_date);
    const cur = new Date(absStart);
    while (cur <= absEnd) {
      const dateStr = format(cur, "yyyy-MM-dd");
      if (!absenceTypeMap.get(a.employee_id)!.has(dateStr)) {
        absenceTypeMap.get(a.employee_id)!.set(dateStr, a.type);
      }
      cur.setDate(cur.getDate() + 1);
    }
  });

  // Calculate hours by type
  let normalHours = 0;
  let sickHours = 0;
  let vacationHours = 0;
  let dayOffHours = 0;
  let noShowHours = 0;

  for (const employee of employeesToCheck) {
    const empId = employee.id;
    const teamId = employeeTeamMap.get(empId) || employee.team_id;
    const absenceDatesForEmp = absenceTypeMap.get(empId) || new Map();
    
    const empShiftId = employeeShiftIdMap.get(empId);
    const empStandardShift = empShiftId ? shiftDetailsMap.get(empShiftId) : undefined;
    const empStandardDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;
    
    const teamActiveShift = teamId ? teamActiveShiftMap.get(teamId) : undefined;
    const teamActiveShiftId = teamActiveShift?.id;
    const teamDays = teamActiveShiftId ? shiftDaysMap.get(teamActiveShiftId) : undefined;

    // Determine hours_source: employee special shift → team primary shift → default 'shift'
    const hoursSource = empStandardShift?.hours_source || teamActiveShift?.hours_source || 'shift';

    for (const dateStr of dates) {
      const dayOfWeek = new Date(dateStr).getDay();
      const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;
      const key = `${empId}_${dateStr}`;

      // Check if there's a planned shift and get times
      let hasShift = false;
      let shiftHours = 0;
      
      const individualShift = individualShiftMap.get(key);
      
      if (individualShift) {
        hasShift = true;
        if (hoursSource === 'timestamp') {
          // Use actual timestamp
          const ts = timeStampMap.get(key);
          if (ts?.effective_hours) {
            shiftHours = ts.effective_hours;
          } else if (ts?.clock_in && ts?.clock_out) {
            shiftHours = calculateHoursFromTimes(ts.clock_in, ts.clock_out, ts.break_minutes);
          }
        } else {
          // Use planned shift times
          if (individualShift.start_time && individualShift.end_time) {
            shiftHours = calculateHoursFromTimes(individualShift.start_time, individualShift.end_time, individualShift.break_minutes);
          }
        }
      } else if (empStandardDays !== undefined) {
        // Check employee special shift
        const dayConfig = empStandardDays.find(d => d.day_of_week === dayNumber);
        if (dayConfig) {
          hasShift = true;
          if (hoursSource === 'timestamp') {
            const ts = timeStampMap.get(key);
            if (ts?.effective_hours) {
              shiftHours = ts.effective_hours;
            } else if (ts?.clock_in && ts?.clock_out) {
              shiftHours = calculateHoursFromTimes(ts.clock_in, ts.clock_out, ts.break_minutes);
            }
          } else {
            // Use day-specific times or fallback to shift default times
            const startTime = dayConfig.start_time || empStandardShift?.start_time;
            const endTime = dayConfig.end_time || empStandardShift?.end_time;
            if (startTime && endTime) {
              shiftHours = calculateHoursFromTimes(startTime, endTime, null);
            }
          }
        }
      } else if (teamDays) {
        // Check team primary shift
        const dayConfig = teamDays.find(d => d.day_of_week === dayNumber);
        if (dayConfig) {
          hasShift = true;
          if (hoursSource === 'timestamp') {
            const ts = timeStampMap.get(key);
            if (ts?.effective_hours) {
              shiftHours = ts.effective_hours;
            } else if (ts?.clock_in && ts?.clock_out) {
              shiftHours = calculateHoursFromTimes(ts.clock_in, ts.clock_out, ts.break_minutes);
            }
          } else {
            // Use day-specific times or fallback to team shift default times
            const startTime = dayConfig.start_time || teamActiveShift?.start_time;
            const endTime = dayConfig.end_time || teamActiveShift?.end_time;
            if (startTime && endTime) {
              shiftHours = calculateHoursFromTimes(startTime, endTime, null);
            }
          }
        }
      }

      // Only count if there's a planned shift
      if (hasShift) {
        const absenceType = absenceDatesForEmp.get(dateStr);
        
        switch (absenceType) {
          case "sick":
            sickHours += shiftHours;
            break;
          case "vacation":
            vacationHours += shiftHours;
            break;
          case "day_off":
            dayOffHours += shiftHours;
            break;
          case "no_show":
            noShowHours += shiftHours;
            break;
          default:
            normalHours += shiftHours;
            break;
        }
      }
    }
  }

  const totalHours = normalHours + sickHours + vacationHours + dayOffHours + noShowHours;

  return {
    normalHours: Math.round(normalHours * 100) / 100,
    sickHours: Math.round(sickHours * 100) / 100,
    vacationHours: Math.round(vacationHours * 100) / 100,
    dayOffHours: Math.round(dayOffHours * 100) / 100,
    noShowHours: Math.round(noShowHours * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    employeeCount: employeesToCheck.length,
    dayCount: dates.length
  };
}

// ============================================================================
// ALL HOURS - Alle timer fordelt på type
// ============================================================================
// Beregner timer fra alle vagttyper baseret på Vagtplan leder logik
// hours_source: 'timestamp' → faktiske stempletider, 'shift' → planlagte tider
// ============================================================================
async function testAllHours(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const result = await calculateHoursByType(start, end, employeeId);

  return {
    value: result.totalHours.toFixed(2),
    queryTimeMs: 0,
    breakdown: {
      "Salgstimer (alm. vagt)": result.normalHours.toFixed(2),
      "Sygetimer": result.sickHours.toFixed(2),
      "Ferietimer": result.vacationHours.toFixed(2),
      "Fridagstimer": result.dayOffHours.toFixed(2),
      "Udeblivelsestimer": result.noShowHours.toFixed(2),
      "Total timer": result.totalHours.toFixed(2),
      "Antal medarbejdere": result.employeeCount,
      "Antal dage i periode": result.dayCount,
    },
    rowCount: result.employeeCount,
  };
}

// ============================================================================
// SALES HOURS - Salgstimer (alm. vagt timer)
// ============================================================================
// Timer fra almindelige vagter uden fravær
// ============================================================================
async function testSalesHours(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const result = await calculateHoursByType(start, end, employeeId);

  return {
    value: result.normalHours.toFixed(2),
    queryTimeMs: 0,
    breakdown: {
      "Salgstimer (alm. vagt)": result.normalHours.toFixed(2),
      "Antal medarbejdere": result.employeeCount,
      "Antal dage i periode": result.dayCount,
    },
    rowCount: result.employeeCount,
  };
}

// ============================================================================
// VACATION HOURS - Ferietimer
// ============================================================================
// Timer fra vagter med godkendt ferie
// ============================================================================
async function testVacationHours(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const result = await calculateHoursByType(start, end, employeeId);

  return {
    value: result.vacationHours.toFixed(2),
    queryTimeMs: 0,
    breakdown: {
      "Ferietimer": result.vacationHours.toFixed(2),
      "Antal medarbejdere": result.employeeCount,
      "Antal dage i periode": result.dayCount,
    },
    rowCount: result.employeeCount,
  };
}

// ============================================================================
// SICK HOURS - Sygetimer
// ============================================================================
// Timer fra vagter med godkendt sygefravær
// ============================================================================
async function testSickHours(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const result = await calculateHoursByType(start, end, employeeId);

  return {
    value: result.sickHours.toFixed(2),
    queryTimeMs: 0,
    breakdown: {
      "Sygetimer": result.sickHours.toFixed(2),
      "Antal medarbejdere": result.employeeCount,
      "Antal dage i periode": result.dayCount,
    },
    rowCount: result.employeeCount,
  };
}

// ============================================================================
// DAY OFF HOURS - Fridagstimer
// ============================================================================
// Timer fra vagter med godkendt fridag
// ============================================================================
async function testDayOffHours(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const result = await calculateHoursByType(start, end, employeeId);

  return {
    value: result.dayOffHours.toFixed(2),
    queryTimeMs: 0,
    breakdown: {
      "Fridagstimer": result.dayOffHours.toFixed(2),
      "Antal medarbejdere": result.employeeCount,
      "Antal dage i periode": result.dayCount,
    },
    rowCount: result.employeeCount,
  };
}

// ============================================================================
// LATENESS HOURS - Forsinket timer
// ============================================================================
// Total tid forsinket (minutter konverteret til timer)
// Bruger lateness_record.minutes
// ============================================================================
async function testLatenessHours(start: Date, end: Date, employeeId?: string): Promise<TestResult> {
  const startStr = format(start, "yyyy-MM-dd");
  const endStr = format(end, "yyyy-MM-dd");

  let query = supabase
    .from("lateness_record")
    .select("id, employee_id, date, minutes")
    .gte("date", startStr)
    .lte("date", endStr);

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const totalMinutes = data?.reduce((sum, r) => sum + (r.minutes || 0), 0) || 0;
  const totalHours = totalMinutes / 60;
  const avgMinutes = data?.length ? Math.round(totalMinutes / data.length) : 0;

  return {
    value: totalHours.toFixed(2),
    queryTimeMs: 0,
    breakdown: {
      "Antal forsinkelser": data?.length || 0,
      "Total minutter": totalMinutes,
      "Total timer": totalHours.toFixed(2),
      "Gennemsnitlig forsinkelse": `${avgMinutes} min`,
    },
    rowCount: data?.length || 0,
  };
}
