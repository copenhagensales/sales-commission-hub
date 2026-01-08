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

// Fetch shifts for a date range - filter by team membership when team is selected
export function useShifts(startDate: string, endDate: string, teamId?: string) {
  return useQuery({
    queryKey: ["shifts", startDate, endDate, teamId],
    queryFn: async () => {
      // If team is selected, first get team member IDs
      let teamMemberIds: string[] | null = null;
      if (teamId && teamId !== "all") {
        const { data: teamMembers, error: tmError } = await supabase
          .from("team_members")
          .select("employee_id")
          .eq("team_id", teamId);
        
        if (tmError) throw tmError;
        teamMemberIds = teamMembers?.map(tm => tm.employee_id) || [];
      }

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
      
      // Filter by team membership if specified
      if (teamMemberIds !== null) {
        return (data as Shift[]).filter(s => teamMemberIds!.includes(s.employee_id));
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
      // Fetch team memberships for enriching employee data
      const { data: teamMemberships } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      
      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name) {
          const existing = employeeTeamMap.get(tm.employee_id);
          if (existing) {
            employeeTeamMap.set(tm.employee_id, `${existing}, ${tm.team.name}`);
          } else {
            employeeTeamMap.set(tm.employee_id, tm.team.name);
          }
        }
      });

      let query = supabase
        .from("absence_request_v2")
        .select(`
          *,
          employee:employee_master_data(id, first_name, last_name)
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
      
      // Enrich with team names
      return (data || []).map(req => ({
        ...req,
        employee: req.employee ? {
          ...req.employee,
          department: employeeTeamMap.get(req.employee.id) || null,
        } : null,
      })) as AbsenceRequest[];
    },
  });
}

// Fetch approved absences for a date range (for shift overview)
export function useAbsencesForDateRange(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["absences-date-range", startDate, endDate],
    queryFn: async () => {
      // Fetch team memberships for enriching employee data
      const { data: teamMemberships } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      
      const employeeTeamMap = new Map<string, string>();
      (teamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name) {
          const existing = employeeTeamMap.get(tm.employee_id);
          if (existing) {
            employeeTeamMap.set(tm.employee_id, `${existing}, ${tm.team.name}`);
          } else {
            employeeTeamMap.set(tm.employee_id, tm.team.name);
          }
        }
      });

      const { data, error } = await supabase
        .from("absence_request_v2")
        .select(`
          *,
          employee:employee_master_data(id, first_name, last_name)
        `)
        .eq("status", "approved")
        .lte("start_date", endDate)
        .gte("end_date", startDate);

      if (error) throw error;
      
      // Enrich with team names
      return (data || []).map(req => ({
        ...req,
        employee: req.employee ? {
          ...req.employee,
          department: employeeTeamMap.get(req.employee.id) || null,
        } : null,
      })) as AbsenceRequest[];
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
  const { user, loading: authLoading } = useAuth();
  
  const query = useQuery({
    queryKey: ["current-employee", user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const lowerEmail = user.email.toLowerCase();
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("*")
        .or(`private_email.ilike.${lowerEmail},work_email.ilike.${lowerEmail}`)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.email,
  });
  
  // Include auth loading state in isLoading
  return {
    ...query,
    isLoading: authLoading || query.isLoading,
  };
}

// Get employees for manager view - filter by team membership when team is selected
export function useEmployeesForShifts(teamId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["employees-for-shifts", teamId, user?.id],
    queryFn: async () => {
      // First check if user is owner
      const { data: isOwner, error: ownerError } = await supabase.rpc("is_owner", { _user_id: user?.id });
      
      // Get current employee id
      const { data: currentEmployeeId, error: empError } = await supabase.rpc("get_current_employee_id");
      
      console.log("[useEmployeesForShifts] DEBUG:", {
        userId: user?.id,
        isOwner,
        ownerError,
        currentEmployeeId,
        empError,
        teamId
      });
      
      // Fetch all team memberships with team names for enriching employee data
      const { data: allTeamMemberships } = await supabase
        .from("team_members")
        .select("employee_id, team:teams(name)");
      
      // Create a map of employee_id to team names (comma-separated if multiple)
      const employeeTeamMap = new Map<string, string>();
      (allTeamMemberships || []).forEach((tm: { employee_id: string; team: { name: string } | null }) => {
        if (tm.team?.name) {
          const existing = employeeTeamMap.get(tm.employee_id);
          if (existing) {
            employeeTeamMap.set(tm.employee_id, `${existing}, ${tm.team.name}`);
          } else {
            employeeTeamMap.set(tm.employee_id, tm.team.name);
          }
        }
      });
      
      // Helper to fetch employees by IDs and enrich with team names
      const fetchEmployeesByIds = async (employeeIds: string[]) => {
        if (employeeIds.length === 0) return [];
        const { data, error } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, standard_start_time, weekly_hours, manager_id, salary_type, salary_amount, team_id")
          .in("id", employeeIds)
          .eq("is_active", true)
          .order("first_name");
        if (error) throw error;
        // Enrich with team names from team_members
        return (data || []).map(emp => ({
          ...emp,
          department: employeeTeamMap.get(emp.id) || null,
        }));
      };
      
      // If a specific team is selected, get employees from team_members
      if (teamId && teamId !== "all") {
        const { data: teamMembers, error: tmError } = await supabase
          .from("team_members")
          .select("employee_id")
          .eq("team_id", teamId);

        if (tmError) throw tmError;
        
        const employeeIds = (teamMembers || []).map(tm => tm.employee_id);
        console.log("[useEmployeesForShifts] Team filter - found", employeeIds.length, "employees");
        return fetchEmployeesByIds(employeeIds);
      }
      
      // For non-owners, get employees from teams they lead (as leader or assistant)
      if (isOwner !== true && currentEmployeeId) {
        // Get teams where current user is team_leader OR assistant_team_leader
        const { data: ledTeams, error: teamsError } = await supabase
          .from("teams")
          .select("id, name")
          .or(`team_leader_id.eq.${currentEmployeeId},assistant_team_leader_id.eq.${currentEmployeeId}`);
        
        if (teamsError) throw teamsError;
        
        console.log("[useEmployeesForShifts] Led teams (leader or assistant):", ledTeams);
        
        if (ledTeams && ledTeams.length > 0) {
          const teamIds = ledTeams.map(t => t.id);
          
          // Get all employees from those teams
          const { data: teamMembers, error: tmError } = await supabase
            .from("team_members")
            .select("employee_id")
            .in("team_id", teamIds);
          
          if (tmError) throw tmError;
          
          // Deduplicate employee IDs and exclude current user
          const employeeIds = [...new Set((teamMembers || []).map(tm => tm.employee_id))]
            .filter(id => id !== currentEmployeeId);
          
          console.log("[useEmployeesForShifts] Found", employeeIds.length, "team members in led teams");
          return fetchEmployeesByIds(employeeIds);
        }
        
        // Fallback: filter by manager_id if no teams led
        console.log("[useEmployeesForShifts] No led teams, trying manager_id fallback");
        const { data, error } = await supabase
          .from("employee_master_data")
          .select("id, first_name, last_name, standard_start_time, weekly_hours, manager_id, salary_type, salary_amount, team_id")
          .eq("is_active", true)
          .eq("manager_id", currentEmployeeId)
          .neq("id", currentEmployeeId)
          .order("first_name");
        
        if (error) throw error;
        // Enrich with team names
        return (data || []).map(emp => ({
          ...emp,
          department: employeeTeamMap.get(emp.id) || null,
        }));
      }
      
      // Owner - get all active employees
      console.log("[useEmployeesForShifts] Owner mode - fetching all employees");
      const { data, error } = await supabase
        .from("employee_master_data")
        .select("id, first_name, last_name, standard_start_time, weekly_hours, manager_id, salary_type, salary_amount, team_id")
        .eq("is_active", true)
        .order("first_name");

      if (error) throw error;
      // Enrich with team names
      return (data || []).map(emp => ({
        ...emp,
        department: employeeTeamMap.get(emp.id) || null,
      }));
    },
    enabled: !!user?.id,
  });
}

// Get teams for dropdown
export function useDepartments() {
  return useQuery({
    queryKey: ["teams-for-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name")
        .order("name");

      if (error) throw error;
      return data as { id: string; name: string }[];
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
