import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, eachDayOfInterval, isBefore, isAfter, isSameDay, startOfDay } from "date-fns";

interface WorkingDaysResult {
  total: number;
  passed: number;
  remaining: number;
  days: Date[];
}

/**
 * Calculates working days for an employee using the shift hierarchy:
 * 1. Individual shifts (shift table) – highest priority
 * 2. Employee standard shifts (employee_standard_shifts → team_standard_shift_days)
 * 3. Team standard shifts (team_standard_shifts → team_standard_shift_days)
 * 4. Fallback: weekdays (Mon-Fri)
 *
 * Excludes holidays and approved absences.
 */
export function useEmployeeWorkingDays(
  employeeId: string | undefined,
  payrollPeriod: { start: Date; end: Date },
  absences: Array<{ start_date: string; end_date: string; type: string }>,
  danishHolidays: Array<{ date: string; name: string }>
): { data: WorkingDaysResult; isLoading: boolean } {
  const startStr = format(payrollPeriod.start, "yyyy-MM-dd");
  const endStr = format(payrollPeriod.end, "yyyy-MM-dd");

  const { data: shiftData, isLoading } = useQuery({
    queryKey: ["employee-working-days-shifts", employeeId, startStr, endStr],
    queryFn: async () => {
      if (!employeeId) return null;

      // Get employee's team_id
      const { data: emp } = await (supabase as any)
        .from("employee_master_data")
        .select("team_id")
        .eq("id", employeeId)
        .single();

      const teamId = emp?.team_id;

      // Fetch all shift sources in parallel
      const [individualRes, empStandardRes, teamStandardRes, shiftDaysRes] = await Promise.all([
        supabase
          .from("shift")
          .select("date")
          .eq("employee_id", employeeId)
          .gte("date", startStr)
          .lte("date", endStr),
        supabase
          .from("employee_standard_shifts")
          .select("shift_id")
          .eq("employee_id", employeeId),
        teamId
          ? supabase
              .from("team_standard_shifts")
              .select("id, is_active")
              .eq("team_id", teamId)
          : Promise.resolve({ data: [] }),
        supabase
          .from("team_standard_shift_days")
          .select("shift_id, day_of_week"),
      ]);

      const individualDates = new Set(
        (individualRes.data || []).map((s: any) => s.date)
      );

      // Employee standard shift days
      const empShiftIds = (empStandardRes.data || []).map((s: any) => s.shift_id);
      const allShiftDays = shiftDaysRes.data || [];

      const empStandardDays: number[] = [];
      empShiftIds.forEach((shiftId: string) => {
        allShiftDays
          .filter((sd: any) => sd.shift_id === shiftId)
          .forEach((sd: any) => empStandardDays.push(sd.day_of_week));
      });

      // Team standard shift days
      const teamActiveShiftId = (teamStandardRes.data || []).find(
        (s: any) => s.is_active
      )?.id;
      const teamDays: number[] = teamActiveShiftId
        ? allShiftDays
            .filter((sd: any) => sd.shift_id === teamActiveShiftId)
            .map((sd: any) => sd.day_of_week)
        : [];

      return {
        individualDates,
        empStandardDays: empStandardDays.length > 0 ? empStandardDays : null,
        teamDays: teamDays.length > 0 ? teamDays : null,
      };
    },
    enabled: !!employeeId,
  });

  // Build working days from shift data
  const allDays = eachDayOfInterval({
    start: payrollPeriod.start,
    end: payrollPeriod.end,
  });

  const holidayDates = new Set(danishHolidays.map((h) => h.date));

  const absenceDates = new Set<string>();
  absences.forEach((absence) => {
    const absenceStart = new Date(absence.start_date);
    const absenceEnd = new Date(absence.end_date);
    eachDayOfInterval({ start: absenceStart, end: absenceEnd }).forEach((day) => {
      absenceDates.add(format(day, "yyyy-MM-dd"));
    });
  });

  const workingDays = allDays.filter((day) => {
    const dateStr = format(day, "yyyy-MM-dd");

    // Skip holidays and absences
    if (holidayDates.has(dateStr) || absenceDates.has(dateStr)) return false;

    if (!shiftData) {
      // Fallback while loading or no data: weekdays
      const dow = day.getDay();
      return dow !== 0 && dow !== 6;
    }

    const { individualDates, empStandardDays, teamDays } = shiftData;

    // Hierarchy: individual → employee standard → team standard → fallback weekday
    if (individualDates.has(dateStr)) return true;

    const dayOfWeek = day.getDay();
    const dayNumber = dayOfWeek === 0 ? 7 : dayOfWeek; // ISO: Mon=1..Sun=7

    if (empStandardDays !== null) return empStandardDays.includes(dayNumber);
    if (teamDays !== null) return teamDays.includes(dayNumber);

    // Fallback: weekdays
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  });

  const today = startOfDay(new Date());
  const passedWorkingDays = workingDays.filter(
    (day) => isBefore(day, today) || isSameDay(day, today)
  );
  const remainingWorkingDays = workingDays.filter((day) => isAfter(day, today));

  return {
    data: {
      total: workingDays.length,
      passed: passedWorkingDays.length,
      remaining: remainingWorkingDays.length,
      days: workingDays,
    },
    isLoading,
  };
}
