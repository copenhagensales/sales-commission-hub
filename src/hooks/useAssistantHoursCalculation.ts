import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { eachDayOfInterval, format, getDay } from "date-fns";

interface AssistantHoursData {
  employeeId: string;
  hourlyRate: number;
  workedHours: number;
  baseSalary: number;
  vacationPay: number; // 12.5%
  totalSalary: number;
}

const ASSISTANT_VACATION_PAY_RATE = 0.125; // 12.5%

/**
 * Hook to calculate assistant team leader salary based on actual worked hours.
 * Fetches shifts from the shift hierarchy and excludes absence days.
 * 
 * Shift hierarchy:
 * 1. Individual shift (shift table) - highest priority
 * 2. Employee standard shift (employee_standard_shifts → team_standard_shift_days)
 * 3. Team standard shift (team_standard_shifts → team_standard_shift_days) - lowest priority
 */
export function useAssistantHoursCalculation(
  periodStart: Date,
  periodEnd: Date,
  assistantIds: string[]
) {
  return useQuery<Record<string, AssistantHoursData>>({
    queryKey: ["assistant-hours-calculation", periodStart.toISOString(), periodEnd.toISOString(), assistantIds.sort().join(",")],
    queryFn: async () => {
      if (assistantIds.length === 0) return {};

      // 1. Get hourly rates for assistants from personnel_salaries
      // Note: monthly_salary field is repurposed as hourly_rate for assistants
      const { data: salaries } = await supabase
        .from("personnel_salaries")
        .select("employee_id, monthly_salary, hourly_rate")
        .eq("salary_type", "assistant")
        .eq("is_active", true)
        .in("employee_id", assistantIds);

      // 2. Get team info for assistants (to find their team standard shifts)
      const { data: employees } = await supabase
        .from("employee_master_data")
        .select("id, team_id")
        .in("id", assistantIds);

      const teamIds = [...new Set(employees?.map(e => e.team_id).filter(Boolean))] as string[];

      // 3. Get employee standard shift assignments → shift_id
      const { data: employeeShiftAssignments } = await supabase
        .from("employee_standard_shifts")
        .select("employee_id, shift_id")
        .in("employee_id", assistantIds);

      // Collect all shift IDs we need
      const empShiftIds = [...new Set((employeeShiftAssignments || []).map(a => a.shift_id).filter(Boolean))] as string[];

      // 4. Get team standard shifts for employees and their teams
      const { data: teamStandardShifts } = await supabase
        .from("team_standard_shifts")
        .select("id, team_id, start_time, end_time")
        .eq("is_active", true)
        .in("team_id", teamIds.length > 0 ? teamIds : ["none"]);

      // Get shift IDs from team standard shifts too
      const teamShiftIds = (teamStandardShifts || []).map(s => s.id);
      const allShiftIds = [...new Set([...empShiftIds, ...teamShiftIds])];

      // 5. Get shift days (which weekdays each shift covers)
      const { data: shiftDays } = await supabase
        .from("team_standard_shift_days")
        .select("shift_id, day_of_week, start_time, end_time")
        .in("shift_id", allShiftIds.length > 0 ? allShiftIds : ["none"]);

      // 6. Get individual shifts in period (highest priority)
      const { data: individualShifts } = await supabase
        .from("shift")
        .select("employee_id, date, start_time, end_time")
        .in("employee_id", assistantIds)
        .gte("date", format(periodStart, "yyyy-MM-dd"))
        .lte("date", format(periodEnd, "yyyy-MM-dd"));

      // 7. Get approved absences in period
      const { data: absences } = await supabase
        .from("absence_request_v2")
        .select("employee_id, start_date, end_date, is_full_day")
        .in("employee_id", assistantIds)
        .eq("status", "approved")
        .lte("start_date", format(periodEnd, "yyyy-MM-dd"))
        .gte("end_date", format(periodStart, "yyyy-MM-dd"));

      // Build lookup maps
      // Map shift_id → days
      const shiftDaysMap = new Map<string, Array<{ dayOfWeek: number; startTime: string; endTime: string }>>();
      for (const sd of shiftDays || []) {
        if (!shiftDaysMap.has(sd.shift_id)) {
          shiftDaysMap.set(sd.shift_id, []);
        }
        shiftDaysMap.get(sd.shift_id)!.push({
          dayOfWeek: sd.day_of_week,
          startTime: sd.start_time,
          endTime: sd.end_time,
        });
      }

      // Build result
      const result: Record<string, AssistantHoursData> = {};

      for (const assistantId of assistantIds) {
        const salary = salaries?.find(s => s.employee_id === assistantId);
        // Use hourly_rate if set, otherwise fall back to monthly_salary (legacy)
        const hourlyRate = Number(salary?.hourly_rate) || Number(salary?.monthly_salary) || 0;
        
        if (hourlyRate === 0) {
          result[assistantId] = {
            employeeId: assistantId,
            hourlyRate: 0,
            workedHours: 0,
            baseSalary: 0,
            vacationPay: 0,
            totalSalary: 0,
          };
          continue;
        }

        const employee = employees?.find(e => e.id === assistantId);
        
        // Get employee's assigned shift (via employee_standard_shifts)
        const empShiftAssignment = employeeShiftAssignments?.find(a => a.employee_id === assistantId);
        const empShiftId = empShiftAssignment?.shift_id;
        const empShiftDays = empShiftId ? shiftDaysMap.get(empShiftId) : undefined;

        // Get team's default shift
        const teamShift = teamStandardShifts?.find(s => s.team_id === employee?.team_id);
        const teamShiftDays = teamShift?.id ? shiftDaysMap.get(teamShift.id) : undefined;

        // Individual shifts by date
        const individualShiftMap = new Map<string, { start: string; end: string }>();
        const empIndividualShifts = individualShifts?.filter(s => s.employee_id === assistantId) || [];
        for (const shift of empIndividualShifts) {
          if (shift.start_time && shift.end_time) {
            individualShiftMap.set(shift.date, { start: shift.start_time, end: shift.end_time });
          }
        }

        // Absence days for this employee
        const empAbsences = absences?.filter(a => a.employee_id === assistantId) || [];
        const absenceDates = new Set<string>();
        for (const absence of empAbsences) {
          const start = new Date(absence.start_date);
          const end = new Date(absence.end_date);
          const days = eachDayOfInterval({ start, end });
          for (const day of days) {
            absenceDates.add(format(day, "yyyy-MM-dd"));
          }
        }

        // Calculate hours for each day in period
        let totalHours = 0;
        const daysInPeriod = eachDayOfInterval({ start: periodStart, end: periodEnd });

        for (const day of daysInPeriod) {
          const dateStr = format(day, "yyyy-MM-dd");
          const jsWeekday = getDay(day); // 0=Sunday, 1=Monday, ..., 6=Saturday

          // Skip if employee has absence on this day
          if (absenceDates.has(dateStr)) {
            continue;
          }

          // Find shift for this day using hierarchy:
          // 1. Individual shift (highest priority)
          // 2. Employee standard shift
          // 3. Team standard shift
          let startTime: string | undefined;
          let endTime: string | undefined;

          if (individualShiftMap.has(dateStr)) {
            const shift = individualShiftMap.get(dateStr)!;
            startTime = shift.start;
            endTime = shift.end;
          } else if (empShiftDays) {
            const dayShift = empShiftDays.find(d => d.dayOfWeek === jsWeekday);
            if (dayShift) {
              startTime = dayShift.startTime;
              endTime = dayShift.endTime;
            }
          } else if (teamShiftDays) {
            const dayShift = teamShiftDays.find(d => d.dayOfWeek === jsWeekday);
            if (dayShift) {
              startTime = dayShift.startTime;
              endTime = dayShift.endTime;
            }
          }

          // Skip if no shift or "00:00" (no shift marker)
          if (startTime && endTime && startTime !== "00:00" && startTime !== "00:00:00") {
            const hours = calculateHoursFromShift(startTime, endTime);
            totalHours += hours;
          }
        }

        const baseSalary = totalHours * hourlyRate;
        const vacationPay = baseSalary * ASSISTANT_VACATION_PAY_RATE;
        const totalSalary = baseSalary + vacationPay;

        result[assistantId] = {
          employeeId: assistantId,
          hourlyRate,
          workedHours: totalHours,
          baseSalary,
          vacationPay,
          totalSalary,
        };
      }

      return result;
    },
    enabled: assistantIds.length > 0,
    staleTime: 60000,
  });
}

/**
 * Calculate hours from start_time and end_time strings (HH:mm or HH:mm:ss format).
 * Applies 30-minute break deduction for shifts over 6 hours.
 */
function calculateHoursFromShift(startTime: string, endTime: string): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  const startMinutes = startH * 60 + (startM || 0);
  const endMinutes = endH * 60 + (endM || 0);

  let totalMinutes = endMinutes - startMinutes;
  if (totalMinutes < 0) {
    // Handle overnight shifts (though rare for assistants)
    totalMinutes += 24 * 60;
  }

  // Apply 30-minute break for shifts over 6 hours
  if (totalMinutes > 360) {
    totalMinutes -= 30;
  }

  return Math.round((totalMinutes / 60) * 100) / 100; // Round to 2 decimals
}
