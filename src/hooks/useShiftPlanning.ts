import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Shift {
  id: string;
  employee_id: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number | null;
  planned_hours: number | null;
  status: "planned" | "completed" | "cancelled";
  note: string | null;
  created_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    department: string | null;
    standard_start_time: string | null;
    weekly_hours: number | null;
  };
}

export interface AbsenceRequest {
  id: string;
  employee_id: string;
  type: "vacation" | "sick";
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  is_full_day: boolean;
  comment: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  employee?: {
    id: string;
    first_name: string;
    last_name: string;
    department: string | null;
  };
}

export interface TimeEntry {
  id: string;
  employee_id: string;
  shift_id: string | null;
  date: string;
  clock_in: string | null;
  clock_out: string | null;
  actual_hours: number | null;
  note: string | null;
  shift?: Shift;
}

export interface DanishHoliday {
  id: string;
  date: string;
  name: string;
  year: number;
}

// Fetch shifts for a date range
export function useShifts(startDate: string, endDate: string, department?: string) {
  return useQuery({
    queryKey: ["shifts", startDate, endDate, department],
    queryFn: async () => {
      let query = supabase
        .from("shift")
        .select(`
          *,
          employee:employee_master_data(id, first_name, last_name, department, standard_start_time, weekly_hours)
        `)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date")
        .order("start_time");

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by department if specified
      if (department && department !== "all") {
        return (data as Shift[]).filter(s => s.employee?.department === department);
      }
      return data as Shift[];
    },
  });
}

// Fetch employee's own shifts
export function useMyShifts(employeeId: string | undefined, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["my-shifts", employeeId, startDate, endDate],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("shift")
        .select("*")
        .eq("employee_id", employeeId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date");

      if (error) throw error;
      return data as Shift[];
    },
    enabled: !!employeeId,
  });
}

// Create shift
export function useCreateShift() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (shift: Omit<Shift, "id" | "created_at" | "planned_hours" | "employee">) => {
      const { data, error } = await supabase
        .from("shift")
        .insert(shift)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
      toast.success("Vagt oprettet");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke oprette vagt: " + error.message);
    },
  });
}

// Update shift
export function useUpdateShift() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Shift> & { id: string }) => {
      const { data, error } = await supabase
        .from("shift")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
      toast.success("Vagt opdateret");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke opdatere vagt: " + error.message);
    },
  });
}

// Delete shift
export function useDeleteShift() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shift").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shifts"] });
      queryClient.invalidateQueries({ queryKey: ["my-shifts"] });
      toast.success("Vagt slettet");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke slette vagt: " + error.message);
    },
  });
}

// Fetch absence requests
export function useAbsenceRequests(status?: "pending" | "approved" | "rejected", employeeId?: string) {
  return useQuery({
    queryKey: ["absence-requests", status, employeeId],
    queryFn: async () => {
      let query = supabase
        .from("absence_request_v2")
        .select(`
          *,
          employee:employee_master_data(id, first_name, last_name, department)
        `)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }
      if (employeeId) {
        query = query.eq("employee_id", employeeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AbsenceRequest[];
    },
  });
}

// Fetch approved absences for a date range (for shift overview)
export function useAbsencesForDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["absences-date-range", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("absence_request_v2")
        .select(`
          *,
          employee:employee_master_data(id, first_name, last_name, department)
        `)
        .eq("status", "approved")
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      if (error) throw error;
      return data as AbsenceRequest[];
    },
  });
}

// Create absence request
export function useCreateAbsenceRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (request: Omit<AbsenceRequest, "id" | "created_at" | "status" | "reviewed_by" | "reviewed_at" | "rejection_reason" | "employee">) => {
      const { data, error } = await supabase
        .from("absence_request_v2")
        .insert(request)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["absence-requests"] });
      toast.success("Fraværsanmodning oprettet");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke oprette anmodning: " + error.message);
    },
  });
}

// Approve/reject absence request
export function useUpdateAbsenceRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, status, rejection_reason }: { id: string; status: "approved" | "rejected"; rejection_reason?: string }) => {
      const { data, error } = await supabase
        .from("absence_request_v2")
        .update({
          status,
          rejection_reason,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["absence-requests"] });
      toast.success(variables.status === "approved" ? "Anmodning godkendt" : "Anmodning afvist");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke opdatere anmodning: " + error.message);
    },
  });
}

// Time entries
export function useTimeEntries(employeeId: string | undefined, startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["time-entries", employeeId, startDate, endDate],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("time_entry")
        .select(`*, shift(*)`)
        .eq("employee_id", employeeId)
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (error) throw error;
      return data as TimeEntry[];
    },
    enabled: !!employeeId,
  });
}

// Clock in
export function useClockIn() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ employee_id, shift_id, date }: { employee_id: string; shift_id?: string; date: string }) => {
      const { data, error } = await supabase
        .from("time_entry")
        .insert({
          employee_id,
          shift_id,
          date,
          clock_in: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      toast.success("Stemplet ind");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke stemple ind: " + error.message);
    },
  });
}

// Clock out
export function useClockOut() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("time_entry")
        .update({ clock_out: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["active-time-entry"] });
      toast.success("Stemplet ud");
    },
    onError: (error: any) => {
      toast.error("Kunne ikke stemple ud: " + error.message);
    },
  });
}

// Get active time entry (clocked in but not out)
export function useActiveTimeEntry(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["active-time-entry", employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const { data, error } = await supabase
        .from("time_entry")
        .select("*")
        .eq("employee_id", employeeId)
        .is("clock_out", null)
        .maybeSingle();

      if (error) throw error;
      return data as TimeEntry | null;
    },
    enabled: !!employeeId,
  });
}

// Fetch Danish holidays
export function useDanishHolidays(year?: number) {
  return useQuery({
    queryKey: ["danish-holidays", year],
    queryFn: async () => {
      let query = supabase.from("danish_holiday").select("*").order("date");
      if (year) {
        query = query.eq("year", year);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as DanishHoliday[];
    },
  });
}

// Get employee by current user
export function useCurrentEmployee() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["current-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("*")
        .eq("private_email", user.email)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });
}

// Get all employees for manager view
export function useEmployeesForShifts(department?: string) {
  return useQuery({
    queryKey: ["employees-for-shifts", department],
    queryFn: async () => {
      let query = supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, department, standard_start_time, weekly_hours")
        .eq("is_active", true)
        .order("first_name");

      if (department && department !== "all") {
        query = query.eq("department", department);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Get unique departments
export function useDepartments() {
  return useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("department")
        .eq("is_active", true)
        .not("department", "is", null);

      if (error) throw error;
      const unique = [...new Set(data.map(d => d.department).filter(Boolean))];
      return unique as string[];
    },
  });
}

// Calculate absence statistics
export function useAbsenceStats(employeeId: string | undefined, year: number) {
  return useQuery({
    queryKey: ["absence-stats", employeeId, year],
    queryFn: async () => {
      if (!employeeId) return null;
      
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      
      const { data, error } = await supabase
        .from("absence_request_v2")
        .select("*")
        .eq("employee_id", employeeId)
        .eq("status", "approved")
        .gte("start_date", startOfYear)
        .lte("end_date", endOfYear);

      if (error) throw error;
      
      let vacationDays = 0;
      let sickDays = 0;
      
      (data as AbsenceRequest[]).forEach(req => {
        const start = new Date(req.start_date);
        const end = new Date(req.end_date);
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        
        if (req.type === "vacation") {
          vacationDays += req.is_full_day ? days : 0.5;
        } else {
          sickDays += req.is_full_day ? days : 0.5;
        }
      });
      
      return { vacationDays, sickDays, year };
    },
    enabled: !!employeeId,
  });
}
