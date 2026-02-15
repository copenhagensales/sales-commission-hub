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
  decimalPlaces?: number;
  multiplier?: number;
  symbol?: string;
  symbolPosition?: 'before' | 'after';
}

interface TestResult {
  value: number | string;
  queryTimeMs: number;
  breakdown: Record<string, number | string>;
  errors: string[];
  formulaDisplay: string;
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

export function FormulaLiveTest({ 
  tokens, 
  formulaName,
  decimalPlaces = 2,
  multiplier = 1,
  symbol = "",
  symbolPosition = "after"
}: FormulaLiveTestProps) {
  const [period, setPeriod] = useState<TestPeriod>("this_month");
  const [employeeId, setEmployeeId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const { data: kpiDefinitions } = useKpiDefinitions();

  // Format value with multiplier, decimals and symbol
  const formatValue = (value: number): string => {
    const multiplied = value * multiplier;
    const formatted = multiplied.toLocaleString("da-DK", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    });
    
    if (symbol) {
      return symbolPosition === "before" 
        ? `${symbol} ${formatted}` 
        : `${formatted} ${symbol}`;
    }
    return formatted;
  };

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
      let noData = false;
      try {
        // Basic safety check - only allow numbers and math operators
        const sanitized = formulaString.replace(/[^0-9+\-*/().  ]/g, "");
        if (sanitized.trim() === "") {
          calculatedValue = 0;
        } else {
          // eslint-disable-next-line no-eval
          calculatedValue = eval(sanitized);
          if (typeof calculatedValue === "number" && !isFinite(calculatedValue)) {
            // Division by zero - show dash to indicate no data available
            calculatedValue = "–";
            noData = true;
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

      // Add info message if no data available (division by zero)
      if (noData) {
        errors.push("Ingen data i perioden (nævner er 0)");
      }

      setResult({
        value: typeof calculatedValue === "number" 
          ? Math.round(calculatedValue * 100) / 100 
          : calculatedValue,
        queryTimeMs,
        breakdown,
        errors,
        formulaDisplay: formulaString.trim(),
      });
    } catch (error) {
      setResult({
        value: "Fejl",
        queryTimeMs: 0,
        breakdown: {},
        errors: [error instanceof Error ? error.message : "Ukendt fejl"],
        formulaDisplay: "",
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
                    ? formatValue(result.value)
                    : result.value}
                </span>
              </div>

              {result.formulaDisplay && (
                <div className="flex items-center justify-between text-xs bg-background px-2 py-1.5 rounded font-mono">
                  <span className="text-muted-foreground">Beregning:</span>
                  <span>
                    {result.formulaDisplay} = {typeof result.value === "number" ? formatValue(result.value) : result.value}
                  </span>
                </div>
              )}

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
      let count = 0;
      
      // 1. Find employee's agent emails via mapping
      let agentEmails: string[] = [];
      
      if (employeeId) {
        const mappingsUrl = `${supabaseUrl}/rest/v1/employee_agent_mapping?select=agents(email,external_dialer_id)&employee_id=eq.${employeeId}`;
        const mappingsRes = await fetch(mappingsUrl, { headers });
        const mappingsData = mappingsRes.ok ? await mappingsRes.json() : [];
        
        mappingsData.forEach((m: any) => {
          if (m.agents?.email) {
            agentEmails.push(m.agents.email.toLowerCase());
          }
          if (m.agents?.external_dialer_id) {
            // Also match on agent-DIALER_ID@adversus.local format
            agentEmails.push(`agent-${m.agents.external_dialer_id}@adversus.local`);
          }
        });
      }
      
      // 2. Build sales query with agent_email filter
      let salesUrl = `${supabaseUrl}/rest/v1/sales?select=id,sale_items(quantity,products(counts_as_sale))&limit=10000`;
      salesUrl += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
      salesUrl += `&source=neq.fieldmarketing`;
      
      if (employeeId && agentEmails.length > 0) {
        // Match on agent_email (case-insensitive)
        const emailFilters = agentEmails
          .map(e => `agent_email.ilike.${encodeURIComponent(e)}`)
          .join(",");
        salesUrl += `&or=(${emailFilters})`;
      } else if (employeeId) {
        // No mapping found - return 0 sales
        return 0;
      }
      
      const salesRes = await fetch(salesUrl, { headers: { ...headers, Range: "0-9999" } });
      const salesData = salesRes.ok ? await salesRes.json() : [];
      
      // 3. Count only products where counts_as_sale = true
      salesData.forEach((sale: any) => {
        (sale.sale_items || []).forEach((item: any) => {
          if (item.products?.counts_as_sale !== false) {
            count += Number(item.quantity) || 1;
          }
        });
      });

      // 4. Add fieldmarketing sales from unified sales table (uses raw_payload->>'fm_seller_id')
      let fmUrl = `${supabaseUrl}/rest/v1/sales?select=id&source=eq.fieldmarketing`;
      fmUrl += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
      if (employeeId) {
        // Filter by employee via raw_payload fm_seller_id
        fmUrl += `&raw_payload->>fm_seller_id=eq.${employeeId}`;
      }
      
      const fmRes = await fetch(fmUrl, { headers: { ...headers, Prefer: "count=exact" } });
      const fmCount = parseInt(fmRes.headers.get("content-range")?.split("/")[1] || "0");
      
      return count + fmCount;
    }

    case "total_commission": {
      // 1. Find employee's agent emails via mapping
      let agentEmails: string[] = [];
      
      if (employeeId) {
        const mappingsUrl = `${supabaseUrl}/rest/v1/employee_agent_mapping?select=agents(email,external_dialer_id)&employee_id=eq.${employeeId}`;
        const mappingsRes = await fetch(mappingsUrl, { headers });
        const mappingsData = mappingsRes.ok ? await mappingsRes.json() : [];
        
        mappingsData.forEach((m: any) => {
          if (m.agents?.email) {
            agentEmails.push(m.agents.email.toLowerCase());
          }
          if (m.agents?.external_dialer_id) {
            agentEmails.push(`agent-${m.agents.external_dialer_id}@adversus.local`);
          }
        });
      }
      
      // 2. Build query with agent_email filter
      let url = `${supabaseUrl}/rest/v1/sales?select=id,sale_items(mapped_commission)&limit=10000`;
      url += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
      url += `&source=neq.fieldmarketing`;
      
      if (employeeId && agentEmails.length > 0) {
        const emailFilters = agentEmails
          .map(e => `agent_email.ilike.${encodeURIComponent(e)}`)
          .join(",");
        url += `&or=(${emailFilters})`;
      } else if (employeeId) {
        return 0;
      }
      
      const res = await fetch(url, { headers: { ...headers, Range: "0-9999" } });
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

    case "total_revenue": {
      // 1. Find employee's agent emails via mapping
      let agentEmails: string[] = [];
      
      if (employeeId) {
        const mappingsUrl = `${supabaseUrl}/rest/v1/employee_agent_mapping?select=agents(email,external_dialer_id)&employee_id=eq.${employeeId}`;
        const mappingsRes = await fetch(mappingsUrl, { headers });
        const mappingsData = mappingsRes.ok ? await mappingsRes.json() : [];
        
        mappingsData.forEach((m: any) => {
          if (m.agents?.email) {
            agentEmails.push(m.agents.email.toLowerCase());
          }
          if (m.agents?.external_dialer_id) {
            agentEmails.push(`agent-${m.agents.external_dialer_id}@adversus.local`);
          }
        });
      }
      
      // 2. Build query with agent_email filter for telesales revenue
      let url = `${supabaseUrl}/rest/v1/sales?select=id,sale_items(mapped_revenue)&limit=10000`;
      url += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
      
      if (employeeId && agentEmails.length > 0) {
        const emailFilters = agentEmails
          .map(e => `agent_email.ilike.${encodeURIComponent(e)}`)
          .join(",");
        url += `&or=(${emailFilters})`;
      } else if (employeeId) {
        // No mapping found for specific employee
        return 0;
      }
      
      const res = await fetch(url, { headers: { ...headers, Range: "0-9999" } });
      const data = res.ok ? await res.json() : [];
      
      let total = 0;
      data.forEach((sale: any) => {
        (sale.sale_items || []).forEach((item: any) => {
          total += Number(item.mapped_revenue) || 0;
        });
      });
      
      // 3. Also add fieldmarketing sales revenue from unified sales table
      // Note: FM sales revenue comes from product lookup, not stored revenue
      let fmUrl = `${supabaseUrl}/rest/v1/sales?select=id,raw_payload&source=eq.fieldmarketing`;
      fmUrl += `&sale_datetime=gte.${startStr}T00:00:00&sale_datetime=lte.${endStr}T23:59:59`;
      if (employeeId) {
        fmUrl += `&raw_payload->>fm_seller_id=eq.${employeeId}`;
      }
      
      const fmRes = await fetch(fmUrl, { headers });
      const fmData = fmRes.ok ? await fmRes.json() : [];
      // FM revenue would require product lookup - skip for now since it's complex
      // and the main revenue already comes from sale_items
      
      return Math.round(total);
    }

    case "live_sales_hours": {
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const start = new Date(`${startStr}T00:00:00`);
      const end = new Date(`${endStr}T23:59:59`);
      
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
      
      // 2. Calculate TODAY's live hours (only if today is within period)
      let todayLiveHours = 0;
      if (todayStr >= startStr && todayStr <= endStr) {
        todayLiveHours = await calculateTodayLiveHours(employeeId || null, now);
      }
      
      return Math.round((completedHours + todayLiveHours) * 100) / 100;
    }

    case "all_shift_types": {
      // Generer alle datoer i perioden
      const dates: string[] = [];
      const currentDate = new Date(startStr);
      const endDate = new Date(endStr);
      while (currentDate <= endDate) {
        dates.push(format(currentDate, "yyyy-MM-dd"));
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Hent medarbejdere
      let employeesToCheck: { id: string; team_id: string | null }[] = [];
      if (employeeId) {
        const empRes = await fetch(`${supabaseUrl}/rest/v1/employee_master_data?select=id,team_id&id=eq.${employeeId}`, { headers });
        const empData = empRes.ok ? await empRes.json() : [];
        employeesToCheck = empData;
      } else {
        const empsRes = await fetch(`${supabaseUrl}/rest/v1/employee_master_data?select=id,team_id&is_active=eq.true`, { headers });
        employeesToCheck = empsRes.ok ? await empsRes.json() : [];
      }

      if (employeesToCheck.length === 0) return 0;

      const employeeIds = employeesToCheck.map(e => e.id);

      // Hent alle vagtkilder parallelt
      const [individualRes, empStandardRes, teamMembersRes, teamShiftsRes, shiftDaysRes, absencesRes] = await Promise.all([
        // 1. Individuelle vagter
        fetch(`${supabaseUrl}/rest/v1/shift?select=employee_id,date&employee_id=in.(${employeeIds.join(",")})&date=gte.${startStr}&date=lte.${endStr}`, { headers }),
        // 2. Medarbejder-standardvagter
        fetch(`${supabaseUrl}/rest/v1/employee_standard_shifts?select=employee_id,shift_id&employee_id=in.(${employeeIds.join(",")})`, { headers }),
        // 3. Team-medlemskaber
        fetch(`${supabaseUrl}/rest/v1/team_members?select=employee_id,team_id&employee_id=in.(${employeeIds.join(",")})`, { headers }),
        // 4. Team-standardvagter
        fetch(`${supabaseUrl}/rest/v1/team_standard_shifts?select=id,team_id,is_active`, { headers }),
        // 5. Vagtdage per shift
        fetch(`${supabaseUrl}/rest/v1/team_standard_shift_days?select=shift_id,day_of_week`, { headers }),
        // 6. Godkendte fraværsdage (syg/ferie ekskluderes)
        fetch(`${supabaseUrl}/rest/v1/absence_request_v2?select=employee_id,start_date,end_date&employee_id=in.(${employeeIds.join(",")})&status=eq.approved&type=in.(sick,vacation)&start_date=lte.${endStr}&end_date=gte.${startStr}`, { headers }),
      ]);

      const individualShifts = individualRes.ok ? await individualRes.json() : [];
      const empStandardShifts = empStandardRes.ok ? await empStandardRes.json() : [];
      const teamMembers = teamMembersRes.ok ? await teamMembersRes.json() : [];
      const teamShifts = teamShiftsRes.ok ? await teamShiftsRes.json() : [];
      const shiftDays = shiftDaysRes.ok ? await shiftDaysRes.json() : [];
      const absences = absencesRes.ok ? await absencesRes.json() : [];

      // Byg lookup maps
      const shiftDaysMap = new Map<string, number[]>();
      shiftDays.forEach((sd: any) => {
        if (!shiftDaysMap.has(sd.shift_id)) shiftDaysMap.set(sd.shift_id, []);
        shiftDaysMap.get(sd.shift_id)!.push(sd.day_of_week);
      });

      const teamActiveShiftMap = new Map<string, string>();
      teamShifts.forEach((s: any) => {
        if (s.is_active) teamActiveShiftMap.set(s.team_id, s.id);
      });

      const individualShiftMap = new Map<string, Set<string>>();
      individualShifts.forEach((s: any) => {
        if (!individualShiftMap.has(s.employee_id)) individualShiftMap.set(s.employee_id, new Set());
        individualShiftMap.get(s.employee_id)!.add(s.date);
      });

      const empShiftIdMap = new Map<string, string>();
      empStandardShifts.forEach((s: any) => empShiftIdMap.set(s.employee_id, s.shift_id));

      const employeeTeamMap = new Map<string, string>();
      teamMembers.forEach((m: any) => {
        if (m.team_id) employeeTeamMap.set(m.employee_id, m.team_id);
      });

      // Byg fraværsdatoer per medarbejder
      const absenceDateMap = new Map<string, Set<string>>();
      absences.forEach((a: any) => {
        if (!absenceDateMap.has(a.employee_id)) absenceDateMap.set(a.employee_id, new Set());
        const absStart = new Date(a.start_date);
        const absEnd = new Date(a.end_date);
        const curr = new Date(absStart);
        while (curr <= absEnd) {
          absenceDateMap.get(a.employee_id)!.add(format(curr, "yyyy-MM-dd"));
          curr.setDate(curr.getDate() + 1);
        }
      });

      // Tæl vagter efter hierarki
      let totalShifts = 0;
      for (const employee of employeesToCheck) {
        const empId = employee.id;
        const teamId = employeeTeamMap.get(empId) || employee.team_id;
        const absenceDates = absenceDateMap.get(empId) || new Set();
        const individualDates = individualShiftMap.get(empId) || new Set();
        
        const empShiftId = empShiftIdMap.get(empId);
        const empStandardDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;
        const teamActiveShiftId = teamId ? teamActiveShiftMap.get(teamId) : undefined;
        const teamDays = teamActiveShiftId ? shiftDaysMap.get(teamActiveShiftId) : undefined;

        for (const dateStr of dates) {
          if (absenceDates.has(dateStr)) continue;

          const dayOfWeek = new Date(dateStr).getDay();
          const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;

          if (individualDates.has(dateStr)) {
            totalShifts++;
          } else if (empStandardDays?.includes(dayNumber)) {
            totalShifts++;
          } else if (teamDays?.includes(dayNumber)) {
            totalShifts++;
          }
        }
      }

      return totalShifts;
    }

    case "day_off_days": {
      // Tæl fridage fra absence_request_v2
      let url = `${supabaseUrl}/rest/v1/absence_request_v2?select=id`;
      url += `&type=eq.day_off&start_date=gte.${startStr}&start_date=lte.${endStr}&status=eq.approved`;
      if (employeeId) {
        url += `&employee_id=eq.${employeeId}`;
      }
      
      const res = await fetch(url, { headers: { ...headers, Prefer: "count=exact" } });
      const count = parseInt(res.headers.get("content-range")?.split("/")[1] || "0");
      return count;
    }

    case "lateness_days": {
      // Tæl unikke forsinkelsesdage
      let url = `${supabaseUrl}/rest/v1/lateness_record?select=date`;
      url += `&date=gte.${startStr}&date=lte.${endStr}`;
      if (employeeId) {
        url += `&employee_id=eq.${employeeId}`;
      }
      
      const res = await fetch(url, { headers });
      const data = res.ok ? await res.json() : [];
      const uniqueDates = new Set(data.map((r: any) => r.date));
      return uniqueDates.size;
    }

    case "calls_total": {
      // Hent totale opkald fra dialer_calls tabellen
      let url = `${supabaseUrl}/rest/v1/dialer_calls?select=id`;
      url += `&call_start=gte.${startStr}T00:00:00&call_start=lte.${endStr}T23:59:59`;
      if (employeeId) {
        url += `&employee_id=eq.${employeeId}`;
      }
      
      const res = await fetch(url, { headers: { ...headers, Prefer: "count=exact" } });
      const count = parseInt(res.headers.get("content-range")?.split("/")[1] || "0");
      return count;
    }

    case "calls_answered": {
      // Hent besvarede opkald (connected > 0 eller is_answered)
      let url = `${supabaseUrl}/rest/v1/dialer_calls?select=id`;
      url += `&call_start=gte.${startStr}T00:00:00&call_start=lte.${endStr}T23:59:59`;
      url += `&connected=gt.0`;
      if (employeeId) {
        url += `&employee_id=eq.${employeeId}`;
      }
      
      const res = await fetch(url, { headers: { ...headers, Prefer: "count=exact" } });
      const count = parseInt(res.headers.get("content-range")?.split("/")[1] || "0");
      return count;
    }

    default:
      return 0;
  }
}

// Calculate live hours for today based on shift hierarchy
// Supports both single employee and all employees (when employeeId is null)
async function calculateTodayLiveHours(employeeId: string | null, now: Date): Promise<number> {
  const todayStr = format(now, "yyyy-MM-dd");
  const dayOfWeek = now.getDay();
  const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek;
  
  // Determine which employees to calculate for
  let employeeIds: string[] = [];
  
  if (employeeId) {
    employeeIds = [employeeId];
  } else {
    // Fetch all active employees
    const { data: emps } = await supabase
      .from("employee_master_data")
      .select("id")
      .eq("is_active", true);
    employeeIds = (emps || []).map(e => e.id);
  }
  
  if (employeeIds.length === 0) return 0;
  
  // Fetch all needed data in parallel for all employees
  const [
    individualShiftsRes,
    employeeStandardShiftsRes,
    teamMembersRes,
    teamStandardShiftsRes,
    shiftDaysRes,
    absencesRes
  ] = await Promise.all([
    // Individual shifts for today
    supabase
      .from("shift")
      .select("employee_id, start_time, end_time, break_minutes")
      .eq("date", todayStr)
      .in("employee_id", employeeIds),
    
    // Employee standard shifts
    supabase
      .from("employee_standard_shifts")
      .select("employee_id, shift_id")
      .in("employee_id", employeeIds),
    
    // Team members (authoritative source for team membership)
    supabase
      .from("team_members")
      .select("employee_id, team_id")
      .in("employee_id", employeeIds),
    
    // Team standard shifts
    supabase
      .from("team_standard_shifts")
      .select("id, team_id, is_active, start_time, end_time, hours_source"),
    
    // Shift days
    supabase
      .from("team_standard_shift_days")
      .select("shift_id, day_of_week, start_time, end_time"),
    
    // Absences for today
    supabase
      .from("absence_request_v2")
      .select("employee_id")
      .eq("status", "approved")
      .in("type", ["sick", "vacation", "day_off", "no_show"])
      .lte("start_date", todayStr)
      .gte("end_date", todayStr)
      .in("employee_id", employeeIds)
  ]);
  
  const individualShifts = individualShiftsRes.data || [];
  const employeeStandardShifts = employeeStandardShiftsRes.data || [];
  const teamMembers = teamMembersRes.data || [];
  const teamStandardShifts = teamStandardShiftsRes.data || [];
  const shiftDays = shiftDaysRes.data || [];
  const absences = new Set((absencesRes.data || []).map(a => a.employee_id));
  
  // Build employee -> team map from team_members (authoritative source)
  const employeeTeamMap = new Map<string, string>();
  teamMembers.forEach(m => {
    if (m.team_id) employeeTeamMap.set(m.employee_id, m.team_id);
  });
  
  let totalLiveHours = 0;
  
  for (const empId of employeeIds) {
    // Skip if employee has absence today
    if (absences.has(empId)) continue;
    
    let shiftStartTime: string | null = null;
    let breakMinutes: number | null = null;
    
    // 1. Individual shift (highest priority)
    const individualShift = individualShifts.find(s => s.employee_id === empId);
    if (individualShift?.start_time) {
      shiftStartTime = individualShift.start_time;
      breakMinutes = individualShift.break_minutes;
    }
    // 2. Employee standard shift
    else {
      const empStandardShift = employeeStandardShifts.find(s => s.employee_id === empId);
      if (empStandardShift?.shift_id) {
        const empShiftId = empStandardShift.shift_id;
        const dayConfig = shiftDays.find(
          d => d.shift_id === empShiftId && d.day_of_week === dayNumber
        );
        if (dayConfig?.start_time) {
          shiftStartTime = dayConfig.start_time;
        } else {
          // Fallback to shift default times
          const shiftDefault = teamStandardShifts.find(s => s.id === empShiftId);
          shiftStartTime = shiftDefault?.start_time || null;
        }
      }
      // 3. Team primary shift (using team_members as authoritative source)
      else {
        const teamId = employeeTeamMap.get(empId);
        if (teamId) {
          const teamActiveShift = teamStandardShifts.find(
            s => s.team_id === teamId && s.is_active
          );
          if (teamActiveShift) {
            const dayConfig = shiftDays.find(
              d => d.shift_id === teamActiveShift.id && d.day_of_week === dayNumber
            );
            if (dayConfig?.start_time) {
              shiftStartTime = dayConfig.start_time;
            } else {
              shiftStartTime = teamActiveShift.start_time;
            }
          }
        }
      }
    }
    
    if (!shiftStartTime) continue;
    
    // Parse shift start time
    const [h, m] = shiftStartTime.split(':').map(Number);
    const shiftStart = new Date(now);
    shiftStart.setHours(h, m, 0, 0);
    
    // If shift hasn't started yet, skip
    if (now <= shiftStart) continue;
    
    // Calculate hours elapsed
    const hoursElapsed = (now.getTime() - shiftStart.getTime()) / (1000 * 60 * 60);
    
    // Apply break: use explicit break_minutes or 30 min if > 6 hours
    const effectiveBreakMins = breakMinutes ?? (hoursElapsed > 6 ? 30 : 0);
    
    totalLiveHours += Math.max(0, hoursElapsed - effectiveBreakMins / 60);
  }
  
  return totalLiveHours;
}
