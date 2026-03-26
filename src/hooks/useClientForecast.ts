import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format, eachDayOfInterval, addDays, differenceInCalendarDays } from "date-fns";
import type { ForecastSettings } from "./useForecastSettings";

export interface EmployeeForecastRow {
  employeeId: string;
  name: string;
  isNew: boolean;
  isStopped: boolean;
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

/** Count weekdays (Mon-Fri) in an interval */
function countWeekdays(start: Date, end: Date): number {
  if (start > end) return 0;
  return eachDayOfInterval({ start, end }).filter(d => {
    const dow = d.getDay();
    return dow !== 0 && dow !== 6;
  }).length;
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
    queryKey: ["client-forecast-v3", teamId, month, year, settings?.id, settings?.updated_at],
    queryFn: async () => {
      if (!teamId || !settings) return { actualSalesMtd: 0, projectedRemaining: 0, totalForecast: 0, employees: [] };

      const threshold = settings.new_seller_threshold;
      const rollingShifts = settings.rolling_avg_shifts;

      // 1. Get team members with employee data
      const { data: members } = await supabase
        .from("team_members")
        .select("employee_id, team_id, employee_master_data:employee_id(id, first_name, last_name, work_email, employment_start_date)")
        .eq("team_id", teamId);

      if (!members?.length) return { actualSalesMtd: 0, projectedRemaining: 0, totalForecast: 0, employees: [] };

      const employeeIds = members.map(m => m.employee_id);
      const empData = members.map(m => m.employee_master_data as any as {
        id: string; first_name: string; last_name: string; work_email: string | null; employment_start_date: string | null;
      }).filter(Boolean);

      const fmtStart = format(monthStart, "yyyy-MM-dd");
      const fmtEnd = format(monthEnd, "yyyy-MM-dd");
      const fmtCutoff = format(cutoffDate, "yyyy-MM-dd");

      // 2. Simple calendar-based shift counts (same for everyone)
      const shiftCountMtd = countWeekdays(monthStart, cutoffDate);
      const remainingShifts = countWeekdays(addDays(cutoffDate, 1), monthEnd);

      // 3. Get actual sales MTD
      const actualSalesMap = new Map<string, number>();
      // Track unmatched sales by name for stopped employees
      const unmatchedSalesMap = new Map<string, number>();
      let totalActualAllSales = 0;

      if (settings.client_id) {
        const { data: salesReport } = await supabase.rpc("get_sales_report_detailed", {
          p_client_id: settings.client_id,
          p_start: fmtStart,
          p_end: fmtCutoff,
        });

        if (salesReport) {
          const nameToEmpId = new Map<string, string>();
          empData.forEach(e => {
            const fullName = `${e.first_name || ""} ${e.last_name || ""}`.trim();
            if (fullName) nameToEmpId.set(fullName.toLowerCase(), e.id);
          });

          const { data: agentMappings } = await supabase
            .from("employee_agent_mapping")
            .select("employee_id, agent:agent_id(email)")
            .in("employee_id", employeeIds);

          const emailToEmpId = new Map<string, string>();
          empData.forEach(e => {
            if (e.work_email) emailToEmpId.set(e.work_email.toLowerCase(), e.id);
          });
          agentMappings?.forEach(am => {
            const email = (am.agent as any)?.email?.toLowerCase();
            if (email) emailToEmpId.set(email, am.employee_id);
          });

          for (const row of salesReport) {
            const qty = row.quantity || 0;
            totalActualAllSales += qty;
            const empName = (row.employee_name || "").toLowerCase();
            let empId = nameToEmpId.get(empName);
            if (!empId && empName.includes("@")) {
              empId = emailToEmpId.get(empName);
            }
            if (empId && employeeIds.includes(empId)) {
              actualSalesMap.set(empId, (actualSalesMap.get(empId) || 0) + qty);
            } else if (qty > 0) {
              // Unmatched - likely a stopped employee
              const key = row.employee_name || "Ukendt";
              unmatchedSalesMap.set(key, (unmatchedSalesMap.get(key) || 0) + qty);
            }
          }
        }
      } else {
        const { data: aggData } = await supabase.rpc("get_sales_aggregates_v2", {
          p_start: `${fmtStart}T00:00:00+00:00`,
          p_end: `${fmtCutoff}T23:59:59+00:00`,
          p_team_id: teamId,
          p_group_by: "employee",
        });

        if (aggData) {
          for (const row of aggData) {
            const sales = Number(row.total_sales) || 0;
            totalActualAllSales += sales;
            const empId = row.group_key;
            if (empId && employeeIds.includes(empId)) {
              actualSalesMap.set(empId, sales);
            }
          }
        }
      }

      // 4. Determine isNew based on employment_start_date workdays
      const isNewMap = new Map<string, boolean>();
      for (const emp of empData) {
        if (!emp.employment_start_date) {
          isNewMap.set(emp.id, true);
          continue;
        }
        const startDate = new Date(emp.employment_start_date);
        const workdaysSinceStart = countWeekdays(startDate, today);
        isNewMap.set(emp.id, workdaysSinceStart < threshold);
      }

      // 5. Rolling avg for established employees
      const rollingAvgMap = new Map<string, number>();

      const { data: agentMappingsForRolling } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent:agent_id(email)")
        .in("employee_id", employeeIds);

      for (const empId of employeeIds) {
        if (isNewMap.get(empId)) continue;

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

      // 6. Build employee forecast rows
      const employees: EmployeeForecastRow[] = [];
      let totalProjected = 0;

      for (const empId of employeeIds) {
        const emp = empData.find(e => e.id === empId);
        if (!emp) continue;

        const isNew = isNewMap.get(empId) ?? true;
        const actual = actualSalesMap.get(empId) || 0;

        let salesPerDay = 0;
        let projected = 0;

        if (isNew) {
          salesPerDay = settings.new_seller_weekly_target / 5;
          projected = salesPerDay * remainingShifts;
          projected *= (1 - settings.churn_new_pct / 100);
        } else {
          salesPerDay = rollingAvgMap.get(empId) || 0;
          projected = salesPerDay * remainingShifts;
          projected *= (1 - settings.churn_established_pct / 100);
        }

        projected *= (1 - settings.sick_pct / 100);
        projected *= (1 - settings.vacation_pct / 100);

        totalProjected += projected;

        employees.push({
          employeeId: empId,
          name: `${emp.first_name || ""} ${emp.last_name || ""}`.trim(),
          isNew,
          isStopped: false,
          shiftCount: shiftCountMtd,
          actualSales: actual,
          salesPerDay: Math.round(salesPerDay * 10) / 10,
          remainingShifts: remainingShifts,
          projected: Math.round(projected),
          totalForecast: actual + Math.round(projected),
        });
      }

      // 7. Add stopped employees with unmatched sales
      for (const [name, sales] of unmatchedSalesMap) {
        employees.push({
          employeeId: `stopped-${name}`,
          name,
          isNew: false,
          isStopped: true,
          shiftCount: 0,
          actualSales: sales,
          salesPerDay: 0,
          remainingShifts: 0,
          projected: 0,
          totalForecast: sales,
        });
      }

      employees.sort((a, b) => b.totalForecast - a.totalForecast);

      return {
        actualSalesMtd: totalActualAllSales,
        projectedRemaining: Math.round(totalProjected),
        totalForecast: totalActualAllSales + Math.round(totalProjected),
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
