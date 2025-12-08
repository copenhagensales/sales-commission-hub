import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface TimeStamp {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  shift_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export function useTimeStamps() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Get current employee ID
  const { data: employeeId } = useQuery({
    queryKey: ["current-employee-id", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data } = await supabase
        .from("employee_master_data")
        .select("id")
        .eq("private_email", user.email)
        .maybeSingle();
      return data?.id || null;
    },
    enabled: !!user?.email,
  });

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
    refetchInterval: 30000, // Refresh every 30 seconds
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

  // Clock in mutation
  const clockIn = useMutation({
    mutationFn: async (note?: string) => {
      if (!employeeId) throw new Error("Employee not found");
      
      const { data, error } = await supabase
        .from("time_stamps")
        .insert({
          employee_id: employeeId,
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

  // Clock out mutation
  const clockOut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const { data, error } = await supabase
        .from("time_stamps")
        .update({
          clock_out: new Date().toISOString(),
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

  // Calculate total hours worked today
  const totalHoursToday = todayStamps.reduce((total, stamp) => {
    if (!stamp.clock_out) {
      // Still clocked in, calculate from clock_in to now
      const clockIn = new Date(stamp.clock_in);
      const now = new Date();
      return total + (now.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
    }
    const clockIn = new Date(stamp.clock_in);
    const clockOut = new Date(stamp.clock_out);
    return total + (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
  }, 0);

  return {
    employeeId,
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
