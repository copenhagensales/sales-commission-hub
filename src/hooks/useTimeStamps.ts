import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface TimeStamp {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  effective_clock_in: string | null;
  effective_clock_out: string | null;
  effective_hours: number | null;
  break_minutes: number | null;
  shift_id: string | null;
  note: string | null;
  edited_by: string | null;
  edited_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeStampWithEmployee extends TimeStamp {
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    standard_start_time: string | null;
    salary_type: string | null;
  };
}

// Parse working hours from standard_start_time (e.g., "8.00-16.30")
export function parseWorkingHours(timeString: string | null): { start: string; end: string } {
  if (!timeString) return { start: "09:00", end: "17:00" };
  const [start, end] = timeString.split("-").map(t => t.trim().replace(".", ":"));
  return { start: start || "09:00", end: end || "17:00" };
}

// Calculate effective clock times based on shift schedule
// NOTE: This function calculates effective times for payroll purposes only.
// The actual clock_in/clock_out times are ALWAYS preserved in the database.
// Effective times are used for calculating billable/payable hours within shift boundaries.
export function calculateEffectiveTimes(
  clockIn: Date,
  clockOut: Date | null,
  shiftStart: string,
  shiftEnd: string,
  breakMinutes: number = 60
): { effectiveIn: Date; effectiveOut: Date | null; effectiveHours: number | null } {
  // If no shift times configured, use actual clock times
  if (!shiftStart || !shiftEnd) {
    let effectiveHours: number | null = null;
    if (clockOut) {
      const diffMs = clockOut.getTime() - clockIn.getTime();
      effectiveHours = Math.max(0, diffMs / (1000 * 60 * 60) - (breakMinutes / 60));
    }
    return { effectiveIn: clockIn, effectiveOut: clockOut, effectiveHours };
  }

  const today = clockIn.toISOString().split("T")[0];
  
  const shiftStartTime = new Date(today + "T" + shiftStart.padStart(5, "0") + ":00");
  const shiftEndTime = new Date(today + "T" + shiftEnd.padStart(5, "0") + ":00");
  
  // For effective times calculation (payroll):
  // - If clocked in before shift start, count hours from shift start
  // - If clocked out after shift end, count hours until shift end
  // This ensures employees are paid for their scheduled shift, not extra time
  const effectiveIn = clockIn < shiftStartTime ? shiftStartTime : clockIn;
  
  let effectiveOut: Date | null = null;
  if (clockOut) {
    effectiveOut = clockOut > shiftEndTime ? shiftEndTime : clockOut;
  }
  
  // Calculate effective hours (with break deduction)
  let effectiveHours: number | null = null;
  if (effectiveOut) {
    const diffMs = effectiveOut.getTime() - effectiveIn.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    effectiveHours = Math.max(0, diffHours - (breakMinutes / 60));
  }
  
  return { effectiveIn, effectiveOut, effectiveHours };
}

export function useTimeStamps() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get current employee ID and info
  const { data: employee } = useQuery({
    queryKey: ["current-employee-for-stamps", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("id, standard_start_time, salary_type")
        .eq("private_email", user.email)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.email,
  });

  const employeeId = employee?.id || null;

  // Get active clock-in (no clock_out yet)
  const { data: activeStamp, isLoading: isLoadingActive } = useQuery({
    queryKey: ["active-time-stamp", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data } = await supabase
        .from("time_stamps")
        .select("*")
        .eq("employee_id", employeeId)
        .is("clock_out", null)
        .order("clock_in", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as TimeStamp | null;
    },
    enabled: !!employeeId,
    refetchInterval: 30000,
  });

  // Get today's time stamps
  const { data: todayStamps = [], isLoading: isLoadingToday } = useQuery({
    queryKey: ["today-time-stamps", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { data } = await supabase
        .from("time_stamps")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("clock_in", today.toISOString())
        .order("clock_in", { ascending: false });
      return (data || []) as TimeStamp[];
    },
    enabled: !!employeeId,
  });

  // Get recent time stamps (last 7 days)
  const { data: recentStamps = [], isLoading: isLoadingRecent } = useQuery({
    queryKey: ["recent-time-stamps", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { data } = await supabase
        .from("time_stamps")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("clock_in", weekAgo.toISOString())
        .order("clock_in", { ascending: false });
      return (data || []) as TimeStamp[];
    },
    enabled: !!employeeId,
  });

  // Clock in mutation with effective time calculation
  const clockIn = useMutation({
    mutationFn: async (note?: string) => {
      if (!employeeId || !employee) throw new Error("Employee not found");
      
      const clockInTime = new Date();
      const workingHours = parseWorkingHours(employee.standard_start_time);
      
      // Calculate effective times
      const { effectiveIn } = calculateEffectiveTimes(
        clockInTime,
        null,
        workingHours.start,
        workingHours.end,
        employee.salary_type === "hourly" ? 60 : 0
      );
      
      const { data, error } = await supabase
        .from("time_stamps")
        .insert({
          employee_id: employeeId,
          clock_in: clockInTime.toISOString(),
          effective_clock_in: effectiveIn.toISOString(),
          break_minutes: employee.salary_type === "hourly" ? 60 : 0,
          note: note || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-stamp"] });
      queryClient.invalidateQueries({ queryKey: ["today-time-stamps"] });
      queryClient.invalidateQueries({ queryKey: ["recent-time-stamps"] });
    },
  });

  // Clock out mutation with effective time calculation
  const clockOut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      if (!employee) throw new Error("Employee not found");
      
      // Get the current stamp to get clock_in time
      const { data: stampData } = await supabase
        .from("time_stamps")
        .select("*")
        .eq("id", id)
        .single();
      
      if (!stampData) throw new Error("Time stamp not found");
      
      // Cast to include new columns that may not be in generated types yet
      const stamp = stampData as TimeStamp;
      
      const clockInTime = new Date(stamp.clock_in);
      const clockOutTime = new Date();
      const workingHours = parseWorkingHours(employee.standard_start_time);
      const breakMins = stamp.break_minutes ?? (employee.salary_type === "hourly" ? 60 : 0);
      
      // Calculate effective times
      const { effectiveIn, effectiveOut, effectiveHours } = calculateEffectiveTimes(
        clockInTime,
        clockOutTime,
        workingHours.start,
        workingHours.end,
        breakMins
      );
      
      const { data, error } = await supabase
        .from("time_stamps")
        .update({
          clock_out: clockOutTime.toISOString(),
          effective_clock_in: effectiveIn.toISOString(),
          effective_clock_out: effectiveOut?.toISOString() || null,
          effective_hours: effectiveHours,
          note: note || null,
        })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-time-stamp"] });
      queryClient.invalidateQueries({ queryKey: ["today-time-stamps"] });
      queryClient.invalidateQueries({ queryKey: ["recent-time-stamps"] });
    },
  });

  // Calculate total hours worked today (using effective hours when available)
  const totalHoursToday = todayStamps.reduce((total, stamp) => {
    if (stamp.effective_hours !== null) {
      return total + stamp.effective_hours;
    }
    if (!stamp.clock_out) {
      // Still clocked in, calculate from effective_clock_in to now
      const clockIn = new Date(stamp.effective_clock_in || stamp.clock_in);
      const now = new Date();
      return total + (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    }
    const clockIn = new Date(stamp.effective_clock_in || stamp.clock_in);
    const clockOut = new Date(stamp.effective_clock_out || stamp.clock_out);
    return total + (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
  }, 0);

  return {
    employeeId,
    employee,
    activeStamp,
    todayStamps,
    recentStamps,
    totalHoursToday,
    isLoading: isLoadingActive || isLoadingToday,
    isLoadingRecent,
    clockIn,
    clockOut,
    isClockedIn: !!activeStamp,
  };
}

// Hook for fetching time stamps for calendar display
export function useTimeStampsForRange(employeeId: string | undefined, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["time-stamps-range", employeeId, startDate, endDate],
    queryFn: async () => {
      if (!employeeId) return [];
      
      const { data, error } = await supabase
        .from("time_stamps")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("clock_in", startDate)
        .lte("clock_in", endDate + "T23:59:59")
        .order("clock_in", { ascending: false });
      
      if (error) throw error;
      return (data || []) as TimeStamp[];
    },
    enabled: !!employeeId,
  });
}

// Manager hook for editing time stamps
export function useUpdateTimeStamp() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({
      id,
      effective_clock_in,
      effective_clock_out,
      effective_hours,
      note,
    }: {
      id: string;
      effective_clock_in?: string;
      effective_clock_out?: string;
      effective_hours?: number;
      note?: string;
    }) => {
      const { data, error } = await supabase
        .from("time_stamps")
        .update({
          effective_clock_in,
          effective_clock_out,
          effective_hours,
          note,
          edited_by: user?.id,
          edited_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-stamps-range"] });
      queryClient.invalidateQueries({ queryKey: ["today-time-stamps"] });
      queryClient.invalidateQueries({ queryKey: ["recent-time-stamps"] });
    },
  });
}