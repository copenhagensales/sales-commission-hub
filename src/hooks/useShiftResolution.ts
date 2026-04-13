/**
 * React Query hook for shift resolution.
 *
 * Fetches all shift data for an employee (or multiple employees) and returns
 * a ShiftDataBundle that can be passed to the pure resolver functions in
 * src/lib/shiftResolution.ts.
 *
 * Caches per employee + period to avoid redundant fetches.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { ShiftDataBundle, IndividualShift, StandardShiftDay } from "@/lib/shiftResolution";

// ── Single employee hook ─────────────────────────────────────────────

export function useShiftResolution(
  employeeId: string | undefined,
  periodStart?: Date,
  periodEnd?: Date
) {
  const startStr = periodStart ? format(periodStart, "yyyy-MM-dd") : undefined;
  const endStr = periodEnd ? format(periodEnd, "yyyy-MM-dd") : undefined;

  return useQuery({
    queryKey: ["shift-resolution", employeeId, startStr, endStr],
    queryFn: () => fetchShiftDataForEmployee(employeeId!, startStr, endStr),
    enabled: !!employeeId,
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

// ── Multi-employee hook ──────────────────────────────────────────────

export function useMultiEmployeeShiftResolution(
  employeeIds: string[],
  periodStart?: Date,
  periodEnd?: Date
) {
  const startStr = periodStart ? format(periodStart, "yyyy-MM-dd") : undefined;
  const endStr = periodEnd ? format(periodEnd, "yyyy-MM-dd") : undefined;

  return useQuery({
    queryKey: ["shift-resolution-multi", employeeIds.sort().join(","), startStr, endStr],
    queryFn: async () => {
      const results = new Map<string, ShiftDataBundle>();
      // Fetch in parallel
      const bundles = await Promise.all(
        employeeIds.map(async (id) => ({
          id,
          bundle: await fetchShiftDataForEmployee(id, startStr, endStr),
        }))
      );
      for (const { id, bundle } of bundles) {
        results.set(id, bundle);
      }
      return results;
    },
    enabled: employeeIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

// ── Data fetcher ─────────────────────────────────────────────────────

async function fetchShiftDataForEmployee(
  employeeId: string,
  startStr?: string,
  endStr?: string
): Promise<ShiftDataBundle> {
  // 1. Get employee's team_id
  const { data: emp } = await supabase
    .from("employee_master_data")
    .select("team_id")
    .eq("id", employeeId)
    .single();

  const teamId = emp?.team_id;

  // Also check team_members for staff without team_id on master data
  let resolvedTeamId = teamId;
  if (!resolvedTeamId) {
    const { data: membership } = await supabase
      .from("team_members")
      .select("team_id")
      .eq("employee_id", employeeId)
      .limit(1)
      .maybeSingle();
    resolvedTeamId = membership?.team_id || null;
  }

  // 2. Fetch individual shifts, employee standard shift, and team standard shift in parallel
  const individualQuery = supabase
    .from("shift")
    .select("date, start_time, end_time")
    .eq("employee_id", employeeId);

  if (startStr) individualQuery.gte("date", startStr);
  if (endStr) individualQuery.lte("date", endStr);

  const [individualRes, empStandardRes, teamStandardRes, allShiftDaysRes] = await Promise.all([
    individualQuery,
    supabase
      .from("employee_standard_shifts")
      .select("shift_id")
      .eq("employee_id", employeeId)
      .maybeSingle(),
    resolvedTeamId
      ? supabase
          .from("team_standard_shifts")
          .select("id, start_time, end_time, is_active")
          .eq("team_id", resolvedTeamId)
          .eq("is_active", true)
          .order("created_at", { ascending: true })
          .limit(1)
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("team_standard_shift_days")
      .select("shift_id, day_of_week, start_time, end_time"),
  ]);

  // 3. Build individual shifts map
  const individualShifts = new Map<string, IndividualShift>();
  for (const s of individualRes.data || []) {
    individualShifts.set(s.date, {
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
    });
  }

  // 4. Build employee standard shift days
  const empShiftId = empStandardRes.data?.shift_id;
  const allDays = (allShiftDaysRes.data || []) as StandardShiftDay[];

  let standardShiftDays: StandardShiftDay[] | null = null;
  if (empShiftId) {
    standardShiftDays = allDays.filter((d) => d.shift_id === empShiftId);
    if (standardShiftDays.length === 0) standardShiftDays = null;
  }

  // 5. Build team standard shift days (fallback)
  const teamShift = (teamStandardRes.data as any[])?.[0];
  let teamStandardShiftDays: StandardShiftDay[] | null = null;
  let standardShiftDefaults: { start_time: string; end_time: string } | null = null;

  if (teamShift && !empShiftId) {
    // Only use team standard if employee doesn't have a personal assignment
    teamStandardShiftDays = allDays.filter((d) => d.shift_id === teamShift.id);
    if (teamStandardShiftDays.length === 0) teamStandardShiftDays = null;
    standardShiftDefaults = {
      start_time: teamShift.start_time,
      end_time: teamShift.end_time,
    };
  } else if (teamShift && empShiftId) {
    // Employee has personal assignment — still store team defaults for reference
    standardShiftDefaults = {
      start_time: teamShift.start_time,
      end_time: teamShift.end_time,
    };
  }

  return {
    individualShifts,
    standardShiftDays,
    teamStandardShiftDays,
    standardShiftDefaults,
  };
}
