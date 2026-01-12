import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays } from "date-fns";

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

// Test functions for each KPI
async function testSalesCount(start: Date, end: Date, clientId?: string): Promise<TestResult> {
  // Get sales with sale_items that have products with counts_as_sale = true
  let query = supabase
    .from("sale_items")
    .select(`
      quantity,
      product:products!sale_items_product_id_fkey (
        counts_as_sale
      ),
      sale:sales!inner (
        sale_datetime,
        client_campaign_id
      )
    `)
    .gte("sale.sale_datetime", start.toISOString())
    .lte("sale.sale_datetime", end.toISOString());

  const { data, error } = await query;
  if (error) throw error;

  // Filter and sum
  const filteredItems = (data || []).filter((item: any) => {
    const countsAsSale = item.product?.counts_as_sale ?? true;
    return countsAsSale;
  });

  const total = filteredItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
  const withProduct = filteredItems.filter((i: any) => i.product).length;
  const withoutProduct = filteredItems.length - withProduct;

  return {
    value: total,
    queryTimeMs: 0,
    breakdown: {
      "Med produkt-mapping": withProduct,
      "Uden produkt-mapping": withoutProduct,
      "Rækker behandlet": data?.length || 0,
    },
    rowCount: data?.length || 0,
  };
}

async function testTotalCommission(start: Date, end: Date, clientId?: string): Promise<TestResult> {
  const { data, error } = await supabase
    .from("sale_items")
    .select(`
      mapped_commission,
      sale:sales!inner (
        sale_datetime
      )
    `)
    .gte("sale.sale_datetime", start.toISOString())
    .lte("sale.sale_datetime", end.toISOString());

  if (error) throw error;

  const total = (data || []).reduce((sum: number, item: any) => sum + (item.mapped_commission || 0), 0);
  const withCommission = (data || []).filter((i: any) => i.mapped_commission && i.mapped_commission > 0).length;

  return {
    value: `${total.toLocaleString("da-DK")} DKK`,
    queryTimeMs: 0,
    breakdown: {
      "Med provision": withCommission,
      "Uden provision": (data?.length || 0) - withCommission,
    },
    rowCount: data?.length || 0,
  };
}

async function testTotalRevenue(start: Date, end: Date, clientId?: string): Promise<TestResult> {
  const { data, error } = await supabase
    .from("sale_items")
    .select(`
      mapped_revenue,
      sale:sales!inner (
        sale_datetime
      )
    `)
    .gte("sale.sale_datetime", start.toISOString())
    .lte("sale.sale_datetime", end.toISOString());

  if (error) throw error;

  const total = (data || []).reduce((sum: number, item: any) => sum + (item.mapped_revenue || 0), 0);

  return {
    value: `${total.toLocaleString("da-DK")} DKK`,
    queryTimeMs: 0,
    breakdown: {
      "Med omsætning": (data || []).filter((i: any) => i.mapped_revenue && i.mapped_revenue > 0).length,
    },
    rowCount: data?.length || 0,
  };
}

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
