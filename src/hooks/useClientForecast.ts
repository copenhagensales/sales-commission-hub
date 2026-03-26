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

      // 1. Get team members
      const { data: members } = await supabase
        .from("team_members")
        .select("employee_id, employee_master_data:employee_id(id, first_name, last_name)")
        .eq("team_id", teamId);

      if (!members?.length) return { actualSalesMtd: 0, projectedRemaining: 0, totalForecast: 0, employees: [] };

      const employeeIds = members.map(m => m.employee_id);
      const fmtStart = format(monthStart, "yyyy-MM-dd");
      const fmtEnd = format(monthEnd, "yyyy-MM-dd");
      const fmtCutoff = format(cutoffDate, "yyyy-MM-dd");

      // 2. Get actual sales MTD for each employee (up to cutoff)
      const { data: salesData } = await supabase
        .from("sales")
        .select("agent_email, sale_items:sale_items(quantity, product:product_id(counts_as_sale))")
        .gte("sale_datetime", fmtStart)
        .lte("sale_datetime", fmtCutoff + "T23:59:59")
        .neq("source", "fieldmarketing");

      // Get employee emails for matching
      const { data: empData } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, work_email")
        .in("id", employeeIds);

      const emailToEmp = new Map<string, { id: string; first_name: string; last_name: string }>();
      empData?.forEach(e => {
        if (e.work_email) emailToEmp.set(e.work_email.toLowerCase(), e);
      });

      // Also get agent mappings
      const { data: agentMappings } = await supabase
        .from("employee_agent_mapping")
        .select("employee_id, agent:agent_id(email)")
        .in("employee_id", employeeIds);

      agentMappings?.forEach(am => {
        const emp = empData?.find(e => e.id === am.employee_id);
        const email = (am.agent as any)?.email?.toLowerCase();
        if (emp && email) emailToEmp.set(email, emp);
      });

      // Count actual sales per employee
      const actualSalesMap = new Map<string, number>();
      salesData?.forEach(sale => {
        const email = sale.agent_email?.toLowerCase();
        if (!email) return;
        const emp = emailToEmp.get(email);
        if (!emp || !employeeIds.includes(emp.id)) return;
        const saleCount = (sale.sale_items as any[])?.reduce((sum, si) => {
          const countsAsSale = si.product?.counts_as_sale !== false;
          return sum + (countsAsSale ? (si.quantity || 1) : 0);
        }, 0) || 0;
        actualSalesMap.set(emp.id, (actualSalesMap.get(emp.id) || 0) + saleCount);
      });

      // 3. For each employee, determine shift count (historical) to classify new/established
      // Use booking_assignment as proxy for shift count
      const { data: shiftCounts } = await supabase
        .from("booking_assignment")
        .select("employee_id, date")
        .in("employee_id", employeeIds);

      const totalShiftsMap = new Map<string, number>();
      shiftCounts?.forEach(s => {
        totalShiftsMap.set(s.employee_id, (totalShiftsMap.get(s.employee_id) || 0) + 1);
      });

      // Also check shift_assignments for non-FM teams
      const { data: shiftAssignments } = await supabase
        .from("shift_assignments")
        .select("employee_id")
        .in("employee_id", employeeIds);

      shiftAssignments?.forEach(s => {
        totalShiftsMap.set(s.employee_id, (totalShiftsMap.get(s.employee_id) || 0) + 1);
      });

      // 4. Get remaining shifts for each employee (after cutoff until month end)
      const { data: futureShifts } = await supabase
        .from("booking_assignment")
        .select("employee_id, date")
        .in("employee_id", employeeIds)
        .gt("date", fmtCutoff)
        .lte("date", fmtEnd);

      const remainingShiftsMap = new Map<string, number>();
      futureShifts?.forEach(s => {
        remainingShiftsMap.set(s.employee_id, (remainingShiftsMap.get(s.employee_id) || 0) + 1);
      });

      // Also check shift_assignments for remaining
      const { data: futureShiftAssignments } = await supabase
        .from("shift_assignments")
        .select("employee_id, date")
        .in("employee_id", employeeIds)
        .gt("date", fmtCutoff)
        .lte("date", fmtEnd);

      futureShiftAssignments?.forEach(s => {
        remainingShiftsMap.set(s.employee_id, (remainingShiftsMap.get(s.employee_id) || 0) + 1);
      });

      // 5. For established employees, get rolling avg of last N shifts
      const rollingAvgMap = new Map<string, number>();
      for (const empId of employeeIds) {
        const shiftCount = totalShiftsMap.get(empId) || 0;
        if (shiftCount >= threshold) {
          // Get last N sales-days for this employee via sales aggregated by day
          const emp = empData?.find(e => e.id === empId);
          const empEmails: string[] = [];
          if (emp?.work_email) empEmails.push(emp.work_email.toLowerCase());
          agentMappings?.filter(am => am.employee_id === empId).forEach(am => {
            const email = (am.agent as any)?.email?.toLowerCase();
            if (email) empEmails.push(email);
          });

          if (empEmails.length > 0) {
            // Get sales grouped by date, last N shift-days
            const { data: recentSales } = await supabase
              .from("sales")
              .select("sale_datetime, sale_items:sale_items(quantity, product:product_id(counts_as_sale))")
              .in("agent_email", empEmails)
              .neq("source", "fieldmarketing")
              .order("sale_datetime", { ascending: false })
              .limit(200);

            if (recentSales?.length) {
              // Group by date, take last N unique days
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
        const emp = empData?.find(e => e.id === empId);
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

        // Apply sick and vacation adjustments to projected only
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
