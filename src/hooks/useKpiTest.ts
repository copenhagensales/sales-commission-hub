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
    
    // 4. Team standard shifts (primary shifts)
    supabase
      .from("team_standard_shifts")
      .select("id, team_id, is_primary"),
    
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

  // Build team -> primary shift_id map
  const teamPrimaryShiftMap = new Map<string, string>();
  teamStandardShifts.forEach(s => {
    if (s.is_primary) {
      teamPrimaryShiftMap.set(s.team_id, s.id);
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
    const teamPrimaryShiftId = teamId ? teamPrimaryShiftMap.get(teamId) : undefined;
    const teamDays = teamPrimaryShiftId ? shiftDaysMap.get(teamPrimaryShiftId) : undefined;

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
    
    // 4. Team standard shifts (primary shifts)
    supabase
      .from("team_standard_shifts")
      .select("id, team_id, is_primary"),
    
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

  // Build team -> primary shift_id map
  const teamPrimaryShiftMap = new Map<string, string>();
  teamStandardShifts.forEach(s => {
    if (s.is_primary) {
      teamPrimaryShiftMap.set(s.team_id, s.id);
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
    
    const teamPrimaryShiftId = teamId ? teamPrimaryShiftMap.get(teamId) : undefined;
    const teamDays = teamPrimaryShiftId ? shiftDaysMap.get(teamPrimaryShiftId) : undefined;

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
