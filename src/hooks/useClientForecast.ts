import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, format, eachDayOfInterval, addDays } from "date-fns";
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

/**
 * Determines if a given date is a working day using the shift hierarchy:
 * 1. Individual shifts (shift table)
 * 2. Employee standard shifts
 * 3. Team standard shifts
 * 4. Fallback: weekdays (Mon-Fri)
 */
function isWorkingDay(
  dateStr: string,
  day: Date,
  empId: string,
  individualShiftDates: Set<string>,
  empStandardDays: Map<string, number[]>,
  teamStandardDays: number[],
  absenceDates: Set<string>,
): boolean {
  // Skip absences
  if (absenceDates.has(`${empId}:${dateStr}`)) return false;

  // 1. Individual shift exists for this date
  if (individualShiftDates.has(`${empId}:${dateStr}`)) return true;

  // For standard shifts, check day of week (ISO: Mon=1..Sun=7)
  const dow = day.getDay();
  const isoDow = dow === 0 ? 7 : dow;

  // 2. Employee standard shifts
  const empDays = empStandardDays.get(empId);
  if (empDays && empDays.length > 0) return empDays.includes(isoDow);

  // 3. Team standard shifts
  if (teamStandardDays.length > 0) return teamStandardDays.includes(isoDow);

  // 4. Fallback: weekdays
  return dow !== 0 && dow !== 6;
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

      // 1. Get team members with employee data (including employment_start_date)
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

      // 2. Fetch all scheduling data in parallel
      const [
        individualShiftsRes,
        empStandardShiftsRes,
        teamStandardShiftsRes,
        shiftDaysRes,
        absencesRes,
      ] = await Promise.all([
        // Individual shifts for these employees (all time, for historical count)
        supabase
          .from("shift")
          .select("employee_id, date")
          .in("employee_id", employeeIds),
        // Employee standard shifts
        supabase
          .from("employee_standard_shifts")
          .select("employee_id, shift_id")
          .in("employee_id", employeeIds),
        // Team standard shifts
        supabase
          .from("team_standard_shifts")
          .select("id, is_active")
          .eq("team_id", teamId),
        // All shift days (for both employee and team standard shifts)
        supabase
          .from("team_standard_shift_days")
          .select("shift_id, day_of_week"),
        // Approved absences for these employees
        supabase
          .from("absence_request_v2")
          .select("employee_id, start_date, end_date")
          .in("employee_id", employeeIds)
          .eq("status", "approved"),
      ]);

      // Build individual shift date set: "empId:yyyy-MM-dd"
      const individualShiftDates = new Set<string>();
      (individualShiftsRes.data || []).forEach((s: any) => {
        individualShiftDates.add(`${s.employee_id}:${s.date}`);
      });

      // Build employee standard days map: empId → day_of_week[]
      const allShiftDays = shiftDaysRes.data || [];
      const empStandardDays = new Map<string, number[]>();
      (empStandardShiftsRes.data || []).forEach((es: any) => {
        const days = allShiftDays
          .filter((sd: any) => sd.shift_id === es.shift_id)
          .map((sd: any) => sd.day_of_week as number);
        const existing = empStandardDays.get(es.employee_id) || [];
        empStandardDays.set(es.employee_id, [...existing, ...days]);
      });

      // Build team standard days: day_of_week[]
      const activeTeamShift = (teamStandardShiftsRes.data || []).find((s: any) => s.is_active);
      const teamStandardDays: number[] = activeTeamShift
        ? allShiftDays
            .filter((sd: any) => sd.shift_id === activeTeamShift.id)
            .map((sd: any) => sd.day_of_week as number)
        : [];

      // Build absence date set: "empId:yyyy-MM-dd"
      const absenceDates = new Set<string>();
      (absencesRes.data || []).forEach((a: any) => {
        try {
          const absStart = new Date(a.start_date);
          const absEnd = new Date(a.end_date);
          eachDayOfInterval({ start: absStart, end: absEnd }).forEach(day => {
            absenceDates.add(`${a.employee_id}:${format(day, "yyyy-MM-dd")}`);
          });
        } catch { /* skip invalid dates */ }
      });

      // 3. Calculate shift counts and remaining shifts per employee
      const totalShiftsMap = new Map<string, number>();
      const remainingShiftsMap = new Map<string, number>();

      for (const emp of empData) {
        // Historical shift count: from employment_start_date to cutoff
        const empStart = emp.employment_start_date ? new Date(emp.employment_start_date) : null;
        let historicalCount = 0;

        if (empStart && empStart <= cutoffDate) {
          const countStart = empStart;
          const countEnd = cutoffDate;
          const days = eachDayOfInterval({ start: countStart, end: countEnd });
          for (const day of days) {
            const ds = format(day, "yyyy-MM-dd");
            if (isWorkingDay(ds, day, emp.id, individualShiftDates, empStandardDays, teamStandardDays, absenceDates)) {
              historicalCount++;
            }
          }
        }
        totalShiftsMap.set(emp.id, historicalCount);

        // Remaining shifts: from day after cutoff to month end
        let remaining = 0;
        const remStart = addDays(cutoffDate, 1);
        if (remStart <= monthEnd) {
          const days = eachDayOfInterval({ start: remStart, end: monthEnd });
          for (const day of days) {
            const ds = format(day, "yyyy-MM-dd");
            if (isWorkingDay(ds, day, emp.id, individualShiftDates, empStandardDays, teamStandardDays, absenceDates)) {
              remaining++;
            }
          }
        }
        remainingShiftsMap.set(emp.id, remaining);
      }

      // 4. Get actual sales MTD
      const actualSalesMap = new Map<string, number>();

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
            const empName = (row.employee_name || "").toLowerCase();
            let empId = nameToEmpId.get(empName);
            if (!empId && empName.includes("@")) {
              empId = emailToEmpId.get(empName);
            }
            if (empId && employeeIds.includes(empId)) {
              actualSalesMap.set(empId, (actualSalesMap.get(empId) || 0) + (row.quantity || 0));
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
            const empId = row.group_key;
            if (empId && employeeIds.includes(empId)) {
              actualSalesMap.set(empId, Number(row.total_sales) || 0);
            }
          }
        }
      }

      // 5. Rolling avg for established employees
      const rollingAvgMap = new Map<string, number>();

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
