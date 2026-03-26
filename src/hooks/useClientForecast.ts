import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format } from "date-fns";
import type { ForecastSettings } from "./useForecastSettings";

export interface EmployeeForecastRow {
  employeeId: string;
  name: string;
  isNew: boolean;
  shiftCount: number;
  actualSales: number;
  salesPerDay: number;
  remainingShifts: number;
  projected: number;
  totalForecast: number;
}

export interface ClientForecastResult {
  actualSalesMtd: number;
  projectedRemaining: number;
  totalForecast: number;
  employees: EmployeeForecastRow[];
  isLoading: boolean;
}

export function useClientForecast(
  teamId: string | undefined,
  settings: ForecastSettings | null | undefined,
  month: number,
  year: number
): ClientForecastResult {
  const today = new Date();
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(new Date(year, month - 1, 1));
  const isCurrentMonth = today.getMonth() + 1 === month && today.getFullYear() === year;
  const cutoffDate = isCurrentMonth ? today : monthEnd;

  const { data, isLoading } = useQuery({
    queryKey: ["client-forecast", teamId, month, year, settings?.id, settings?.updated_at],
    queryFn: async () => {
      if (!teamId || !settings) return { actualSalesMtd: 0, projectedRemaining: 0, totalForecast: 0, employees: [] };

      const threshold = settings.new_seller_threshold;
      const rollingShifts = settings.rolling_avg_shifts;

      // 1. Get team members with employee data
      const { data: members } = await supabase
        .from("team_members")
        .select("employee_id, employee_master_data:employee_id(id, first_name, last_name, work_email)")
        .eq("team_id", teamId);

      if (!members?.length) return { actualSalesMtd: 0, projectedRemaining: 0, totalForecast: 0, employees: [] };

      const employeeIds = members.map(m => m.employee_id);
      const empData = members.map(m => m.employee_master_data as any as { id: string; first_name: string; last_name: string; work_email: string | null }).filter(Boolean);

      const fmtStart = format(monthStart, "yyyy-MM-dd");
      const fmtEnd = format(monthEnd, "yyyy-MM-dd");
      const fmtCutoff = format(cutoffDate, "yyyy-MM-dd");

      // 2. Get actual sales MTD using RPC if client_id is set, otherwise fallback
      const actualSalesMap = new Map<string, number>();

      if (settings.client_id) {
        // Use the same RPC as the reports page for accurate data
        const { data: salesReport } = await supabase.rpc("get_sales_report_detailed", {
          p_client_id: settings.client_id,
          p_start: fmtStart,
          p_end: fmtCutoff,
        });

        if (salesReport) {
          // Build name → employee_id mapping
          const nameToEmpId = new Map<string, string>();
          empData.forEach(e => {
            const fullName = `${e.first_name || ""} ${e.last_name || ""}`.trim();
            if (fullName) nameToEmpId.set(fullName.toLowerCase(), e.id);
          });

          // Also get agent mappings for email-based matching
          const { data: agentMappings } = await supabase
            .from("employee_agent_mapping")
            .select("employee_id, agent:agent_id(email)")
            .in("employee_id", employeeIds);

          // Build email → employee_id mapping
          const emailToEmpId = new Map<string, string>();
          empData.forEach(e => {
            if (e.work_email) emailToEmpId.set(e.work_email.toLowerCase(), e.id);
          });
          agentMappings?.forEach(am => {
            const email = (am.agent as any)?.email?.toLowerCase();
            if (email) emailToEmpId.set(email, am.employee_id);
          });

          // Match RPC results to team employees
          for (const row of salesReport) {
            const empName = (row.employee_name || "").toLowerCase();
            let empId = nameToEmpId.get(empName);

            // Fallback: check if employee_name is actually an email
            if (!empId && empName.includes("@")) {
              empId = emailToEmpId.get(empName);
            }

            if (empId && employeeIds.includes(empId)) {
              actualSalesMap.set(empId, (actualSalesMap.get(empId) || 0) + (row.quantity || 0));
            }
          }
        }
      } else {
        // Fallback: use get_sales_aggregates_v2 with team_id filter
        const { data: aggData } = await supabase.rpc("get_sales_aggregates_v2", {
          p_start: `${fmtStart}T00:00:00+00:00`,
          p_end: `${fmtCutoff}T23:59:59+00:00`,
          p_team_id: teamId,
          p_group_by: "employee",
        });

        if (aggData) {
          for (const row of aggData) {
            const empId = row.group_key;
            if (empId && employeeIds.includes(empId)) {
              actualSalesMap.set(empId, Number(row.total_sales) || 0);
            }
          }
        }
      }

      // 3. Get total shift counts per employee (for new/established classification)
      const { data: shiftCounts } = await supabase
        .from("shift")
        .select("employee_id, date")
        .in("employee_id", employeeIds);

      const totalShiftsMap = new Map<string, number>();
      shiftCounts?.forEach((s: any) => {
        totalShiftsMap.set(s.employee_id, (totalShiftsMap.get(s.employee_id) || 0) + 1);
      });

      // 4. Get remaining shifts (after cutoff until month end)
      const { data: futureShifts } = await supabase
        .from("shift")
        .select("employee_id, date")
        .in("employee_id", employeeIds)
        .gt("date", fmtCutoff)
        .lte("date", fmtEnd);

      const remainingShiftsMap = new Map<string, number>();
      futureShifts?.forEach((s: any) => {
        remainingShiftsMap.set(s.employee_id, (remainingShiftsMap.get(s.employee_id) || 0) + 1);
      });

      // 5. Rolling avg for established employees
      const rollingAvgMap = new Map<string, number>();

      // Get agent mappings (reuse if already fetched, otherwise fetch)
      const { data: agentMappingsForRolling } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent:agent_id(email)")
        .in("employee_id", employeeIds);

      for (const empId of employeeIds) {
        const shiftCount = totalShiftsMap.get(empId) || 0;
        if (shiftCount >= threshold) {
          const emp = empData.find(e => e.id === empId);
          const empEmails: string[] = [];
          if (emp?.work_email) empEmails.push(emp.work_email.toLowerCase());
          agentMappingsForRolling?.filter(am => am.employee_id === empId).forEach(am => {
            const email = (am.agent as any)?.email?.toLowerCase();
            if (email) empEmails.push(email);
          });

          if (empEmails.length > 0) {
            const { data: recentSales } = await supabase
              .from("sales")
              .select("sale_datetime, sale_items:sale_items(quantity, product:product_id(counts_as_sale))")
              .in("agent_email", empEmails)
              .neq("source", "fieldmarketing")
              .order("sale_datetime", { ascending: false })
              .limit(200);

            if (recentSales?.length) {
              const dayMap = new Map<string, number>();
              recentSales.forEach(s => {
                const day = s.sale_datetime?.substring(0, 10);
                if (!day) return;
                const count = (s.sale_items as any[])?.reduce((sum, si) => {
                  return sum + (si.product?.counts_as_sale !== false ? (si.quantity || 1) : 0);
                }, 0) || 0;
                dayMap.set(day, (dayMap.get(day) || 0) + count);
              });
              const sortedDays = Array.from(dayMap.entries())
                .sort((a, b) => b[0].localeCompare(a[0]))
                .slice(0, rollingShifts);

              if (sortedDays.length > 0) {
                const totalSales = sortedDays.reduce((s, [_, v]) => s + v, 0);
                rollingAvgMap.set(empId, totalSales / sortedDays.length);
              }
            }
          }
        }
      }

      // 6. Build employee forecast rows
      const employees: EmployeeForecastRow[] = [];
      let totalActual = 0;
      let totalProjected = 0;

      for (const empId of employeeIds) {
        const emp = empData.find(e => e.id === empId);
        if (!emp) continue;

        const shiftCount = totalShiftsMap.get(empId) || 0;
        const isNew = shiftCount < threshold;
        const actual = actualSalesMap.get(empId) || 0;
        const remaining = remainingShiftsMap.get(empId) || 0;

        let salesPerDay = 0;
        let projected = 0;

        if (isNew) {
          salesPerDay = settings.new_seller_weekly_target / 5;
          projected = salesPerDay * remaining;
          projected *= (1 - settings.churn_new_pct / 100);
        } else {
          salesPerDay = rollingAvgMap.get(empId) || 0;
          projected = salesPerDay * remaining;
          projected *= (1 - settings.churn_established_pct / 100);
        }

        projected *= (1 - settings.sick_pct / 100);
        projected *= (1 - settings.vacation_pct / 100);

        totalActual += actual;
        totalProjected += projected;

        employees.push({
          employeeId: empId,
          name: `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
          isNew,
          shiftCount,
          actualSales: actual,
          salesPerDay: Math.round(salesPerDay * 10) / 10,
          remainingShifts: remaining,
          projected: Math.round(projected),
          totalForecast: actual + Math.round(projected),
        });
      }

      employees.sort((a, b) => b.totalForecast - a.totalForecast);

      return {
        actualSalesMtd: totalActual,
        projectedRemaining: Math.round(totalProjected),
        totalForecast: totalActual + Math.round(totalProjected),
        employees,
      };
    },
    enabled: !!teamId && !!settings,
    staleTime: 5 * 60 * 1000,
  });

  return {
    actualSalesMtd: data?.actualSalesMtd || 0,
    projectedRemaining: data?.projectedRemaining || 0,
    totalForecast: data?.totalForecast || 0,
    employees: data?.employees || [],
    isLoading,
  };
}
