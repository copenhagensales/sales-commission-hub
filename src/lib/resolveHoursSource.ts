/**
 * Central resolver for hours source.
 * 
 * Hierarchy:
 * 1. Check employee_time_clocks for override/revenue → use timestamps
 * 2. Check employee_time_clocks for documentation → use shift schedule, log timestamps
 * 3. No time clock → use shift schedule (default)
 * 
 * Returns: 'timestamp' | 'shift' | 'documentation'
 */

import { supabase } from "@/integrations/supabase/client";

export type HoursSourceResult = {
  source: "timestamp" | "shift" | "documentation";
  clockType: "override" | "documentation" | "revenue" | null;
  hourlyRate: number;
};

/**
 * Resolve hours source for a specific employee, optionally scoped to a client.
 */
export async function resolveHoursSource(
  employeeId: string,
  clientId?: string | null
): Promise<HoursSourceResult> {
  const query = supabase
    .from("employee_time_clocks")
    .select("clock_type, hourly_rate")
    .eq("employee_id", employeeId)
    .eq("is_active", true);

  if (clientId) {
    // Check client-specific clock first, then global (null client_id)
    const { data: clientClocks } = await query.eq("client_id", clientId).limit(1);
    
    if (clientClocks && clientClocks.length > 0) {
      return mapClockToSource(clientClocks[0]);
    }

    // Fallback: check global clock (no client_id)
    const { data: globalClocks } = await supabase
      .from("employee_time_clocks")
      .select("clock_type, hourly_rate")
      .eq("employee_id", employeeId)
      .eq("is_active", true)
      .is("client_id", null)
      .limit(1);

    if (globalClocks && globalClocks.length > 0) {
      return mapClockToSource(globalClocks[0]);
    }
  } else {
    // No client context — check any active clock
    const { data: clocks } = await query.limit(1);
    if (clocks && clocks.length > 0) {
      return mapClockToSource(clocks[0]);
    }
  }

  // Default: use shift schedule
  return { source: "shift", clockType: null, hourlyRate: 0 };
}

function mapClockToSource(clock: { clock_type: string; hourly_rate: number | null }): HoursSourceResult {
  const hourlyRate = Number(clock.hourly_rate) || 0;

  switch (clock.clock_type) {
    case "override":
      return { source: "timestamp", clockType: "override", hourlyRate };
    case "revenue":
      return { source: "timestamp", clockType: "revenue", hourlyRate };
    case "documentation":
      return { source: "documentation", clockType: "documentation", hourlyRate };
    default:
      return { source: "shift", clockType: null, hourlyRate: 0 };
  }
}

/**
 * React-friendly: batch resolve for multiple employees.
 * Returns a map of employeeId → HoursSourceResult.
 */
export async function resolveHoursSourceBatch(
  employeeIds: string[],
  clientId?: string | null
): Promise<Record<string, HoursSourceResult>> {
  if (employeeIds.length === 0) return {};

  const result: Record<string, HoursSourceResult> = {};
  const defaultResult: HoursSourceResult = { source: "shift", clockType: null, hourlyRate: 0 };

  // Fetch all active clocks for these employees
  const { data: clocks } = await supabase
    .from("employee_time_clocks")
    .select("employee_id, client_id, clock_type, hourly_rate")
    .in("employee_id", employeeIds)
    .eq("is_active", true);

  if (!clocks || clocks.length === 0) {
    employeeIds.forEach((id) => { result[id] = defaultResult; });
    return result;
  }

  for (const empId of employeeIds) {
    const empClocks = clocks.filter((c) => c.employee_id === empId);
    
    // Priority: client-specific > global > default
    const clientSpecific = clientId
      ? empClocks.find((c) => c.client_id === clientId)
      : null;
    const globalClock = empClocks.find((c) => c.client_id === null);
    const anyClock = empClocks[0];

    const match = clientSpecific || globalClock || (clientId ? null : anyClock);
    
    result[empId] = match
      ? mapClockToSource(match)
      : defaultResult;
  }

  return result;
}
