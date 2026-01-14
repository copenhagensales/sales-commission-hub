import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useKpiDefinitions } from "@/hooks/useKpiDefinitions";
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, format } from "date-fns";
import { calculateHoursByType } from "@/hooks/useKpiTest";

type TestPeriod = "today" | "yesterday" | "this_week" | "this_month" | "last_30_days";

interface FormulaToken {
  id: string;
  type: "kpi" | "operator" | "number" | "parenthesis";
  value: string;
  label: string;
}

interface FormulaLiveTestProps {
  tokens: FormulaToken[];
  formulaName?: string;
}

interface TestResult {
  value: number | string;
  queryTimeMs: number;
  breakdown: Record<string, number | string>;
  errors: string[];
}

const periodLabels: Record<TestPeriod, string> = {
  today: "I dag",
  yesterday: "I går",
  this_week: "Denne uge",
  this_month: "Denne måned",
  last_30_days: "Sidste 30 dage",
};

const getDateRange = (period: TestPeriod) => {
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
    default:
      return { start: startOfDay(now), end: endOfDay(now) };
  }
};

export function FormulaLiveTest({ tokens, formulaName }: FormulaLiveTestProps) {
  const [period, setPeriod] = useState<TestPeriod>("this_month");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const { data: kpiDefinitions } = useKpiDefinitions();

  // Fetch employees for filtering
  const { data: employees } = useQuery({
    queryKey: ["employees-for-formula-test"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name")
        .eq("is_active", true)
        .order("first_name");
      if (error) throw error;
      return data;
    },
  });

  // Extract KPI slugs from tokens
  const kpiSlugsInFormula = tokens
    .filter((t) => t.type === "kpi")
    .map((t) => t.value);

  const hasKpis = kpiSlugsInFormula.length > 0;

  const runTest = async () => {
    if (!hasKpis) return;

    setIsLoading(true);
    setResult(null);
    const startTime = performance.now();

    try {
      const { start, end } = getDateRange(period);
      const startStr = format(start, "yyyy-MM-dd");
      const endStr = format(end, "yyyy-MM-dd");

      // Fetch values for each KPI in the formula
      const kpiValues: Record<string, number> = {};
      const errors: string[] = [];

      for (const slug of kpiSlugsInFormula) {
        const kpiDef = kpiDefinitions?.find((k) => k.slug === slug);
        
        if (!kpiDef) {
          errors.push(`KPI "${slug}" ikke fundet`);
          kpiValues[slug] = 0;
          continue;
        }

        // Simple test implementations for common KPIs
        const value = await fetchKpiValue(slug, startStr, endStr, employeeId);
        kpiValues[slug] = value;
      }

      // Build and evaluate the formula
      let formulaString = "";
      for (const token of tokens) {
        if (token.type === "kpi") {
          formulaString += kpiValues[token.value] ?? 0;
        } else if (token.type === "number") {
          formulaString += token.value;
        } else if (token.type === "operator") {
          formulaString += ` ${token.value} `;
        } else if (token.type === "parenthesis") {
          formulaString += token.value;
        }
      }

      // Safely evaluate the formula
      let calculatedValue: number | string;
      try {
        // Basic safety check - only allow numbers and math operators
        const sanitized = formulaString.replace(/[^0-9+\-*/().  ]/g, "");
        if (sanitized.trim() === "") {
          calculatedValue = 0;
        } else {
          // eslint-disable-next-line no-eval
          calculatedValue = eval(sanitized);
          if (typeof calculatedValue === "number" && !isFinite(calculatedValue)) {
            calculatedValue = "Ugyldigt resultat (division med 0?)";
          }
        }
      } catch (e) {
        calculatedValue = "Formel-fejl";
        errors.push("Kunne ikke beregne formlen");
      }

      const queryTimeMs = Math.round(performance.now() - startTime);

      // Build breakdown from KPI values
      const breakdown: Record<string, number | string> = {};
      for (const [slug, value] of Object.entries(kpiValues)) {
        const kpiDef = kpiDefinitions?.find((k) => k.slug === slug);
        const label = kpiDef?.name || slug;
        breakdown[label] = typeof value === "number" ? value.toLocaleString("da-DK") : value;
      }

      setResult({
        value: typeof calculatedValue === "number" 
          ? Math.round(calculatedValue * 100) / 100 
          : calculatedValue,
        queryTimeMs,
        breakdown,
        errors,
      });
    } catch (error) {
      setResult({
        value: "Fejl",
        queryTimeMs: 0,
        breakdown: {},
        errors: [error instanceof Error ? error.message : "Ukendt fejl"],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Play className="h-4 w-4" />
          Test formlen
        </Label>
        {!hasKpis && (
          <span className="text-xs text-muted-foreground">
            Tilføj KPI'er for at teste
          </span>
        )}
      </div>

      {hasKpis && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Periode</Label>
              <Select value={period} onValueChange={(v) => setPeriod(v as TestPeriod)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(periodLabels) as TestPeriod[]).map((p) => (
                    <SelectItem key={p} value={p} className="text-xs">
                      {periodLabels[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Medarbejder</Label>
              <Select 
                value={employeeId || "all"} 
                onValueChange={(v) => setEmployeeId(v === "all" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Alle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">Alle medarbejdere</SelectItem>
                  {employees?.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.first_name} {emp.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={runTest} 
            disabled={isLoading} 
            size="sm" 
            className="w-full h-8"
            variant="secondary"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                Tester...
              </>
            ) : (
              <>
                <Play className="h-3 w-3 mr-1.5" />
                Kør test
              </>
            )}
          </Button>

          {result && (
            <div className="space-y-2 pt-2 border-t">
              {result.errors.length > 0 && (
                <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-500/10 p-2 rounded">
                  <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                  <div>{result.errors.join(", ")}</div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Resultat</span>
                <span className="text-lg font-bold text-primary">
                  {typeof result.value === "number"
                    ? result.value.toLocaleString("da-DK")
                    : result.value}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{result.queryTimeMs}ms</span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                  <span>{kpiSlugsInFormula.length} KPI'er</span>
                </div>
              </div>

              {Object.keys(result.breakdown).length > 0 && (
                <div className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">
                    KPI-værdier
                  </span>
                  <div className="grid gap-1">
                    {Object.entries(result.breakdown).map(([key, value]) => (
                      <div
                        key={key}
                        className="flex items-center justify-between text-xs bg-background px-2 py-1 rounded"
                      >
                        <span className="truncate">{key}</span>
                        <Badge variant="secondary" className="text-xs h-5">
                          {value}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Simple KPI value fetcher - extend as needed
async function fetchKpiValue(
  slug: string,
  startStr: string,
  endStr: string,
  employeeId?: string
): Promise<number> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  
  const { data: sessionData } = await supabase.auth.getSession();
  const authToken = sessionData?.session?.access_token || supabaseKey;
  const headers: Record<string, string> = { 
    apikey: supabaseKey, 
    Authorization: `Bearer ${authToken}`, 
    Accept: "application/json" 
  };

  switch (slug) {
    case "sales_count": {
      // Fetch telesales
      let salesUrl = `${supabaseUrl}/rest/v1/sales?select=id,sale_items(quantity)`;
      salesUrl += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
      if (employeeId) {
        salesUrl += `&agent_id=eq.${employeeId}`;
      }
      
      const salesRes = await fetch(salesUrl, { headers });
      const salesData = salesRes.ok ? await salesRes.json() : [];
      
      let count = 0;
      salesData.forEach((sale: any) => {
        (sale.sale_items || []).forEach((item: any) => {
          count += Number(item.quantity) || 1;
        });
      });

      // Add fieldmarketing
      let fmUrl = `${supabaseUrl}/rest/v1/fieldmarketing_sales?select=id`;
      fmUrl += `&registered_at=gte.${startStr}T00:00:00&registered_at=lte.${endStr}T23:59:59`;
      if (employeeId) {
        fmUrl += `&employee_id=eq.${employeeId}`;
      }
      
      const fmRes = await fetch(fmUrl, { headers: { ...headers, Prefer: "count=exact" } });
      const fmCount = parseInt(fmRes.headers.get("content-range")?.split("/")[1] || "0");
      
      return count + fmCount;
    }

    case "total_commission": {
      let url = `${supabaseUrl}/rest/v1/sales?select=id,sale_items(mapped_commission)`;
      url += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
      if (employeeId) {
        url += `&agent_id=eq.${employeeId}`;
      }
      
      const res = await fetch(url, { headers });
      const data = res.ok ? await res.json() : [];
      
      let total = 0;
      data.forEach((sale: any) => {
        (sale.sale_items || []).forEach((item: any) => {
          total += Number(item.mapped_commission) || 0;
        });
      });
      return Math.round(total);
    }

    case "all_hours": {
      // Use the correct Vagtplan leder hierarchy calculation
      const start = new Date(`${startStr}T00:00:00`);
      const end = new Date(`${endStr}T23:59:59`);
      const result = await calculateHoursByType(start, end, employeeId || undefined);
      return result.totalHours;
    }

    case "sales_hours": {
      // Use the correct Vagtplan leder hierarchy calculation (normal hours = sales hours)
      const start = new Date(`${startStr}T00:00:00`);
      const end = new Date(`${endStr}T23:59:59`);
      const result = await calculateHoursByType(start, end, employeeId || undefined);
      return result.normalHours;
    }

    case "vacation_hours": {
      const start = new Date(`${startStr}T00:00:00`);
      const end = new Date(`${endStr}T23:59:59`);
      const result = await calculateHoursByType(start, end, employeeId || undefined);
      return result.vacationHours;
    }

    case "sick_hours": {
      const start = new Date(`${startStr}T00:00:00`);
      const end = new Date(`${endStr}T23:59:59`);
      const result = await calculateHoursByType(start, end, employeeId || undefined);
      return result.sickHours;
    }

    case "day_off_hours": {
      const start = new Date(`${startStr}T00:00:00`);
      const end = new Date(`${endStr}T23:59:59`);
      const result = await calculateHoursByType(start, end, employeeId || undefined);
      return result.dayOffHours;
    }

    case "lateness_hours": {
      // Lateness hours from lateness_record table (minutes / 60)
      let url = `${supabaseUrl}/rest/v1/lateness_record?select=minutes`;
      url += `&date=gte.${startStr}&date=lte.${endStr}`;
      if (employeeId) {
        url += `&employee_id=eq.${employeeId}`;
      }
      
      const res = await fetch(url, { headers });
      const data = res.ok ? await res.json() : [];
      
      let totalMinutes = 0;
      data.forEach((record: any) => {
        totalMinutes += Number(record.minutes) || 0;
      });
      return Math.round((totalMinutes / 60) * 100) / 100;
    }

    case "shifts": {
      let url = `${supabaseUrl}/rest/v1/shift?select=id`;
      url += `&date=gte.${startStr}&date=lte.${endStr}&shift_type=eq.normal`;
      if (employeeId) {
        url += `&employee_id=eq.${employeeId}`;
      }
      
      const res = await fetch(url, { headers: { ...headers, Prefer: "count=exact" } });
      const count = parseInt(res.headers.get("content-range")?.split("/")[1] || "0");
      return count;
    }

    case "sick_days": {
      let url = `${supabaseUrl}/rest/v1/absence_request_v2?select=id`;
      url += `&type=eq.sick&start_date=gte.${startStr}&start_date=lte.${endStr}`;
      if (employeeId) {
        url += `&employee_id=eq.${employeeId}`;
      }
      
      const res = await fetch(url, { headers: { ...headers, Prefer: "count=exact" } });
      const count = parseInt(res.headers.get("content-range")?.split("/")[1] || "0");
      return count;
    }

    case "vacation_days": {
      let url = `${supabaseUrl}/rest/v1/absence_request_v2?select=id`;
      url += `&type=eq.vacation&start_date=gte.${startStr}&start_date=lte.${endStr}`;
      if (employeeId) {
        url += `&employee_id=eq.${employeeId}`;
      }
      
      const res = await fetch(url, { headers: { ...headers, Prefer: "count=exact" } });
      const count = parseInt(res.headers.get("content-range")?.split("/")[1] || "0");
      return count;
    }

    case "active_employees": {
      const url = `${supabaseUrl}/rest/v1/employee_master_data?select=id&is_active=eq.true`;
      const res = await fetch(url, { headers: { ...headers, Prefer: "count=exact" } });
      const count = parseInt(res.headers.get("content-range")?.split("/")[1] || "0");
      return count;
    }

    case "live_sales_hours": {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const start = new Date(`${startStr}T00:00:00`);
      const end = new Date(`${endStr}T23:59:59`);
      
      // Only count hours for dates UP TO today (not future dates)
      const effectiveEnd = now < end ? now : end;
      
      // 1. Calculate completed sales hours for days BEFORE today
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(23, 59, 59, 999);
      
      let completedHours = 0;
      if (start <= yesterday) {
        const completedEnd = yesterday < end ? yesterday : end;
        const result = await calculateHoursByType(start, completedEnd, employeeId || undefined);
        completedHours = result.normalHours; // normalHours already excludes sick/vacation/day_off/no_show
      }
      
      // 2. Calculate TODAY's live hours (only if today is within period and no absence)
      let todayLiveHours = 0;
      if (todayStr >= startStr && todayStr <= endStr) {
        const hasAbsenceToday = await checkTodayAbsence(employeeId, todayStr);
        
        if (!hasAbsenceToday) {
          todayLiveHours = await calculateTodayLiveHours(employeeId, now);
        }
      }
      
      return Math.round((completedHours + todayLiveHours) * 100) / 100;
    }

    default:
      return 0;
  }
}

// Check if employee has approved absence (sick, vacation, day_off, no_show) today
async function checkTodayAbsence(employeeId: string | null, dateStr: string): Promise<boolean> {
  if (!employeeId) return false;
  
  const { data } = await supabase
    .from("absence_request_v2")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("status", "approved")
    .in("type", ["sick", "vacation", "day_off", "no_show"])
    .lte("start_date", dateStr)
    .gte("end_date", dateStr)
    .limit(1);
  
  return (data?.length || 0) > 0;
}

// Calculate live hours for today based on shift hierarchy
async function calculateTodayLiveHours(employeeId: string | null, now: Date): Promise<number> {
  if (!employeeId) return 0;
  
  const todayStr = format(now, "yyyy-MM-dd");
  const dayOfWeek = now.getDay();
  const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;
  
  // Fetch shift data using hierarchy
  const [
    individualShiftRes,
    employeeStandardShiftRes,
    employeeDataRes,
    teamStandardShiftsRes,
    shiftDaysRes
  ] = await Promise.all([
    // Individual shift for today
    supabase
      .from("shift")
      .select("start_time, end_time, break_minutes")
      .eq("employee_id", employeeId)
      .eq("date", todayStr)
      .maybeSingle(),
    
    // Employee standard shift
    supabase
      .from("employee_standard_shifts")
      .select("shift_id")
      .eq("employee_id", employeeId)
      .maybeSingle(),
    
    // Employee team info
    supabase
      .from("employee_master_data")
      .select("team_id")
      .eq("id", employeeId)
      .single(),
    
    // Team standard shifts
    supabase
      .from("team_standard_shifts")
      .select("id, team_id, is_active, start_time, end_time, hours_source"),
    
    // Shift days
    supabase
      .from("team_standard_shift_days")
      .select("shift_id, day_of_week, start_time, end_time")
  ]);
  
  let shiftStartTime: string | null = null;
  let breakMinutes: number | null = null;
  
  // 1. Individual shift (highest priority)
  if (individualShiftRes.data?.start_time) {
    shiftStartTime = individualShiftRes.data.start_time;
    breakMinutes = individualShiftRes.data.break_minutes;
  }
  // 2. Employee standard shift
  else if (employeeStandardShiftRes.data?.shift_id) {
    const empShiftId = employeeStandardShiftRes.data.shift_id;
    const dayConfig = shiftDaysRes.data?.find(
      d => d.shift_id === empShiftId && d.day_of_week === dayNumber
    );
    if (dayConfig?.start_time) {
      shiftStartTime = dayConfig.start_time;
    } else {
      // Fallback to shift default times
      const shiftDefault = teamStandardShiftsRes.data?.find(s => s.id === empShiftId);
      shiftStartTime = shiftDefault?.start_time || null;
    }
  }
  // 3. Team primary shift
  else if (employeeDataRes.data?.team_id) {
    const teamId = employeeDataRes.data.team_id;
    const teamActiveShift = teamStandardShiftsRes.data?.find(
      s => s.team_id === teamId && s.is_active
    );
    if (teamActiveShift) {
      const dayConfig = shiftDaysRes.data?.find(
        d => d.shift_id === teamActiveShift.id && d.day_of_week === dayNumber
      );
      if (dayConfig?.start_time) {
        shiftStartTime = dayConfig.start_time;
      } else {
        shiftStartTime = teamActiveShift.start_time;
      }
    }
  }
  
  if (!shiftStartTime) return 0;
  
  // Parse shift start time
  const [h, m] = shiftStartTime.split(':').map(Number);
  const shiftStart = new Date(now);
  shiftStart.setHours(h, m, 0, 0);
  
  // If shift hasn't started yet, return 0
  if (now <= shiftStart) return 0;
  
  // Calculate hours elapsed
  const hoursElapsed = (now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
  
  // Apply break: use explicit break_minutes or 30 min if > 6 hours
  const effectiveBreakMins = breakMinutes ?? (hoursElapsed > 6 ? 30 : 0);
  
  return Math.max(0, hoursElapsed - effectiveBreakMins / 60);
}
