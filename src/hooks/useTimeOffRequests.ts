import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TimeOffRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: "Ferie" | "Syg" | "Barn syg" | "Andet";
  note: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  is_full_day: boolean;
  start_time: string | null;
  end_time: string | null;
  approved_by_employee_id: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  employee?: {
    id: string;
    full_name: string;
    email: string | null;
    team: string | null;
  };
}

export function useTimeOffRequests(status?: "PENDING" | "APPROVED" | "REJECTED") {
  return useQuery({
    queryKey: ["time-off-requests", status],
    queryFn: async () => {
      let query = supabase
        .from("employee_absence")
        .select(`
          *,
          employee:employee_id (
            id,
            full_name,
            email,
            team
          )
        `)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as unknown as TimeOffRequest[];
    },
  });
}

export function usePendingTimeOffCount() {
  return useQuery({
    queryKey: ["pending-time-off-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("employee_absence")
        .select("*", { count: "exact", head: true })
        .eq("status", "PENDING");

      if (error) throw error;
      return count || 0;
    },
  });
}

export function useApproveTimeOff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, approvedBy }: { requestId: string; approvedBy: string }) => {
      const { error } = await supabase
        .from("employee_absence")
        .update({
          status: "APPROVED",
          approved_by_employee_id: approvedBy,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-time-off-count"] });
    },
  });
}

export function useRejectTimeOff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, rejectionReason }: { requestId: string; rejectionReason: string }) => {
      const { error } = await supabase
        .from("employee_absence")
        .update({
          status: "REJECTED",
          rejection_reason: rejectionReason,
        })
        .eq("id", requestId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-time-off-count"] });
    },
  });
}

export function useCreateTimeOff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      employee_id: string;
      start_date: string;
      end_date: string;
      reason: "Ferie" | "Syg" | "Barn syg" | "Andet";
      note?: string;
      is_full_day?: boolean;
      start_time?: string;
      end_time?: string;
      status?: "PENDING" | "APPROVED";
    }) => {
      const { error } = await supabase.from("employee_absence").insert({
        employee_id: data.employee_id,
        start_date: data.start_date,
        end_date: data.end_date,
        reason: data.reason,
        note: data.note || null,
        is_full_day: data.is_full_day ?? true,
        start_time: data.start_time || null,
        end_time: data.end_time || null,
        status: data.status || "PENDING",
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["employee-absences"] });
    },
  });
}
